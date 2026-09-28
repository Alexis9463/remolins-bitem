export default function Sparkline({ points, color, unit }) {
  const vals = points.map((p) => p.value).filter((v) => v != null && !isNaN(v));
  if (vals.length < 2) return <div className="text-sm text-inksoft py-2">Pas assez de points.</div>;
  const w = 300, h = 64, pad = 8;
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = (max - min) || 1;
  const step = (w - pad * 2) / (points.length - 1);
  const coords = points.map((p, i) => {
    const v = p.value != null && !isNaN(p.value) ? p.value : min;
    const x = pad + i * step;
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return [x, y];
  });
  const path = coords.map((c, i) => (i === 0 ? 'M' : 'L') + c[0].toFixed(1) + ',' + c[1].toFixed(1)).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => <circle key={i} cx={c[0].toFixed(1)} cy={c[1].toFixed(1)} r={2.6} fill={color} />)}
      </svg>
      <div className="flex justify-between text-[10.5px] text-inkfaint font-mono">
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  );
}
