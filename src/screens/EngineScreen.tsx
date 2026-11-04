import { useState } from 'react';
import { RpmGauge } from '../components/RpmGauge';
import { ArcGauge, MultiChart, type Series } from '../components/EngineCharts';
import { Notice, SectionTitle, Segmented, SourceBadge, useMetricDisplay } from '../components/ui';
import { Icon } from '../components/Icons';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { useSettings } from '../settings/settingsStore';
import { useMotionState } from '../vehicle/drivingSafety';
import { THRESHOLD_KEYS, THRESHOLD_LIMITS, thresholdState, type AlertThresholds } from '../vehicle/alertThresholds';
import { SESSION_COLUMNS, exportSessionCsv, sessionStats, useTelemetry, type TelemetrySession } from '../vehicle/telemetry';
import type { Metric } from '../vehicle/types';

const SERIES: Series[] = [
  { key: 'rpm', label: 'Régime', unit: 'tr/min', min: 0, max: 7000, color: 'rgb(var(--c-accent))' },
  { key: 'boost', label: 'Suralimentation', unit: 'bar', min: -0.8, max: 1.6, color: '#168BFF', digits: 2 },
  { key: 'coolantTemp', label: 'Liquide refr.', unit: '°C', min: 0, max: 130, color: '#FBBF24' },
  { key: 'speed', label: 'Vitesse', unit: 'km/h', min: 0, max: 220, color: '#34D399' },
  { key: 'throttle', label: 'Accélérateur', unit: '%', min: 0, max: 100, color: '#E5E7EB' },
];

/** Engine V2 : temps réel (jauges, températures avec seuils, courbes) et sessions de télémétrie. */
export function EngineScreen() {
  const [tab, setTab] = useState<'live' | 'sessions'>('live');
  const [editThresholds, setEditThresholds] = useState(false);
  const conn = useVehicleRepo((s) => s.connection);
  const v = useSettings((s) => s.vehicle);
  const rec = useTelemetry((s) => s.recording);
  const tel = useTelemetry();
  const moving = useMotionState() !== 'stationary';
  const src = conn.status === 'demo' ? 'DEMO' : conn.status === 'connected' ? 'LIVE' : 'NA';
  return (
    <div className="absolute inset-0 overflow-y-auto px-8 pb-4 screen-enter">
      <SectionTitle
        kicker={`Engine · ${v.engine} ${v.stage} · ${v.declaredHp} ch déclarés`}
        title={`BMW ${v.engine} — ${(v.displacementCc / 1000).toFixed(1)} L Turbo`}
        right={
          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-mute">
              <div className="flex items-center justify-end gap-2">Source <SourceBadge source={src} /></div>
              <div className="mt-1 tabular-nums">
                {conn.acquisitionHz ? `${conn.acquisitionHz} Hz` : '—'}{conn.latencyMs ? ` · ${conn.latencyMs} ms/requête` : ''}{conn.limitedByAdapter ? ' · limité par l’adaptateur' : ''}
              </div>
            </div>
            <button className={`btn ${rec ? 'btn-on' : ''}`} onClick={() => (rec ? tel.stop() : tel.start())}>
              <span className={`h-2.5 w-2.5 rounded-full ${rec ? 'animate-pulse bg-bad' : 'bg-mute'}`} />
              {rec ? `Arrêter · ${Math.round((rec.endedAt - rec.startedAt) / 1000)} s` : 'Enregistrer'}
            </button>
            <Segmented value={tab} onChange={setTab} options={[{ value: 'live', label: 'Temps réel' }, { value: 'sessions', label: `Sessions (${tel.sessions.length})` }]} />
          </div>
        }
      />
      {tab === 'live' ? <Live onThresholds={() => setEditThresholds(true)} moving={moving} /> : <Sessions moving={moving} />}
      {editThresholds && !moving && <ThresholdEditor onClose={() => setEditThresholds(false)} />}
    </div>
  );
}

