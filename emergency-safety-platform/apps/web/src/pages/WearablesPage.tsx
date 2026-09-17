import { useEffect, useState } from "react";
import type { WearableDeviceDTO } from "@esp/types";
import { SocketEvents, WearableEventType } from "@esp/types";
import { apiClient } from "../api/client.js";
import { getSocket } from "../api/socket.js";
import { WearablePanel } from "../components/WearablePanel.js";

interface WearableEventRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

const EVENT_OPTIONS: { type: WearableEventType; label: string }[] = [
  { type: WearableEventType.FALL, label: "Fall" },
  { type: WearableEventType.HIGH_HEART_RATE, label: "High heart rate" },
  { type: WearableEventType.EMERGENCY_BUTTON, label: "Emergency button" },
  { type: WearableEventType.MOVEMENT_DETECTED, label: "Movement detected" },
  { type: WearableEventType.GPS_UPDATE, label: "GPS update" },
  { type: WearableEventType.LOW_BATTERY, label: "Low battery" },
  { type: WearableEventType.DEVICE_DISCONNECTED, label: "Device disconnected" },
  { type: WearableEventType.DEVICE_RECONNECTED, label: "Device reconnected" },
];

export function WearablesPage() {
  const [device, setDevice] = useState<WearableDeviceDTO | null>(null);
  const [events, setEvents] = useState<WearableEventRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const res = await apiClient.get("/wearables/me");
    setDevice(res.data.device);
    setEvents(res.data.events);
  }

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;
    const handler = () => refresh();
    const evts = [SocketEvents.SENSOR_UPDATED, SocketEvents.FALL_DETECTED, SocketEvents.EMERGENCY_BUTTON_PRESSED, SocketEvents.WEARABLE_CONNECTED, SocketEvents.WEARABLE_DISCONNECTED];
    evts.forEach((e) => socket.on(e, handler));
    return () => evts.forEach((e) => socket.off(e, handler));
  }, []);

  async function simulate(type: WearableEventType) {
    setBusy(true);
    try {
      await apiClient.post("/wearables/simulate", { type });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">Registered Device</h2>
          <span className="badge bg-slate-100 text-slate-500">DEMO SENSOR</span>
        </div>
        <WearablePanel device={device} />

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Simulate Sensor Event</h3>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_OPTIONS.map((opt) => (
              <button key={opt.type} className="btn-outline text-xs" disabled={busy} onClick={() => simulate(opt.type)}>
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Fall and Emergency Button events will open a new incident automatically if one isn't already active.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Recent Telemetry &amp; Events</h2>
        {events.length === 0 && <p className="text-sm text-slate-400">No events yet.</p>}
        <ul className="max-h-[32rem] space-y-1 overflow-y-auto text-sm">
          {events.map((event) => (
            <li key={event.id} className="flex justify-between border-b border-slate-100 py-1.5">
              <span className="font-medium text-slate-700">{event.type.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-400">{new Date(event.occurredAt).toLocaleTimeString()}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
