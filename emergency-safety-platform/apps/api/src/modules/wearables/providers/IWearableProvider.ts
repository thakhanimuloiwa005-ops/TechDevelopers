import type { WearableEventType } from "@esp/types";

export interface WearableTelemetryState {
  batteryPercent: number;
  heartRateBpm: number;
  motionState: string;
  fallState: string;
  connectionStatus: string;
}

export interface TriggeredEventResult {
  patch: Partial<WearableTelemetryState>;
  payload: Record<string, unknown>;
}

/**
 * Abstraction boundary for "where the telemetry actually comes from."
 *
 * `MockWearableProvider` is the only implementation today and every value it
 * returns is synthetic. A future `BluetoothWearableProvider` or
 * `VendorApiWearableProvider` could implement this exact interface — reading
 * real hardware/BLE/vendor-API data instead of generating it — and nothing
 * in wearables.service.ts, wearables.simulator.ts, or the Incident
 * Management Engine would need to change.
 */
export interface IWearableProvider {
  /** Called on every background telemetry tick. */
  nextTelemetry(current: WearableTelemetryState, elevated: boolean): WearableTelemetryState;
  /** Called when a specific sensor event is triggered (manually or by simulator). */
  triggerEvent(type: WearableEventType, current: WearableTelemetryState): TriggeredEventResult;
}