function Live({ onThresholds, moving }: { onThresholds: () => void; moving: boolean }) {
  const m = useVehicleRepo((s) => s.snapshot.metrics);
  const h = useVehicleRepo((s) => s.history);
  const thresholds = useSettings((s) => s.alertThresholds);
  const val = (x: Metric) => (x.source === 'NA' || x.value == null ? null : x.value);
  return (
    <div className="grid grid-cols-[auto_1fr] gap-5">
      <div className="flex flex-col gap-4">
        <div className="card grid place-items-center p-4">
          <RpmGauge size={Math.min(340, Math.max(250, window.innerHeight * 0.44))} />
        </div>
        <div className="card grid grid-cols-3 gap-1 p-3">
          <ArcGauge label="Suralim." value={val(m.boost)} min={-0.8} max={1.6} unit="bar" digits={2} />
          <ArcGauge label="Accél." value={val(m.throttle)} min={0} max={100} unit="%" />
          <ArcGauge label="Charge" value={val(m.load)} min={0} max={100} unit="%" warnAt={90} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {THRESHOLD_KEYS.map((k) => <TempCard key={k} k={k} metric={m[k]} threshold={thresholds[k]} />)}
        </div>
        <div className="grid grid-cols-4 gap-3">
          <SmallTile label="Pression admission" metric={m.map} />
          <SmallTile label="Vitesse" metric={m.speed} />
          <SmallTile label="Batterie" metric={m.battery} digits={1} />
          <SmallTile label="Carburant" metric={m.fuel} />
        </div>
        <div className="card p-5">
          <MultiChart history={h} series={SERIES} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[11px] leading-relaxed text-mute">
            LIVE = OBD-II standard (lecture seule) · DEMO = simulé · N/A = non fourni par le calculateur ou périmé (&gt; 5 s). Suralimentation = MAP (PID 0B) − pression atmosphérique (PID 33).
            Puissance : {useSettings.getState().vehicle.declaredHp} ch déclarés, jamais estimés en temps réel.
          </p>
          <button className="btn shrink-0" disabled={moving} onClick={onThresholds}><Icon.settings width={16} height={16} /> Seuils d’alerte</button>
        </div>
      </div>
    </div>
  );
}

