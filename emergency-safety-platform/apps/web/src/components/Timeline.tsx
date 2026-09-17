interface TimelineItem {
  id: string;
  label: string;
  detail?: string | null;
  occurredAt: string;
}

export function Timeline({ events }: { events: TimelineItem[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-slate-400">No timeline events yet.</p>;
  }
  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="relative border-l-2 border-slate-200 pl-4">
          <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-slate-400" />
          <p className="text-xs font-mono text-slate-400">{new Date(event.occurredAt).toLocaleTimeString()}</p>
          <p className="text-sm font-semibold text-slate-800">{event.label}</p>
          {event.detail && <p className="text-xs text-slate-500">{event.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
