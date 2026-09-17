interface EvidenceItem {
  id: string;
  type: string;
  status: string;
  sourceDevice: string;
  simulated: boolean;
  payloadSummary: string;
  sequence: number;
  capturedAt: string;
}

const ICONS: Record<string, string> = {
  AUDIO: "🎙️",
  IMAGE: "📷",
  VIDEO: "🎥",
  LOCATION: "📍",
  SENSOR: "⌚",
  DEVICE_INFO: "📶",
};

export function EvidenceList({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-400">No evidence received yet — it will start arriving once collection begins.</p>;
  }
  return (
    <ul className="space-y-2">
      {items
        .slice()
        .reverse()
        .map((item) => (
          <li key={item.id} className="flex items-start justify-between rounded-lg border border-slate-200 p-3">
            <div className="flex gap-3">
              <span className="text-xl">{ICONS[item.type] ?? "📄"}</span>
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {new Date(item.capturedAt).toLocaleTimeString()} — {item.payloadSummary}
                </p>
                <p className="text-xs text-slate-400">
                  Source: {item.sourceDevice} {item.simulated && <span className="badge bg-slate-100 text-slate-500">SIMULATED</span>}
                </p>
              </div>
            </div>
            <span className="badge bg-emerald-100 text-emerald-700">{item.status}</span>
          </li>
        ))}
    </ul>
  );
}
