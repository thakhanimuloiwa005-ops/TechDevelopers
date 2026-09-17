import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { IncidentDTO } from "@esp/types";
import { SocketEvents } from "@esp/types";
import { apiClient } from "../api/client.js";
import { getSocket } from "../api/socket.js";
import { StatusBadge } from "../components/StatusBadge.js";

interface DemoAction {
  key: string;
  label: string;
  path: string;
  variant?: "danger";
}

const ACTIONS: DemoAction[] = [
  { key: "keyword", label: "Simulate Keyword Detection", path: "/demo/keyword", variant: "danger" },
  { key: "wearable-button", label: "Simulate Wearable Button", path: "/demo/wearable-button", variant: "danger" },
  { key: "fall", label: "Simulate Fall", path: "/demo/fall", variant: "danger" },
  { key: "heart-rate", label: "Simulate High Heart Rate", path: "/demo/heart-rate" },
  { key: "location-move", label: "Simulate Location Movement", path: "/demo/location-move" },
  { key: "evidence", label: "Simulate Evidence", path: "/demo/evidence" },
  { key: "device-disconnect", label: "Simulate Device Disconnect", path: "/demo/device-disconnect" },
  { key: "device-reconnect", label: "Simulate Device Reconnect", path: "/demo/device-reconnect" },
  { key: "low-battery", label: "Simulate Low Battery", path: "/demo/low-battery" },
  { key: "advance", label: "Advance Incident", path: "/demo/advance" },
  { key: "resolve", label: "Resolve Incident", path: "/demo/resolve" },
];

export function DemoModePage() {
  const [activeIncident, setActiveIncident] = useState<IncidentDTO | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function pushLog(line: string) {
    setLog((prev) => [`${new Date().toLocaleTimeString()} — ${line}`, ...prev].slice(0, 30));
  }

  async function refreshActive() {
    const res = await apiClient.get<IncidentDTO[]>("/incidents");
    const active = res.data.find((i) => !["RESOLVED", "CANCELLED"].includes(i.status)) ?? null;
    setActiveIncident(active);
  }

  useEffect(() => {
    refreshActive();
    const socket = getSocket();
    if (!socket) return;
    const subs: [string, (payload: unknown) => void][] = [
      [SocketEvents.INCIDENT_CREATED, () => pushLog("Incident created")],
      [SocketEvents.TIMELINE_EVENT, (p) => pushLog((p as { label: string }).label)],
      [SocketEvents.EVIDENCE_RECEIVED, (p) => pushLog(`Evidence received: ${(p as { payloadSummary: string }).payloadSummary}`)],
      [SocketEvents.INCIDENT_STATUS_CHANGED, (p) => pushLog(`Status changed: ${(p as { status: string }).status}`)],
      [SocketEvents.INCIDENT_RESOLVED, () => pushLog("Incident resolved")],
      [SocketEvents.FALL_DETECTED, () => pushLog("Fall detected (SIMULATED)")],
      [SocketEvents.EMERGENCY_BUTTON_PRESSED, () => pushLog("Emergency button pressed (SIMULATED)")],
    ];
    subs.forEach(([event, fn]) => socket.on(event, fn));
    const refreshHandler = () => refreshActive();
    socket.on(SocketEvents.INCIDENT_CREATED, refreshHandler);
    socket.on(SocketEvents.INCIDENT_STATUS_CHANGED, refreshHandler);
    socket.on(SocketEvents.INCIDENT_RESOLVED, refreshHandler);
    return () => {
      subs.forEach(([event, fn]) => socket.off(event, fn));
      socket.off(SocketEvents.INCIDENT_CREATED, refreshHandler);
      socket.off(SocketEvents.INCIDENT_STATUS_CHANGED, refreshHandler);
      socket.off(SocketEvents.INCIDENT_RESOLVED, refreshHandler);
    };
  }, []);

  async function run(action: DemoAction) {
    setBusy(action.key);
    setError(null);
    try {
      await apiClient.post(action.path);
      pushLog(`${action.label} triggered`);
      await refreshActive();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function resetDemo() {
    setBusy("reset");
    try {
      await apiClient.post("/demo/reset");
      setLog([]);
      await refreshActive();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="card border-slate-900 bg-slate-900 text-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">Hackathon Demo Control Panel</h1>
            <p className="text-sm text-slate-300">
              Every button calls the same API the real product uses — nothing here is a separate mock path.
            </p>
          </div>
          <button className="btn-outline bg-white" disabled={busy === "reset"} onClick={resetDemo}>
            Reset Demo
          </button>
        </div>
      </section>

      {activeIncident ? (
        <section className="card flex items-center justify-between border-emergency-200 bg-emergency-50">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Active incident</p>
            <p className="font-semibold text-slate-800">{activeIncident.activationMethod.replace(/_/g, " ")}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={activeIncident.status} />
            <Link className="btn-outline" to={`/incidents/${activeIncident.id}`}>
              Open incident
            </Link>
          </div>
        </section>
      ) : (
        <section className="card bg-slate-50 text-sm text-slate-500">No active incident. Start with "Simulate Keyword Detection", "Simulate Wearable Button", or "Simulate Fall".</section>
      )}

      {error && <p className="card border-emergency-200 text-emergency-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Demo Controls</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ACTIONS.map((action) => (
              <button
                key={action.key}
                className={action.variant === "danger" ? "btn-danger text-xs" : "btn-outline text-xs"}
                disabled={busy === action.key}
                onClick={() => run(action)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Live Event Log</h2>
          <ul className="h-80 space-y-1 overflow-y-auto text-xs text-slate-600">
            {log.map((line, i) => (
              <li key={i} className="border-b border-slate-100 py-1">
                {line}
              </li>
            ))}
            {log.length === 0 && <li className="text-slate-400">Events will appear here in real time.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
