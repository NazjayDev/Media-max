interface ActivityChartProps {
  points: { hour: string; events: number }[];
}

export default function ActivityChart({ points }: ActivityChartProps) {
  if (points.length === 0) return null;

  const max = Math.max(...points.map((p) => p.events), 1);
  const total = points.reduce((sum, p) => sum + p.events, 0);
  const label = new Intl.DateTimeFormat(undefined, { hour: "numeric" });

  return (
    <figure>
      <div
        className="flex h-40 items-end gap-1"
        role="img"
        aria-label={`${total} events in the last 24 hours`}
      >
        {points.map((p) => (
          <div
            key={p.hour}
            title={`${label.format(new Date(p.hour))}: ${p.events} events`}
            className="flex-1 rounded-t bg-gradient-to-t from-accent-from to-accent-to"
            style={{
              height: `${Math.max((p.events / max) * 100, p.events > 0 ? 4 : 1)}%`,
              opacity: p.events > 0 ? 1 : 0.25,
            }}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-muted">
        <span>{label.format(new Date(points[0].hour))}</span>
        <span>{total} events, last 24 hours</span>
        <span>{label.format(new Date(points[points.length - 1].hour))}</span>
      </figcaption>
    </figure>
  );
}
