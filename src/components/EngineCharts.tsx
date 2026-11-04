import { useMemo, useState } from 'react';
import type { HistoryKey } from '../vehicle/VehicleDataRepository';

/** Jauge en arc (suralimentation, accélérateur, charge) — valeur N/A affichée « — ». */
export function ArcGauge({ label, value, min, max, unit, digits = 0, warnAt, sweep = 240 }: { label: string; value: number | null; min: number; max: number; unit: string; digits?: number; warnAt?: number; sweep?: number }) {
  const R = 44;
  const start = -90 - sweep / 2;
  const t = value == null ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const pt = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return [60 + R * Math.cos(a), 60 + R * Math.sin(a)];
  };
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(a0);
    const [x1, y1] = pt(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
  };
  const warn = warnAt != null && value != null && value >= warnAt;
  return (
    <svg viewBox="0 0 120 104" className="mx-auto w-full max-w-[130px]">
      <path d={arc(start, start + sweep)} stroke="rgb(var(--c-line))" strokeWidth="7" fill="none" strokeLinecap="round" />
      {warnAt != null && <path d={arc(start + ((warnAt - min) / (max - min)) * sweep, start + sweep)} stroke="#F87171" strokeOpacity=".35" strokeWidth="7" fill="none" />}
      {value != null && t > 0.002 && (
        <path d={arc(start, start + t * sweep)} stroke={warn ? '#F87171' : 'rgb(var(--c-accent))'} strokeWidth="7" fill="none" strokeLinecap="round" style={{ transition: 'all .25s ease-out' }} />
      )}
      <text x="60" y="62" textAnchor="middle" fontSize="20" fontWeight={300} fill="rgb(var(--c-fg))">{value == null ? '—' : value.toFixed(digits)}</text>
      <text x="60" y="76" textAnchor="middle" fontSize="8" fill="rgb(var(--c-mute))">{unit}</text>
      <text x="60" y="100" textAnchor="middle" fontSize="8.5" letterSpacing="1.5" fill="rgb(var(--c-mute))">{label.toUpperCase()}</text>
    </svg>
  );
}

export interface Series {
  key: HistoryKey;
  label: string;
  unit: string;
  min: number;
  max: number;
  color: string;
  digits?: number;
}

/**
 * Graphique temporel multi-courbes (60 s) : chaque courbe a sa propre échelle, sélection par puces,
 * trous conservés pour les valeurs N/A (pas d'interpolation inventée).
 */
export function MultiChart({ history, series, height = 170 }: { history: Record<HistoryKey, number[]>; series: Series[]; height?: number }) {
  const [on, setOn] = useState<HistoryKey[]>(series.slice(0, 3).map((s) => s.key));
  const W = 800;
  const paths = useMemo(
    () =>
      series.filter((s) => on.includes(s.key)).map((s) => {
        const data = history[s.key] ?? [];
        const n = Math.max(data.length, 2);
        let d = '';
        let pen = false;
        data.forEach((v, i) => {
          if (!Number.isFinite(v)) { pen = false; return; }
          const x = (i / (n - 1)) * W;
          const y = height - ((Math.min(s.max, Math.max(s.min, v)) - s.min) / (s.max - s.min)) * (height - 10) - 5;
          d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
          pen = true;
        });
        const vals = data.filter(Number.isFinite);
        return { s, d, last: vals[vals.length - 1], max: vals.length ? Math.max(...vals) : undefined };
      }),
    [history, series, on, height],
  );
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {series.map((s) => {
          const active = on.includes(s.key);
          const p = paths.find((x) => x.s.key === s.key);
          return (
            <button key={s.key} onClick={() => setOn(active ? on.filter((k) => k !== s.key) : [...on, s.key])}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${active ? 'border-line bg-ink/60 text-fg' : 'border-transparent text-mute'}`}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.color, opacity: active ? 1 : 0.35 }} />
              {s.label}
              {active && <span className="tabular-nums text-mute">{p?.last != null ? p.last.toFixed(s.digits ?? 0) : '—'} {s.unit}{p?.max != null ? ` · max ${p.max.toFixed(s.digits ?? 0)}` : ''}</span>}
            </button>
          );
        })}
      </div>
      <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="rgb(var(--c-line))" strokeDasharray="3 6" />)}
        {[0, 15, 30, 45, 60].map((sec) => <line key={sec} x1={(sec / 60) * W} x2={(sec / 60) * W} y1="0" y2={height} stroke="rgb(var(--c-line))" strokeOpacity=".5" />)}
        {paths.map(({ s, d }) => d && <path key={s.key} d={d} fill="none" stroke={s.color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />)}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-mute"><span>−60 s</span><span>−45 s</span><span>−30 s</span><span>−15 s</span><span>maintenant</span></div>
      {paths.every((p) => !p.d) && <div className="-mt-24 mb-16 text-center text-xs text-mute">Aucune donnée disponible pour les courbes choisies</div>}
    </div>
  );
}
