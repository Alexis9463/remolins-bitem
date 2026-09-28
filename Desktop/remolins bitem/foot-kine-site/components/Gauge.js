export default function Gauge({ acwr }) {
  const cx = 100, cy = 95, r = 78;
  const polar = (angleDeg) => {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
  };
  const arc = (a1, a2) => {
    const [x1, y1] = polar(a1), [x2, y2] = polar(a2);
    return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
  };
  const bands = [
    { f0: 0, f1: 0.4, color: 'var(--tw-blue, #2C63A6)' },
    { f0: 0.4, f1: 0.65, color: '#2E7A82' },
    { f0: 0.65, f1: 0.75, color: '#B8823A' },
    { f0: 0.75, f1: 1.0, color: '#A6423A' },
  ];
  let needle = null, display = '—';
  if (acwr != null) {
    const clamped = Math.max(0, Math.min(2, acwr));
    const angle = 180 - (clamped / 2) * 180;
    const [nx, ny] = polar(angle);
    needle = (
      <>
        <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="#101A2B" strokeWidth={3} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={6} fill="#101A2B" />
      </>
    );
    display = acwr.toFixed(2);
  }
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" width={220} height={121}>
        {bands.map((b, i) => (
          <path key={i} d={arc(180 - b.f0 * 180, 180 - b.f1 * 180)} stroke={b.color} strokeWidth={14} fill="none" />
        ))}
        {needle}
      </svg>
      <div className="font-display font-extrabold text-3xl -mt-6">{display}</div>
    </div>
  );
}
