import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { NotificationDTO } from "@esp/types";
import { SocketEvents } from "@esp/types";
import { apiClient } from "../api/client.js";
import { getSocket } from "../api/socket.js";

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);

  async function refresh() {
    const res = await apiClient.get<NotificationDTO[]>("/notifications");
    setNotifications(res.data);
  }

  useEffect(() => {
    refresh();
    const socket = getSocket();
    if (!socket) return;
    const handler = () => refresh();
    socket.on(SocketEvents.NOTIFICATION_CREATED, handler);
    return () => {
      socket.off(SocketEvents.NOTIFICATION_CREATED, handler);
    };
  }, []);

  async function markRead(id: string) {
    await apiClient.post(`/notifications/${id}/read`);
    await refresh();
  }

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-bold">Notifications</h2>
      {notifications.length === 0 && <p className="text-sm text-slate-400">No notifications yet.</p>}
      <ul className="space-y-2">
        {notifications.map((n) => (
          <li key={n.id} className={`rounded-lg border p-3 ${n.read ? "border-slate-100 bg-slate-50" : "border-emergency-200 bg-emergency-50"}`}>
            <div className="flex items-center justify-between">
              <p className="font-semibold text-slate-800">{n.title}</p>
              <span className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-sm text-slate-600">{n.body}</p>
            <div className="mt-2 flex gap-3">
              {n.incidentId && (
                <Link className="text-xs font-semibold text-slate-700 underline" to={`/incidents/${n.incidentId}`}>
                  Open incident
                </Link>
              )}
              {!n.read && (
                <button className="text-xs font-semibold text-slate-500 underline" onClick={() => markRead(n.id)}>
                  Mark read
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
