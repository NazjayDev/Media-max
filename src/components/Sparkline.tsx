export default function Sparkline({ values, label }: { values: number[]; label: string }) {
  if (values.length < 2) return null;

  const width = 120;
  const height = 28;
  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map(
    (v, i) => `${(i * step).toFixed(1)},${(height - 2 - (v / max) * (height - 4)).toFixed(1)}`,
  );
  const area = `0,${height} ${points.join(" ")} ${width},${height}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-full"
      role="img"
      aria-label={label}
      preserveAspectRatio="none"
    >
      <polygon points={area} className="fill-accent-from/15" />
      <polyline
        points={points.join(" ")}
        fill="none"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        className="stroke-accent-from"
      />
    </svg>
  );
}
