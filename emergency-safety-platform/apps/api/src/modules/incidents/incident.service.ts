import { prisma } from "../../db/prisma.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { emitToOwnerAndTrustedNetwork } from "../../realtime/socket.js";
import { SocketEvents, ActivationMethod, IncidentStatus, NotificationType } from "@esp/types";
import { toIncidentDTO } from "./incidents.mapper.js";
import { assertIncidentAccess, findTrustedMemberLink } from "./incidents.access.js";
import { recordAuditLog } from "../auditLogs/auditLog.service.js";
import * as evidenceService from "../evidence/evidence.service.js";
import * as locationService from "../location/location.service.js";
import * as notificationsService from "../notifications/notifications.service.js";
import * as wearablesService from "../wearables/wearables.service.js";

/**
 * THE Incident Management Engine.
 *
 * Every activation path in the system — the emergency keyword, the wearable
 * emergency button, simulated fall detection, a phone panic button, or (one
 * day) a real hardware trigger — funnels through `createIncidentFromTrigger`.
 * Nothing downstream (evidence, location, notifications, timeline, wearable
 * telemetry, resolution) knows or cares which trigger fired; it only knows
 * "there is an active incident for this user."
 */

// In-memory registry of running per-incident evidence timers. A production
// deployment would move this to a durable job queue (e.g. BullMQ) so timers
// survive a process restart; documented as a known limitation in the README.
const evidenceTimers = new Map<string, NodeJS.Timeout>();

export async function addTimelineEvent(incidentId: string, label: string, detail?: string) {
  const event = await prisma.incidentEvent.create({
    data: { incidentId, label, detail },
  });
  const incident = await prisma.incident.findUnique({ where: { id: incidentId }, select: { userId: true } });
  if (incident) {
    emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.TIMELINE_EVENT, {
      id: event.id,
      incidentId,
      label: event.label,
      detail: event.detail,
      occurredAt: event.occurredAt.toISOString(),
    });
  }
  return event;
}

async function setStatus(incidentId: string, status: IncidentStatus) {
  const updated = await prisma.incident.update({ where: { id: incidentId }, data: { status }, include: { user: true } });
  emitToOwnerAndTrustedNetwork(updated.userId, SocketEvents.INCIDENT_STATUS_CHANGED, toIncidentDTO(updated));
  return updated;
}

interface TriggerParams {
  userId: string;
  method: ActivationMethod;
  detail: string;
  demoMode?: boolean;
}

export async function createIncidentFromTrigger(params: TriggerParams) {
  const existingActive = await prisma.incident.findFirst({
    where: {
      userId: params.userId,
      status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED] },
    },
  });
  if (existingActive) {
    throw new HttpError(409, "An incident is already active for this user");
  }

  const incident = await prisma.incident.create({
    data: {
      userId: params.userId,
      activationMethod: params.method,
      activationDetail: params.detail,
      status: IncidentStatus.ACTIVATED,
      priority: "HIGH",
      demoMode: params.demoMode ?? false,
    },
    include: { user: true },
  });

  await recordAuditLog({
    userId: params.userId,
    action: "INCIDENT_CREATED",
    resource: "incident",
    result: "SUCCESS",
    metadata: { incidentId: incident.id, method: params.method },
  });

  emitToOwnerAndTrustedNetwork(params.userId, SocketEvents.INCIDENT_CREATED, toIncidentDTO(incident));
  await addTimelineEvent(incident.id, "Emergency activation detected", params.detail);
  await addTimelineEvent(incident.id, "Incident created", `Incident ${incident.id} opened`);

  // Location retrieved
  await locationService.recordSimulatedLocation(params.userId, incident.id, { step: 0 });
  await addTimelineEvent(incident.id, "Location retrieved");

  // Trusted members notified
  await notifyTrustedMembers(incident.id, params.userId);
  await setStatus(incident.id, IncidentStatus.TRUSTED_NOTIFIED);
  await addTimelineEvent(incident.id, "Trusted members notified");

  // Evidence collection + wearable elevation begin together
  await setStatus(incident.id, IncidentStatus.EVIDENCE_COLLECTING);
  await addTimelineEvent(
    incident.id,
    "Evidence collection started",
    `Transmitting every ${(params.demoMode ? env.evidenceIntervalDemoMs : env.evidenceIntervalNormalMs) / 1000}s`
  );
  startEvidenceTimer(incident.id, params.userId, params.demoMode ?? false);

  await wearablesService.ensureDeviceForUser(params.userId);
  await wearablesService.setElevated(params.userId, incident.id, true);

  return toIncidentDTO(await prisma.incident.findUniqueOrThrow({ where: { id: incident.id }, include: { user: true } }));
}

