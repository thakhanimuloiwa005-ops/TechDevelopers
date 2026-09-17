import { useEffect, useState } from "react";
import type { AuditLogDTO } from "@esp/types";
import { apiClient } from "../api/client.js";

export function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogDTO[]>([]);

  useEffect(() => {
    apiClient.get<AuditLogDTO[]>("/audit-logs").then((res) => setLogs(res.data));
  }, []);

  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-bold">Audit Log</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="pb-2">Timestamp</th>
            <th className="pb-2">Action</th>
            <th className="pb-2">Resource</th>
            <th className="pb-2">Result</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-t border-slate-100">
              <td className="py-2 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
              <td className="py-2 font-medium text-slate-800">{log.action}</td>
              <td className="py-2 text-slate-500">{log.resource}</td>
              <td className="py-2">
                <span className={`badge ${log.result === "SUCCESS" ? "bg-emerald-100 text-emerald-700" : "bg-emergency-50 text-emergency-700"}`}>
                  {log.result}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="text-sm text-slate-400">No audit events yet.</p>}
    </section>
  );
}
