import { useEffect, useRef } from 'react';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { SourceBadge } from './ui';
import { VehicleDataValidator } from '../vehicle/VehicleDataValidator';

const MAX = 7000;
const RED = 6200;
const START = 225; // degrés (0 tr/min en bas à gauche)
const SWEEP = 270;

const polar = (cx: number, cy: number, r: number, deg: number) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};

/** Compte-tours circulaire animé (interpolation à 60 i/s indépendante du rythme des données). */
export function RpmGauge({ size = 360 }: { size?: number }) {
  const rpm = useVehicleRepo((s) => s.snapshot.metrics.rpm);
  const speed = useVehicleRepo((s) => s.snapshot.metrics.speed);
  const needle = useRef<SVGGElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const txt = useRef<SVGTextElement>(null);
  const shown = useRef(0);
  const target = useRef(0);
  const stale = VehicleDataValidator.isStale(rpm);
  const valid = rpm.value != null && rpm.source !== 'NA' && !stale;
  target.current = valid ? rpm.value! : 0;

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      shown.current += (target.current - shown.current) * (1 - Math.exp(-12 * dt));
      const v = Math.max(0, Math.min(MAX, shown.current));
      const deg = START + (v / MAX) * SWEEP;
      needle.current?.setAttribute('transform', `rotate(${deg} 180 180)`);
      fill.current?.setAttribute('d', v < 10 ? 'M0 0' : arc(180, 180, 150, START, deg));
      if (txt.current) txt.current.textContent = valid ? String(Math.round(v / 10) * 10) : '—';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [valid]);

  const ticks = [];
  for (let i = 0; i <= MAX; i += 250) {
    const deg = START + (i / MAX) * SWEEP;
    const major = i % 1000 === 0;
    const [x0, y0] = polar(180, 180, major ? 128 : 134, deg);
    const [x1, y1] = polar(180, 180, 142, deg);
    ticks.push(<line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke={i >= RED ? '#F87171' : 'rgb(var(--c-mute))'} strokeWidth={major ? 2.2 : 1} opacity={major ? 0.95 : 0.5} />);
    if (major) {
      const [tx, ty] = polar(180, 180, 110, deg);
      ticks.push(<text key={`t${i}`} x={tx} y={ty + 5} textAnchor="middle" fontSize="15" fill={i >= RED ? '#F87171' : 'rgb(var(--c-mute))'} fontWeight={500}>{i / 1000}</text>);
    }
  }
  const sp = speed.value != null && speed.source !== 'NA' && !VehicleDataValidator.isStale(speed) ? Math.round(speed.value) : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 360 360" width={size} height={size}>
        <defs>
          <linearGradient id="rpmGrad" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0" stopColor="rgb(var(--c-accent))" stopOpacity=".35" />
            <stop offset="1" stopColor="rgb(var(--c-accent))" />
          </linearGradient>
          <radialGradient id="rpmBg"><stop offset="0" stopColor="rgb(var(--c-panel))" /><stop offset="1" stopColor="rgb(var(--c-ink))" /></radialGradient>
        </defs>
        <circle cx="180" cy="180" r="170" fill="url(#rpmBg)" stroke="rgb(var(--c-line))" />
        <path d={arc(180, 180, 150, START, START + SWEEP)} stroke="rgb(var(--c-line))" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d={arc(180, 180, 150, START + (RED / MAX) * SWEEP, START + SWEEP)} stroke="#F87171" strokeWidth="8" fill="none" opacity=".55" />
        <path ref={fill} stroke="url(#rpmGrad)" strokeWidth="8" fill="none" strokeLinecap="round" />
        {ticks}
        <g ref={needle}>
          <line x1="180" y1="180" x2="180" y2="44" stroke="rgb(var(--c-fg))" strokeWidth="3" strokeLinecap="round" />
          <circle cx="180" cy="180" r="9" fill="rgb(var(--c-ink))" stroke="rgb(var(--c-fg))" strokeWidth="2" />
        </g>
        <text ref={txt} x="180" y="246" textAnchor="middle" fontSize="44" fontWeight={300} fill="rgb(var(--c-fg))">—</text>
        <text x="180" y="270" textAnchor="middle" fontSize="12" letterSpacing="2.5" fill="rgb(var(--c-mute))">TR/MIN</text>
        <text x="180" y="318" textAnchor="middle" fontSize="22" fontWeight={500} fill="rgb(var(--c-fg))">{sp ?? '—'} <tspan fontSize="12" fill="rgb(var(--c-mute))">km/h</tspan></text>
      </svg>
      <div className="absolute left-1/2 top-[30%] -translate-x-1/2"><SourceBadge source={valid ? rpm.source : 'NA'} /></div>
    </div>
  );
}
