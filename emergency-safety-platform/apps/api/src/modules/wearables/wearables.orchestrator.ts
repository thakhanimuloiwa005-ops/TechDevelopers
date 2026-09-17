import { WearableEventType, ActivationMethod } from "@esp/types";
import * as wearablesService from "./wearables.service.js";
import * as incidentService from "../incidents/incident.service.js";

/**
 * Bridges the wearable simulator to the Incident Management Engine.
 * Kept out of wearables.service.ts / incident.service.ts to avoid a
 * circular import: incident.service already depends on wearables.service
 * (to elevate telemetry once an incident exists), so the reverse edge
 * ("this sensor event should open an incident") lives here instead.
 */
const TIMELINE_LABELS: Partial<Record<WearableEventType, string>> = {
  [WearableEventType.HIGH_HEART_RATE]: "Elevated heart rate detected on wearable",
  [WearableEventType.MOVEMENT_DETECTED]: "Sudden movement detected on wearable",
  [WearableEventType.GPS_UPDATE]: "Wearable GPS fix updated",
  [WearableEventType.LOW_BATTERY]: "Wearable battery critically low",
  [WearableEventType.DEVICE_DISCONNECTED]: "Wearable lost connection",
  [WearableEventType.DEVICE_RECONNECTED]: "Wearable reconnected",
};

export async function triggerWearableEvent(userId: string, type: WearableEventType, demoMode = false) {
  const activeBefore = await incidentService.getActiveIncidentForUser(userId);
  const result = await wearablesService.applyManualEvent(userId, type);

  const opensIncident = type === WearableEventType.FALL || type === WearableEventType.EMERGENCY_BUTTON;
  if (opensIncident && !activeBefore) {
    const method = type === WearableEventType.FALL ? ActivationMethod.FALL_DETECTION : ActivationMethod.WEARABLE_BUTTON;
    const detail =
      type === WearableEventType.FALL
        ? "Simulated fall detected by wearable (SIMULATED DEVICE)"
        : "Wearable emergency button pressed (SIMULATED DEVICE)";
    await incidentService.createIncidentFromTrigger({ userId, method, detail, demoMode });
  } else if (activeBefore) {
    // Incident already open: record this sensor reading on its timeline too,
    // even for events (like a heart-rate spike) that don't open a new one.
    const label = TIMELINE_LABELS[type] ?? `${type} event received`;
    await incidentService.addTimelineEvent(activeBefore.id, label, "SIMULATED DEVICE reading");
  }

  return result;
}