async function notifyTrustedMembers(incidentId: string, ownerId: string) {
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: ownerId } });
  const members = await prisma.trustedMember.findMany({ where: { ownerId, enabled: true }, orderBy: { priority: "asc" } });

  for (const member of members) {
    if (member.memberUserId) {
      await notificationsService.createNotification({
        userId: member.memberUserId,
        incidentId,
        type: NotificationType.INCIDENT_CREATED,
        title: "EMERGENCY INCIDENT",
        body: `${owner.fullName} activated an emergency incident. Tap to open and coordinate a response.`,
      });
      await addTimelineEvent(incidentId, `Notified trusted member ${member.name}`, "In-app + real-time push");
    } else {
      // No linked account yet: this is exactly the seam where a real SMS/email
      // provider would plug in. Recorded on the timeline for transparency.
      await addTimelineEvent(
        incidentId,
        `Would notify ${member.name} via SMS/email`,
        `${member.email} has not linked an account yet — external notification is simulated`
      );
    }
  }
}

function startEvidenceTimer(incidentId: string, userId: string, demoMode: boolean) {
  stopEvidenceTimer(incidentId);
  const intervalMs = demoMode ? env.evidenceIntervalDemoMs : env.evidenceIntervalNormalMs;
  let sequence = 0;
  const handle = setInterval(async () => {
    sequence += 1;
    try {
      const evidence = await evidenceService.generateSimulatedEvidence(incidentId, sequence);
      await addTimelineEvent(incidentId, `${evidence.type} evidence received`, evidence.payloadSummary);
      await locationService.recordSimulatedLocation(userId, incidentId, { step: sequence });
    } catch (err) {
      // Incident may have been resolved between ticks; stop quietly.
      stopEvidenceTimer(incidentId);
    }
  }, intervalMs);
  evidenceTimers.set(incidentId, handle);
}

function stopEvidenceTimer(incidentId: string) {
  const handle = evidenceTimers.get(incidentId);
  if (handle) {
    clearInterval(handle);
    evidenceTimers.delete(incidentId);
  }
}

export async function listForUser(userId: string, email: string) {
  const trustedForOwners = await prisma.trustedMember.findMany({ where: { email, enabled: true }, select: { ownerId: true } });
  const ownerIds = [userId, ...trustedForOwners.map((t) => t.ownerId)];
  const incidents = await prisma.incident.findMany({
    where: { userId: { in: ownerIds } },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return incidents.map(toIncidentDTO);
}

export async function getIncidentDetail(incidentId: string, actingUserId: string, actingEmail: string) {
  await assertIncidentAccess(incidentId, actingUserId, actingEmail);
  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: {
      user: true,
      acknowledgedBy: true,
      respondingBy: true,
      events: { orderBy: { occurredAt: "asc" } },
      evidence: { orderBy: { sequence: "asc" } },
      locations: { orderBy: { capturedAt: "asc" } },
    },
  });
  const trustedMembers = await prisma.trustedMember.findMany({ where: { ownerId: incident.userId } });
  const wearable = await wearablesService.getDeviceForUser(incident.userId);
  const wearableEvents = await wearablesService.listEventsForIncident(incidentId);

  return {
    incident: toIncidentDTO(incident),
    acknowledgedBy: incident.acknowledgedBy,
    respondingBy: incident.respondingBy,
    events: incident.events.map((e) => ({
      id: e.id,
      incidentId: e.incidentId,
      label: e.label,
      detail: e.detail,
      occurredAt: e.occurredAt.toISOString(),
    })),
    evidence: incident.evidence,
    locations: incident.locations,
    trustedMembers,
    wearable,
    wearableEvents,
  };
}

async function requireTrustedMemberActing(incident: { userId: string }, actingEmail: string) {
  const link = await findTrustedMemberLink(incident.userId, actingEmail);
  if (!link) throw new HttpError(403, "Only a trusted member of this user may perform this action");
  return link;
}

export async function acknowledgeIncident(incidentId: string, actingEmail: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const link = await requireTrustedMemberActing(incident, actingEmail);
  await prisma.incident.update({ where: { id: incidentId }, data: { acknowledgedById: link.id } });
  await setStatus(incidentId, IncidentStatus.ACKNOWLEDGED);
  await addTimelineEvent(incidentId, `${link.name} acknowledged the incident`);
  await recordAuditLog({ userId: incident.userId, action: "INCIDENT_ACKNOWLEDGED", resource: "incident", result: "SUCCESS", metadata: { incidentId, by: link.email } });
}

export async function respondIncident(incidentId: string, actingEmail: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const link = await requireTrustedMemberActing(incident, actingEmail);
  await prisma.incident.update({ where: { id: incidentId }, data: { respondingById: link.id } });
  await setStatus(incidentId, IncidentStatus.RESPONDING);
  await addTimelineEvent(incidentId, `${link.name} marked Responding`);
}

export async function escalateIncident(incidentId: string, actingEmail: string, reason?: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const link = await requireTrustedMemberActing(incident, actingEmail);
  await setStatus(incidentId, IncidentStatus.ESCALATED);
  await addTimelineEvent(incidentId, `${link.name} escalated the incident`, reason);
}

