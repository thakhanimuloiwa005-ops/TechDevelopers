import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { SocketEvents, type EvidenceDTO, type WearableDeviceDTO } from "@esp/types";
import { apiClient } from "../api/client.js";
import { getSocket } from "../api/socket.js";
import { useAuth } from "../auth/AuthContext.js";
import { StatusBadge } from "../components/StatusBadge.js";
import { Timeline } from "../components/Timeline.js";
import { EvidenceList } from "../components/EvidenceList.js";
import { WearablePanel } from "../components/WearablePanel.js";
import { IncidentMap } from "../components/IncidentMap.js";

interface IncidentDetail {
  incident: {
    id: string;
    userId: string;
    user?: { fullName: string; phone: string | null };
    activationMethod: string;
    activationDetail: string;
    status: string;
    priority: string;
    createdAt: string;
    resolvedAt: string | null;
    resolutionNotes: string | null;
  };
  events: { id: string; incidentId: string; label: string; detail: string | null; occurredAt: string }[];
  evidence: EvidenceDTO[];
  locations: { latitude: number; longitude: number; capturedAt: string }[];
  trustedMembers: { id: string; name: string; email: string; priority: number; enabled: boolean }[];
  wearable: WearableDeviceDTO | null;
}

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const res = await apiClient.get(`/incidents/${id}`);
      setData(res.data);
    } catch {
      setError("You do not have access to this incident, or it no longer exists.");
    }
  }, [id]);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket || !id) return;
    const handler = () => refresh();
    const events = [
      SocketEvents.TIMELINE_EVENT,
      SocketEvents.EVIDENCE_RECEIVED,
      SocketEvents.LOCATION_UPDATED,
      SocketEvents.INCIDENT_STATUS_CHANGED,
      SocketEvents.INCIDENT_RESOLVED,
      SocketEvents.SENSOR_UPDATED,
    ];
    events.forEach((event) => socket.on(event, handler));
    return () => events.forEach((event) => socket.off(event, handler));
  }, [id, refresh]);

  async function act(action: string, body?: Record<string, unknown>) {
    if (!id) return;
    setBusy(true);
    try {
      await apiClient.post(`/incidents/${id}/${action}`, body ?? {});
      await refresh();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message ?? "Action failed");
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="card text-emergency-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">Loading incident…</p>;

  const { incident } = data;
  const isOwner = user?.id === incident.userId;
  const isTerminal = incident.status === "RESOLVED" || incident.status === "CANCELLED";

  return (
    <div className="space-y-6">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Incident {incident.id.slice(0, 8)}</p>
          <h1 className="text-2xl font-bold">{incident.user?.fullName ?? "Unknown user"}</h1>
          <p className="text-sm text-slate-500">
            {incident.activationMethod.replace(/_/g, " ")} — {incident.activationDetail}
          </p>
        </div>
        <StatusBadge status={incident.status} />
      </div>

      {!isTerminal && (
        <div className="card flex flex-wrap gap-2">
          {isOwner ? (
            <button className="btn-outline" disabled={busy} onClick={() => act("cancel", { reason: "False alarm" })}>
              Cancel (false alarm)
            </button>
          ) : (
            <>
              <button className="btn-outline" disabled={busy} onClick={() => act("acknowledge")}>
                Acknowledge
              </button>
              <button className="btn-outline" disabled={busy} onClick={() => act("respond")}>
                Responding
              </button>
              <button className="btn-outline" disabled={busy} onClick={() => act("escalate", { reason: "Escalated by trusted member" })}>
                Escalate
              </button>
              <button className="btn-danger" disabled={busy} onClick={() => act("resolve", { notes: "Resolved by trusted member" })}>
                Resolve Incident
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Live Location</h2>
          <IncidentMap locations={data.locations} />
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Wearable Telemetry</h2>
          <WearablePanel device={data.wearable} />
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Incident Timeline</h2>
          <Timeline events={data.events} />
        </section>
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Evidence</h2>
          <EvidenceList items={data.evidence} />
        </section>
      </div>

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Trusted Network</h2>
        <ul className="space-y-1 text-sm">
          {data.trustedMembers.map((m) => (
            <li key={m.id} className="flex justify-between">
              <span>
                {m.name} <span className="text-slate-400">({m.email})</span>
              </span>
              <span className="text-slate-400">priority {m.priority}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
