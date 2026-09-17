import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import type { IncidentDTO, WearableDeviceDTO, TrustedMemberDTO } from "@esp/types";
import { SocketEvents } from "@esp/types";
import { apiClient } from "../api/client.js";
import { getSocket } from "../api/socket.js";
import { StatCard } from "../components/StatCard.js";
import { StatusBadge } from "../components/StatusBadge.js";

const ACTIVE_STATUSES = new Set(["ACTIVATED", "EVIDENCE_COLLECTING", "TRUSTED_NOTIFIED", "ACKNOWLEDGED", "RESPONDING", "ESCALATED"]);

export function DashboardPage() {
  const [incidents, setIncidents] = useState<IncidentDTO[]>([]);
  const [device, setDevice] = useState<WearableDeviceDTO | null>(null);
  const [trustedMembers, setTrustedMembers] = useState<TrustedMemberDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [incidentsRes, wearableRes, trustedRes] = await Promise.all([
      apiClient.get<IncidentDTO[]>("/incidents"),
      apiClient.get("/wearables/me"),
      apiClient.get<TrustedMemberDTO[]>("/trusted-members"),
    ]);
    setIncidents(incidentsRes.data);
    setDevice(wearableRes.data.device);
    setTrustedMembers(trustedRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;
    const handler = () => refresh();
    socket.on(SocketEvents.INCIDENT_CREATED, handler);
    socket.on(SocketEvents.INCIDENT_STATUS_CHANGED, handler);
    socket.on(SocketEvents.INCIDENT_RESOLVED, handler);
    return () => {
      socket.off(SocketEvents.INCIDENT_CREATED, handler);
      socket.off(SocketEvents.INCIDENT_STATUS_CHANGED, handler);
      socket.off(SocketEvents.INCIDENT_RESOLVED, handler);
    };
  }, [refresh]);

  const active = incidents.filter((i) => ACTIVE_STATUSES.has(i.status));
  const recent = incidents.slice(0, 8);

  if (loading) return <p className="text-sm text-slate-400">Loading dashboard…</p>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Active incidents" value={active.length} hint={active.length > 0 ? "Requires attention" : "All clear"} />
        <StatCard label="Total incidents" value={incidents.length} />
        <StatCard label="Trusted members" value={trustedMembers.length} />
        <StatCard label="Wearable" value={device?.connectionStatus ?? "—"} hint={device?.simulated ? "SIMULATED DEVICE" : undefined} />
      </div>

      {active.length > 0 && (
        <section className="card border-emergency-200 bg-emergency-50">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-emergency-700">
            <span className="pulse-live h-2.5 w-2.5 rounded-full bg-emergency-600" /> Active Emergency
          </h2>
          <div className="space-y-2">
            {active.map((incident) => (
              <Link
                key={incident.id}
                to={`/incidents/${incident.id}`}
                className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm hover:shadow"
              >
                <div>
                  <p className="font-semibold text-slate-800">{incident.user?.fullName ?? "Unknown user"}</p>
                  <p className="text-xs text-slate-500">
                    {incident.activationMethod.replace(/_/g, " ")} · {new Date(incident.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <StatusBadge status={incident.status} />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Recent Incidents</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-400">No incidents yet. Try Demo Mode to simulate one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="pb-2">User</th>
                <th className="pb-2">Activation</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((incident) => (
                <tr key={incident.id} className="border-t border-slate-100">
                  <td className="py-2">
                    <Link className="font-medium text-slate-800 hover:underline" to={`/incidents/${incident.id}`}>
                      {incident.user?.fullName ?? incident.userId}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">{incident.activationMethod.replace(/_/g, " ")}</td>
                  <td className="py-2">
                    <StatusBadge status={incident.status} />
                  </td>
                  <td className="py-2 text-slate-500">{new Date(incident.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
