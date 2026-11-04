import { useMemo } from 'react';

/** Graphique temporel léger (SVG) — trous (NaN) respectés pour ne pas inventer de continuité. */
export function LineChart({ data, min, max, height = 140, color = 'rgb(var(--c-accent))', unit = '', label }: { data: number[]; min: number; max: number; height?: number; color?: string; unit?: string; label: string }) {
  const W = 600;
  const path = useMemo(() => {
    if (!data.length) return '';
    let d = '';
    let pen = false;
    const n = Math.max(data.length, 2);
    data.forEach((v, i) => {
      if (!Number.isFinite(v)) {
        pen = false;
        return;
      }
      const x = (i / (n - 1)) * W;
      const y = height - ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * (height - 8) - 4;
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
      pen = true;
    });
    return d;
  }, [data, min, max, height]);
  const last = [...data].reverse().find((v) => Number.isFinite(v));
  const gid = `g-${label.replace(/\W/g, '')}`;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="text-sm tabular-nums text-fg">{last != null ? last.toFixed(unit === 'bar' ? 2 : 0) : '—'} <span className="text-mute">{unit}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity=".28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="rgb(var(--c-line))" strokeDasharray="3 5" />
        ))}
        {path && <path d={`${path}L${W},${height}L0,${height}Z`} fill={`url(#${gid})`} opacity=".9" />}
        {path && <path d={path} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
      {!path && <div className="-mt-16 mb-10 text-center text-xs text-mute">Aucune donnée disponible</div>}
    </div>
  );
}
