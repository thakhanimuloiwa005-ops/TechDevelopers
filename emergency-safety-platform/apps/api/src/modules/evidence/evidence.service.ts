import { prisma } from "../../db/prisma.js";
import { emitToOwnerAndTrustedNetwork } from "../../realtime/socket.js";
import { SocketEvents, EvidenceType, EvidenceStatus } from "@esp/types";

const EVIDENCE_CYCLE: { type: EvidenceType; sourceDevice: string; summary: (seq: number) => string }[] = [
  { type: EvidenceType.AUDIO, sourceDevice: "Phone Microphone", summary: (s) => `Audio segment #${s} captured (12s clip, simulated)` },
  { type: EvidenceType.LOCATION, sourceDevice: "Wearable GPS (SIMULATED)", summary: (s) => `Location fix #${s} recorded` },
  { type: EvidenceType.SENSOR, sourceDevice: "SafeWatch Demo (SIMULATED)", summary: (s) => `Wearable telemetry snapshot #${s}` },
  { type: EvidenceType.IMAGE, sourceDevice: "Phone Camera", summary: (s) => `Image frame #${s} captured (simulated)` },
];

/**
 * Generates one evidence record for the ~10-second transmission cycle.
 * All payloads here are DEMO/SIMULATED stand-ins — real audio/image/video
 * bytes would be written to object storage and referenced by URL instead
 * of the text summary used here.
 */
export async function generateSimulatedEvidence(incidentId: string, sequence: number) {
  const spec = EVIDENCE_CYCLE[(sequence - 1) % EVIDENCE_CYCLE.length];
  const row = await prisma.evidence.create({
    data: {
      incidentId,
      type: spec.type,
      status: EvidenceStatus.RECEIVED,
      sourceDevice: spec.sourceDevice,
      simulated: true,
      payloadSummary: spec.summary(sequence),
      sequence,
    },
  });

  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId }, select: { userId: true } });
  emitToOwnerAndTrustedNetwork(incident.userId, SocketEvents.EVIDENCE_RECEIVED, row);
  return row;
}

export async function listForIncident(incidentId: string) {
  return prisma.evidence.findMany({ where: { incidentId }, orderBy: { sequence: "asc" } });
}
