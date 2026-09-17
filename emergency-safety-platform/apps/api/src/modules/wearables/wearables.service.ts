import { prisma } from "../../db/prisma.js";
import { emitToOwnerAndTrustedNetwork } from "../../realtime/socket.js";
import { SocketEvents, WearableEventType } from "@esp/types";
import { mockWearableProvider } from "./providers/MockWearableProvider.js";
import type { WearableDevice, Prisma } from "@prisma/client";
import type { WearableDeviceDTO } from "@esp/types";
import type { WearableTelemetryState } from "./providers/IWearableProvider.js";

/**
 * The provider interface deliberately speaks in plain strings so it has no
 * compile-time dependency on Prisma's generated enums. The values it
 * produces are always members of the matching Prisma enum (kept in sync via
 * @esp/types), so this cast is safe — it exists purely to bridge the two
 * type systems at the persistence boundary.
 */
function asDeviceUpdate(patch: Partial<WearableTelemetryState>): Prisma.WearableDeviceUpdateInput {
  return patch as Prisma.WearableDeviceUpdateInput;
}

/** userId -> incidentId currently "elevating" this user's wearable telemetry cadence/intensity. */
const elevated = new Map<string, string>();

export function isElevated(userId: string) {
  return elevated.get(userId) ?? null;
}

export async function setElevated(userId: string, incidentId: string | null, on: boolean) {
  if (on && incidentId) elevated.set(userId, incidentId);
  else elevated.delete(userId);
}

function toDTO(row: WearableDevice): WearableDeviceDTO {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    deviceType: row.deviceType,
    connectionStatus: row.connectionStatus as WearableDeviceDTO["connectionStatus"],
    batteryPercent: row.batteryPercent,
    heartRateBpm: row.heartRateBpm,
    motionState: row.motionState as WearableDeviceDTO["motionState"],
    fallState: row.fallState as WearableDeviceDTO["fallState"],
    lastTelemetryAt: row.lastTelemetryAt ? row.lastTelemetryAt.toISOString() : null,
    simulated: row.simulated,
  };
}

export async function ensureDeviceForUser(userId: string) {
  const existing = await prisma.wearableDevice.findFirst({ where: { userId } });
  if (existing) return existing;
  return prisma.wearableDevice.create({ data: { userId, name: "SafeWatch Demo", deviceType: "Smartwatch" } });
}

export async function getDeviceForUser(userId: string): Promise<WearableDeviceDTO | null> {
  const row = await prisma.wearableDevice.findFirst({ where: { userId } });
  return row ? toDTO(row) : null;
}

export async function listAllConnectedDevices() {
  return prisma.wearableDevice.findMany();
}

export async function listEventsForIncident(incidentId: string) {
  return prisma.wearableEvent.findMany({ where: { incidentId }, orderBy: { occurredAt: "asc" } });
}

export async function listRecentEventsForUser(userId: string, limit = 30) {
  const device = await ensureDeviceForUser(userId);
  return prisma.wearableEvent.findMany({ where: { deviceId: device.id }, orderBy: { occurredAt: "desc" }, take: limit });
}

/** Background telemetry tick driven by the IoT Simulator's interval loop. */
export async function applyTelemetryTick(device: WearableDevice) {
  const incidentId = elevated.get(device.userId) ?? null;
  const next = mockWearableProvider.nextTelemetry(
    {
      batteryPercent: device.batteryPercent,
      heartRateBpm: device.heartRateBpm ?? 72,
      motionState: device.motionState,
      fallState: device.fallState,
      connectionStatus: device.connectionStatus,
    },
    Boolean(incidentId)
  );

  const updated = await prisma.wearableDevice.update({
    where: { id: device.id },
    data: { ...asDeviceUpdate(next), lastTelemetryAt: new Date() },
  });

  await prisma.wearableEvent.create({
    data: { deviceId: device.id, incidentId, type: "TELEMETRY_TICK", payload: next as unknown as Prisma.InputJsonValue },
  });

  emitToOwnerAndTrustedNetwork(device.userId, SocketEvents.SENSOR_UPDATED, toDTO(updated));
  return updated;
}

/** Manual/demo-triggered sensor event (the "SIMULATE SENSOR EVENT" control). */
export async function applyManualEvent(userId: string, type: WearableEventType) {
  const device = await ensureDeviceForUser(userId);
  const incidentId = elevated.get(userId) ?? null;
  const { patch, payload } = mockWearableProvider.triggerEvent(type, {
    batteryPercent: device.batteryPercent,
    heartRateBpm: device.heartRateBpm ?? 72,
    motionState: device.motionState,
    fallState: device.fallState,
    connectionStatus: device.connectionStatus,
  });

  const updated = await prisma.wearableDevice.update({ where: { id: device.id }, data: asDeviceUpdate(patch) });
  const event = await prisma.wearableEvent.create({ data: { deviceId: device.id, incidentId, type, payload: payload as Prisma.InputJsonValue } });

  const dto = toDTO(updated);
  emitToOwnerAndTrustedNetwork(userId, SocketEvents.SENSOR_UPDATED, dto);
  if (type === WearableEventType.FALL) emitToOwnerAndTrustedNetwork(userId, SocketEvents.FALL_DETECTED, dto);
  if (type === WearableEventType.EMERGENCY_BUTTON) emitToOwnerAndTrustedNetwork(userId, SocketEvents.EMERGENCY_BUTTON_PRESSED, dto);
  if (type === WearableEventType.DEVICE_DISCONNECTED) emitToOwnerAndTrustedNetwork(userId, SocketEvents.WEARABLE_DISCONNECTED, dto);
  if (type === WearableEventType.DEVICE_RECONNECTED) emitToOwnerAndTrustedNetwork(userId, SocketEvents.WEARABLE_CONNECTED, dto);

  return { device: dto, event, shouldTriggerIncident: type === WearableEventType.FALL || type === WearableEventType.EMERGENCY_BUTTON };
}
