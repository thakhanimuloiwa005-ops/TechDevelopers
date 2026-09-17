import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import * as wearablesService from "./wearables.service.js";
import { WearableConnectionStatus } from "@esp/types";

/**
 * The "IoT Simulator" layer from the architecture diagram:
 *
 *   Simulated Wearable -> IoT Simulator -> IoT Event Processor -> Backend
 *   -> Incident Service -> WebSocket -> Clients
 *
 * This class is the scheduler. It ticks every connected simulated device on
 * an interval and hands each tick to wearables.service (the "IoT Event
 * Processor"), which persists the reading and pushes it out over the
 * socket. Swap this class's data source for a real MQTT/BLE listener later
 * and nothing downstream changes.
 */
export class IoTSimulator {
  private handle: NodeJS.Timeout | null = null;

  start() {
    if (this.handle) return;
    this.handle = setInterval(() => this.tick().catch((err) => logger.error("IoT simulator tick failed", { err: String(err) })), env.wearableTelemetryIntervalMs);
    logger.info("IoT simulator started", { intervalMs: env.wearableTelemetryIntervalMs });
  }

  stop() {
    if (this.handle) clearInterval(this.handle);
    this.handle = null;
  }

  private async tick() {
    const devices = await wearablesService.listAllConnectedDevices();
    for (const device of devices) {
      if (device.connectionStatus === WearableConnectionStatus.DISCONNECTED) continue;
      await wearablesService.applyTelemetryTick(device);
    }
  }
}

export const iotSimulator = new IoTSimulator();
