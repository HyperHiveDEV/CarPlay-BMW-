import type { ReactNode } from 'react';
import type { DataSource, Metric } from '../vehicle/types';
import { VehicleDataValidator } from '../vehicle/VehicleDataValidator';

export function SourceBadge({ source, className = '' }: { source: DataSource; className?: string }) {
  const style =
    source === 'LIVE' ? 'border-ok/50 text-ok bg-ok/10' : source === 'DEMO' ? 'border-accent/50 text-accent bg-accent/10' : 'border-line text-mute bg-ink/40';
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-[0.35rem] py-[1px] text-[0.6rem] font-semibold tracking-[0.1em] ${style} ${className}`}>
      {source === 'LIVE' && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
      {source === 'NA' ? 'N/A' : source}
    </span>
  );
}

/** Formate une métrique ; une donnée périmée ou absente s'affiche « — » avec badge N/A. */
export function useMetricDisplay(m: Metric, digits = 0) {
  const stale = VehicleDataValidator.isStale(m);
  const source: DataSource = stale ? 'NA' : m.source;
  const text = m.value == null || source === 'NA' ? '—' : m.value.toFixed(digits);
  return { text, source };
}

export function MetricTile({ label, metric, digits = 0, icon, big = false, unit }: { label: string; metric: Metric; digits?: number; icon?: ReactNode; big?: boolean; unit?: string }) {
  const { text, source } = useMetricDisplay(metric, digits);
  return (
    <div className="card flex flex-col justify-between p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="label flex items-center gap-2">
          {icon && <span className="text-mute">{icon}</span>}
          {label}
        </span>
        <SourceBadge source={source} />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`${big ? 'text-5xl' : 'text-3xl'} font-light tabular-nums tracking-tight`}>{text}</span>
        <span className="text-sm text-mute">{unit ?? metric.unit}</span>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition disabled:opacity-40 ${checked ? 'border-accent bg-accent/70' : 'border-line bg-ink'}`}
    >
      <span className={`absolute top-0.5 h-5.5 w-5.5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} style={{ width: 22, height: 22 }} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, disabled }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className={`inline-flex rounded-xl border border-line bg-ink/60 p-1 ${disabled ? 'opacity-40' : ''}`}>
      {options.map((o) => (
        <button
          key={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm transition ${value === o.value ? 'bg-panel text-fg shadow ring-1 ring-accent/50' : 'text-mute hover:text-fg'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line/50 py-3.5 last:border-0">
      <div className="min-w-0">
        <div className="text-sm">{label}</div>
        {hint && <div className="mt-0.5 text-xs text-mute">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <div className="label">{kicker}</div>
        <h1 className="mt-1 text-3xl font-light tracking-tight">{title}</h1>
      </div>
      {right}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad'; children: ReactNode }) {
  const c = tone === 'bad' ? 'border-bad/40 bg-bad/10 text-bad' : tone === 'warn' ? 'border-warn/40 bg-warn/10 text-warn' : 'border-line bg-ink/40 text-mute';
  return <div className={`rounded-xl border px-3.5 py-2.5 text-xs leading-relaxed ${c}`}>{children}</div>;
}
