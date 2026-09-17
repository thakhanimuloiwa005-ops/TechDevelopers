import { prisma } from "../../db/prisma.js";
import { emitToOwnerAndTrustedNetwork } from "../../realtime/socket.js";
import { SocketEvents, type LocationDTO } from "@esp/types";
import type { Location } from "@prisma/client";

function toDTO(row: Location): LocationDTO {
  return {
    id: row.id,
    incidentId: row.incidentId,
    userId: row.userId,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyMeters: row.accuracyMeters,
    simulated: row.simulated,
    capturedAt: row.capturedAt.toISOString(),
  };
}

/** Deterministic per-user "home base" so a demo account always starts in the same plausible spot. */
function baseCoordsForUser(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  const lat = -26.2041 + ((hash % 1000) / 1000 - 0.5) * 0.2; // Johannesburg-area demo bounding box
  const lng = 28.0473 + (((hash >> 10) % 1000) / 1000 - 0.5) * 0.2;
  return { lat, lng };
}

export async function recordSimulatedLocation(
  userId: string,
  incidentId: string | null,
  opts: { step?: number } = {}
): Promise<LocationDTO> {
  const last = incidentId
    ? await prisma.location.findFirst({ where: { incidentId }, orderBy: { capturedAt: "desc" } })
    : null;

  const base = baseCoordsForUser(userId);
  const step = opts.step ?? 0;
  // Simulated GPS walk: small deterministic-ish drift each tick plus jitter.
  const latitude = (last?.latitude ?? base.lat) + (Math.sin(step * 1.7) * 0.0006 + (Math.random() - 0.5) * 0.0003);
  const longitude = (last?.longitude ?? base.lng) + (Math.cos(step * 1.3) * 0.0006 + (Math.random() - 0.5) * 0.0003);

  const row = await prisma.location.create({
    data: {
      userId,
      incidentId,
      latitude,
      longitude,
      accuracyMeters: 8 + Math.random() * 12,
      simulated: true,
    },
  });

  const dto = toDTO(row);
  emitToOwnerAndTrustedNetwork(userId, SocketEvents.LOCATION_UPDATED, dto);
  return dto;
}

export async function getLatestForIncident(incidentId: string): Promise<LocationDTO | null> {
  const row = await prisma.location.findFirst({ where: { incidentId }, orderBy: { capturedAt: "desc" } });
  return row ? toDTO(row) : null;
}

export async function getHistoryForIncident(incidentId: string): Promise<LocationDTO[]> {
  const rows = await prisma.location.findMany({ where: { incidentId }, orderBy: { capturedAt: "asc" } });
  return rows.map(toDTO);
}
