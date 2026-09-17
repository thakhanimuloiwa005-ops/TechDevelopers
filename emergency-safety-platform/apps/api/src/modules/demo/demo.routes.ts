import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { ActivationMethod, WearableEventType } from "@esp/types";
import { prisma } from "../../db/prisma.js";
import * as incidentService from "../incidents/incident.service.js";
import * as evidenceService from "../evidence/evidence.service.js";
import * as locationService from "../location/location.service.js";
import { triggerWearableEvent } from "../wearables/wearables.orchestrator.js";

/**
 * The Hackathon Demo Control Panel. Every button here is a thin wrapper
 * around the exact same services the "real" flows use (keyword config,
 * the Incident Management Engine, the IoT simulator) — nothing here is a
 * separate fake code path, so demoing the product IS demoing the real
 * architecture.
 */
export const demoRouter = Router();
demoRouter.use(requireAuth);

async function requireActiveIncident(userId: string) {
  const incident = await incidentService.getActiveIncidentForUser(userId);
  if (!incident) throw new HttpError(400, "No active incident — trigger one first (keyword, wearable button, or fall).");
  return incident;
}

demoRouter.post(
  "/keyword",
  asyncHandler(async (req, res) => {
    const userId = req.userId!;
    if (await incidentService.hasActiveIncident(userId)) {
      throw new HttpError(409, "An incident is already active");
    }
    const keyword = await prisma.emergencyKeyword.findFirst({ where: { userId } });
    if (!keyword || !keyword.enabled) {
      throw new HttpError(400, "No enabled emergency keyword configured for this account");
    }
    const incident = await incidentService.createIncidentFromTrigger({
      userId,
      method: ActivationMethod.KEYWORD,
      detail: `Keyword detected: ${keyword.keyword}`,
      demoMode: true,
    });
    res.status(201).json(incident);
  })
);

demoRouter.post(
  "/wearable-button",
  asyncHandler(async (req, res) => {
    res.json(await triggerWearableEvent(req.userId!, WearableEventType.EMERGENCY_BUTTON, true));
  })
);

demoRouter.post(
  "/fall",
  asyncHandler(async (req, res) => {
    res.json(await triggerWearableEvent(req.userId!, WearableEventType.FALL, true));
  })
);

const sensorEventShortcuts: Record<string, WearableEventType> = {
  "heart-rate": WearableEventType.HIGH_HEART_RATE,
  movement: WearableEventType.MOVEMENT_DETECTED,
  "gps-update": WearableEventType.GPS_UPDATE,
  "low-battery": WearableEventType.LOW_BATTERY,
  "device-disconnect": WearableEventType.DEVICE_DISCONNECTED,
  "device-reconnect": WearableEventType.DEVICE_RECONNECTED,
};

for (const [path, type] of Object.entries(sensorEventShortcuts)) {
  demoRouter.post(
    `/${path}`,
    asyncHandler(async (req, res) => {
      res.json(await triggerWearableEvent(req.userId!, type, true));
    })
  );
}

demoRouter.post(
  "/evidence",
  asyncHandler(async (req, res) => {
    const incident = await requireActiveIncident(req.userId!);
    const count = await prisma.evidence.count({ where: { incidentId: incident.id } });
    const evidence = await evidenceService.generateSimulatedEvidence(incident.id, count + 1);
    await incidentService.addTimelineEvent(incident.id, `${evidence.type} evidence received (manual demo trigger)`, evidence.payloadSummary);
    res.json(evidence);
  })
);

demoRouter.post(
  "/location-move",
  asyncHandler(async (req, res) => {
    const incident = await requireActiveIncident(req.userId!);
    const count = await prisma.location.count({ where: { incidentId: incident.id } });
    const location = await locationService.recordSimulatedLocation(req.userId!, incident.id, { step: count + 1 });
    await incidentService.addTimelineEvent(incident.id, "Location update received (manual demo trigger)");
    res.json(location);
  })
);

demoRouter.post(
  "/advance",
  asyncHandler(async (req, res) => {
    const incident = await requireActiveIncident(req.userId!);
    const next = await incidentService.advanceIncidentDemo(incident.id);
    res.json({ status: next });
  })
);

const resolveSchema = z.object({ notes: z.string().optional() });
demoRouter.post(
  "/resolve",
  asyncHandler(async (req, res) => {
    const incident = await requireActiveIncident(req.userId!);
    const { notes } = resolveSchema.parse(req.body ?? {});
    await incidentService.resolveIncidentAsDemoOperator(incident.id, notes);
    res.status(204).send();
  })
);

demoRouter.post(
  "/reset",
  asyncHandler(async (req, res) => {
    await incidentService.resetDemoForUser(req.userId!);
    res.status(204).send();
  })
);
