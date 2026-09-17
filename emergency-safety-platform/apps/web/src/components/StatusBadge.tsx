const STYLES: Record<string, string> = {
  STANDBY: "bg-slate-100 text-slate-600",
  ACTIVATED: "bg-amber-100 text-amber-800",
  EVIDENCE_COLLECTING: "bg-amber-100 text-amber-800",
  TRUSTED_NOTIFIED: "bg-amber-100 text-amber-800",
  ACKNOWLEDGED: "bg-blue-100 text-blue-800",
  RESPONDING: "bg-blue-100 text-blue-800",
  ESCALATED: "bg-emergency-50 text-emergency-700",
  RESOLVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-500",
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>{status.replace(/_/g, " ")}</span>;
}
