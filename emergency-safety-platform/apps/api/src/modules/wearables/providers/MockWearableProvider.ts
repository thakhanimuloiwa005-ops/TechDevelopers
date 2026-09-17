import { WearableEventType, MotionState, FallState, WearableConnectionStatus } from "@esp/types";
import type { IWearableProvider, WearableTelemetryState, TriggeredEventResult } from "./IWearableProvider.js";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const MOTION_STATES = [MotionState.STATIONARY, MotionState.WALKING, MotionState.RUNNING, MotionState.NO_MOVEMENT];

/** SIMULATED DEVICE data generator. Every value below is synthetic. */
export class MockWearableProvider implements IWearableProvider {
  nextTelemetry(current: WearableTelemetryState, elevated: boolean): WearableTelemetryState {
    const baseline = elevated ? 95 : 75;
    const drift = (Math.random() - 0.45) * (elevated ? 18 : 8);
    const heartRateBpm = Math.round(clamp(current.heartRateBpm * 0.6 + baseline * 0.4 + drift, 58, 175));

    const batteryPercent = clamp(current.batteryPercent - (elevated ? 0.6 : 0.15), 1, 100);

    const motionState =
      elevated && Math.random() < 0.15
        ? MotionState.SUDDEN_MOVEMENT
        : MOTION_STATES[Math.floor(Math.random() * MOTION_STATES.length)];

    const connectionStatus =
      current.connectionStatus === WearableConnectionStatus.DISCONNECTED
        ? WearableConnectionStatus.DISCONNECTED
        : Math.random() < 0.03
          ? WearableConnectionStatus.WEAK
          : WearableConnectionStatus.CONNECTED;

    return {
      batteryPercent: Math.round(batteryPercent),
      heartRateBpm,
      motionState,
      fallState: current.fallState === FallState.CONFIRMED_FALL ? FallState.CONFIRMED_FALL : FallState.NORMAL,
      connectionStatus,
    };
  }

  triggerEvent(type: WearableEventType, current: WearableTelemetryState): TriggeredEventResult {
    switch (type) {
      case WearableEventType.FALL:
        return {
          patch: { fallState: FallState.CONFIRMED_FALL, motionState: MotionState.SUDDEN_MOVEMENT },
          payload: { fallState: FallState.CONFIRMED_FALL, simulated: true },
        };
      case WearableEventType.HIGH_HEART_RATE: {
        const heartRateBpm = 150 + Math.round(Math.random() * 30);
        return { patch: { heartRateBpm }, payload: { heartRateBpm, simulated: true } };
      }
      case WearableEventType.EMERGENCY_BUTTON:
        return { patch: {}, payload: { pressed: true, simulated: true } };
      case WearableEventType.MOVEMENT_DETECTED:
        return { patch: { motionState: MotionState.SUDDEN_MOVEMENT }, payload: { motionState: MotionState.SUDDEN_MOVEMENT } };
      case WearableEventType.GPS_UPDATE:
        return { patch: {}, payload: { gps: "updated", simulated: true } };
      case WearableEventType.LOW_BATTERY:
        return { patch: { batteryPercent: 8 }, payload: { batteryPercent: 8 } };
      case WearableEventType.DEVICE_DISCONNECTED:
        return { patch: { connectionStatus: WearableConnectionStatus.DISCONNECTED }, payload: { connectionStatus: WearableConnectionStatus.DISCONNECTED } };
      case WearableEventType.DEVICE_RECONNECTED:
        return { patch: { connectionStatus: WearableConnectionStatus.CONNECTED }, payload: { connectionStatus: WearableConnectionStatus.CONNECTED } };
      default:
        return { patch: {}, payload: {} };
    }
  }
}

export const mockWearableProvider = new MockWearableProvider();