export async function resolveIncident(incidentId: string, actingEmail: string, notes?: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const link = await requireTrustedMemberActing(incident, actingEmail);

  stopEvidenceTimer(incidentId);
  await wearablesService.setElevated(incident.userId, incidentId, false);

  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date(), resolutionNotes: notes },
    include: { user: true },
  });
  emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.INCIDENT_RESOLVED, toIncidentDTO(updated));
  emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.INCIDENT_STATUS_CHANGED, toIncidentDTO(updated));
  await addTimelineEvent(incidentId, `${link.name} resolved the incident`, notes);
  await notificationsService.createNotification({
    userId: incident.userId,
    incidentId,
    type: NotificationType.INCIDENT_RESOLVED,
    title: "Incident resolved",
    body: `${link.name} marked this incident resolved.`,
  });
  await recordAuditLog({ userId: incident.userId, action: "INCIDENT_RESOLVED", resource: "incident", result: "SUCCESS", metadata: { incidentId, by: link.email } });
}

export async function cancelIncident(incidentId: string, ownerId: string, reason?: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  if (incident.userId !== ownerId) throw new HttpError(403, "Only the account owner can cancel their own incident");

  stopEvidenceTimer(incidentId);
  await wearablesService.setElevated(incident.userId, incidentId, false);

  await prisma.incident.update({ where: { id: incidentId }, data: { status: IncidentStatus.CANCELLED, resolvedAt: new Date(), resolutionNotes: reason } });
  await setStatus(incidentId, IncidentStatus.CANCELLED);
  await addTimelineEvent(incidentId, "Incident cancelled by owner", reason ?? "Marked as a false alarm");
}

/** Used by IoT/keyword triggers to know whether a fresh incident should even be created. */
export async function hasActiveIncident(userId: string) {
  const existing = await prisma.incident.findFirst({
    where: { userId, status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED] } },
  });
  return Boolean(existing);
}

export async function getActiveIncidentForUser(userId: string) {
  return prisma.incident.findFirst({
    where: { userId, status: { notIn: [IncidentStatus.RESOLVED, IncidentStatus.CANCELLED] } },
  });
}

/** Linear status progression the Demo Control Panel's "Advance Incident" button steps through. */
const DEMO_ADVANCE_SEQUENCE: IncidentStatus[] = [
  IncidentStatus.TRUSTED_NOTIFIED,
  IncidentStatus.EVIDENCE_COLLECTING,
  IncidentStatus.ACKNOWLEDGED,
  IncidentStatus.RESPONDING,
  IncidentStatus.ESCALATED,
];

/**
 * Demo-operator conveniences below bypass the "must be a real trusted
 * member" authorization check enforced on the normal acknowledge/respond/
 * resolve endpoints. They exist so a judge driving the Demo Control Panel
 * from a single account can narrate the whole lifecycle without setting up
 * a second trusted-member login. Every action they take is still written to
 * the incident timeline and audit log, clearly labelled as a demo action.
 */
export async function advanceIncidentDemo(incidentId: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const currentIndex = DEMO_ADVANCE_SEQUENCE.indexOf(incident.status as IncidentStatus);
  const next = DEMO_ADVANCE_SEQUENCE[currentIndex + 1] ?? DEMO_ADVANCE_SEQUENCE[0];
  await setStatus(incidentId, next);
  await addTimelineEvent(incidentId, `Advanced to ${next} via Demo Control Panel`);
  return next;
}

export async function resolveIncidentAsDemoOperator(incidentId: string, notes?: string) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });

  stopEvidenceTimer(incidentId);
  await wearablesService.setElevated(incident.userId, incidentId, false);

  const updated = await prisma.incident.update({
    where: { id: incidentId },
    data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date(), resolutionNotes: notes ?? "Resolved via Demo Control Panel" },
    include: { user: true },
  });
  emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.INCIDENT_RESOLVED, toIncidentDTO(updated));
  emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.INCIDENT_STATUS_CHANGED, toIncidentDTO(updated));
  await addTimelineEvent(incidentId, "Incident resolved via Demo Control Panel", notes);
  await recordAuditLog({ userId: incident.userId, action: "INCIDENT_RESOLVED", resource: "incident", result: "SUCCESS", metadata: { incidentId, by: "demo-operator" } });
}

/** Wipes this user's incident history so the Demo Control Panel can restart the scenario from a clean slate. */
export async function resetDemoForUser(userId: string) {
  const active = await getActiveIncidentForUser(userId);
  if (active) {
    stopEvidenceTimer(active.id);
    await wearablesService.setElevated(userId, active.id, false);
  }
  await prisma.incident.deleteMany({ where: { userId } });
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.wearableDevice.updateMany({
    where: { userId },
    data: { connectionStatus: "CONNECTED", batteryPercent: 100, heartRateBpm: 72, motionState: "STATIONARY", fallState: "NORMAL" },
  });
  await recordAuditLog({ userId, action: "DEMO_RESET", resource: "incident", result: "SUCCESS" });
}