function TempCard({ k, metric, threshold }: { k: keyof AlertThresholds; metric: Metric; threshold: number }) {
  const d = useMetricDisplay(metric);
  const st = thresholdState(metric.value, d.source, threshold);
  const color = st === 'over' ? 'text-bad border-bad/60' : st === 'near' ? 'text-warn border-warn/50' : '';
  const pct = metric.value != null && d.source !== 'NA' ? Math.max(0, Math.min(1, metric.value / (threshold + 20))) : 0;
  return (
    <div className={`card p-4 ${color}`}>
      <div className="flex items-center justify-between">
        <span className="label flex items-center gap-2"><Icon.temp width={14} height={14} /> {THRESHOLD_LIMITS[k].label}</span>
        <SourceBadge source={d.source} />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-4xl font-light tabular-nums">{d.text}</span>
        <span className="text-sm text-mute">°C</span>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-line/60">
        {d.source !== 'NA' && <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${st === 'over' ? 'bg-bad' : st === 'near' ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${pct * 100}%` }} />}
        <div className="absolute -top-1 h-3.5 w-0.5 rounded bg-fg/70" style={{ left: `${(threshold / (threshold + 20)) * 100}%` }} title="seuil" />
      </div>
      <div className="mt-1.5 text-[11px] text-mute">{d.source === 'NA' ? 'non fourni par le calculateur — pas d’alerte' : `seuil ${threshold} °C${st === 'over' ? ' · DÉPASSÉ' : st === 'near' ? ' · proche' : ''}`}</div>
    </div>
  );
}

function SmallTile({ label, metric, digits = 0 }: { label: string; metric: Metric; digits?: number }) {
  const d = useMetricDisplay(metric, digits);
  return (
    <div className="card px-4 py-3">
      <div className="flex items-center justify-between gap-1"><span className="label truncate">{label}</span><SourceBadge source={d.source} /></div>
      <div className="mt-1.5 text-2xl font-light tabular-nums">{d.text} <span className="text-xs text-mute">{metric.unit}</span></div>
    </div>
  );
}

function ThresholdEditor({ onClose }: { onClose: () => void }) {
  const t = useSettings((s) => s.alertThresholds);
  const set = useSettings((s) => s.set);
  const m = useVehicleRepo((s) => s.snapshot.metrics);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-[min(560px,92vw)] p-6 screen-enter" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-light">Seuils d’alerte de température</h2>
          <button className="btn px-2 py-2" onClick={onClose} aria-label="Fermer"><Icon.close width={18} height={18} /></button>
        </div>
        {THRESHOLD_KEYS.map((k) => {
          const L = THRESHOLD_LIMITS[k];
          const available = m[k].source !== 'NA' && m[k].value != null;
          return (
            <div key={k} className="border-b border-line/50 py-3 last:border-0">
              <div className="flex items-center justify-between text-sm">
                <span>{L.label} <span className="ml-2"><SourceBadge source={available ? m[k].source : 'NA'} /></span></span>
                <span className="tabular-nums">{t[k]} °C</span>
              </div>
              <input type="range" min={L.min} max={L.max} step={1} value={t[k]} className="mt-2 w-full accent-[rgb(var(--c-accent))]"
                onChange={(e) => set({ alertThresholds: { ...t, [k]: Number(e.target.value) } })} />
              {!available && <div className="text-xs text-mute">Mesure actuellement indisponible : le seuil ne s’appliquera que si le calculateur la fournit.</div>}
            </div>
          );
        })}
        <div className="mt-4"><Notice>Alertes informatives de l’application, en complément — jamais en remplacement — des alertes du combiné BMW.</Notice></div>
      </div>
    </div>
  );
}

function Sessions({ moving }: { moving: boolean }) {
  const tel = useTelemetry();
  const [msg, setMsg] = useState<string | null>(null);
  const exp = async (s: TelemetrySession) => {
    try {
      const how = await exportSessionCsv(s);
      setMsg(how === 'share' ? 'CSV partagé.' : 'CSV téléchargé.');
    } catch (e) {
      setMsg(`Export impossible : ${(e as Error).message}`);
    }
  };
  return (
    <div className="space-y-3">
      {tel.lastError && <Notice tone="warn">{tel.lastError}</Notice>}
      {msg && <Notice>{msg}</Notice>}
      {tel.recording && (
        <div className="card flex items-center justify-between border-bad/40 p-4">
          <span className="flex items-center gap-3 text-sm"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bad" /> Enregistrement en cours — {tel.recording.samples.length} échantillons (2 Hz)</span>
          <button className="btn" onClick={() => tel.stop()}>Arrêter</button>
        </div>
      )}
      {tel.sessions.length === 0 && !tel.recording && (
        <div className="card p-8 text-center text-sm text-mute">Aucune session. Touchez « Enregistrer » pour capturer la télémétrie (jusqu’à 30 min, 10 sessions conservées hors ligne).</div>
      )}
      {tel.sessions.map((s) => {
        const st = sessionStats(s);
        return (
          <div key={s.id} className="card flex items-center gap-5 p-4">
            <div className="w-44 shrink-0">
              <div className="text-sm">{new Date(s.startedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>
              <div className="mt-1 flex items-center gap-2 text-xs text-mute">
                {Math.floor(st.durationS / 60)} min {st.durationS % 60} s · <SourceBadge source={s.source === 'MIXTE' ? 'LIVE' : s.source} />{s.source === 'MIXTE' && <span>+ DEMO</span>}
              </div>
              {s.truncated && <div className="mt-1 text-[11px] text-warn">{s.truncated}</div>}
            </div>
            <div className="grid flex-1 grid-cols-5 gap-3 text-xs">
              {(['rpm', 'speed', 'coolantTemp', 'boost', 'throttle'] as const).map((k) => (
                <div key={k}>
                  <div className="label">{SESSION_COLUMNS[k].label}</div>
                  <div className="mt-1 text-base tabular-nums">{st.max[k] != null ? st.max[k]!.toFixed(SESSION_COLUMNS[k].digits) : '—'} <span className="text-mute">{SESSION_COLUMNS[k].unit}</span></div>
                  <div className="text-mute">max · moy {st.avg[k] != null ? st.avg[k]!.toFixed(SESSION_COLUMNS[k].digits) : '—'}</div>
                </div>
              ))}
            </div>
            <div className="flex shrink-0 gap-2">
              <button className="btn" disabled={moving} onClick={() => exp(s)}>Export CSV</button>
              <button className="btn px-2.5" disabled={moving} aria-label="Supprimer la session" onClick={() => confirm('Supprimer cette session ?') && tel.remove(s.id)}><Icon.trash width={16} height={16} /></button>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] text-mute">Échantillonnage stocké à 2 Hz ; chaque mesure garde sa provenance (LIVE / DEMO / N/A) dans le CSV. Les valeurs indisponibles restent vides.</p>
    </div>
  );
}
