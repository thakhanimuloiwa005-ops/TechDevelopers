interface WearableDevice {
  name: string;
  deviceType: string;
  connectionStatus: string;
  batteryPercent: number;
  heartRateBpm: number | null;
  motionState: string;
  fallState: string;
  lastTelemetryAt: string | null;
  simulated: boolean;
}

const CONNECTION_DOT: Record<string, string> = {
  CONNECTED: "🟢",
  WEAK: "🟡",
  DISCONNECTED: "🔴",
  RECONNECTING: "🟠",
};

export function WearablePanel({ device }: { device: WearableDevice | null }) {
  if (!device) return <p className="text-sm text-slate-400">No wearable registered.</p>;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">{device.name}</p>
          <p className="text-xs text-slate-400">{device.deviceType}</p>
        </div>
        {device.simulated && <span className="badge bg-slate-100 text-slate-500">SIMULATED DEVICE</span>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Stat label="Connection" value={`${CONNECTION_DOT[device.connectionStatus] ?? "⚪"} ${device.connectionStatus}`} />
        <Stat label="Battery" value={`${device.batteryPercent}%`} />
        <Stat label="Heart rate" value={device.heartRateBpm ? `${device.heartRateBpm} BPM` : "—"} />
        <Stat label="Motion" value={device.motionState.replace(/_/g, " ")} />
        <Stat label="Fall detection" value={device.fallState.replace(/_/g, " ")} />
        <Stat label="Last telemetry" value={device.lastTelemetryAt ? new Date(device.lastTelemetryAt).toLocaleTimeString() : "—"} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
