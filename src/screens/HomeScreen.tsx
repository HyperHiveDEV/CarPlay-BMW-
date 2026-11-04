import { useState } from 'react';
import { ALL_HOME_WIDGETS, useSettings, type HomeWidgetId } from '../settings/settingsStore';
import { useScene } from '../state/sceneStore';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { Icon } from '../components/Icons';
import { SourceBadge, useMetricDisplay } from '../components/ui';
import { WIDGETS, WIDGET_LABEL } from '../components/HomeWidgets';
import { fmtDate, fmtTime, useNow } from '../components/Clock';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import { AppLauncher, nativeAvailable } from '../native/AppLauncher';
import { thresholdState } from '../vehicle/alertThresholds';
import type { Density } from '../components/layout';
import type { Screen } from '../App';
import type { Metric } from '../vehicle/types';

/**
 * My BMW — tableau de bord OEM+ en trois zones : barre latérale (App), zone centrale dédiée à la
 * BMW 3D (titre, caméras, widgets), colonne de droite compacte (heure, véhicule, mesures, OBD, médias).
 * Entièrement utilisable au clavier / à la molette (zones « main » et « aside »).
 */
export function HomeScreen({ go, ready, density, can3d }: { go: (s: Screen) => void; ready: boolean; density: Density; can3d: boolean }) {
  const [editing, setEditing] = useState(false);
  if (!ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      <MainZone density={density} can3d={can3d} onEdit={() => setEditing(true)} />
      <Aside go={go} density={density} />
      {editing && <WidgetEditor onClose={() => setEditing(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ zone centrale
function MainZone({ density, can3d, onEdit }: { density: Density; can3d: boolean; onEdit: () => void }) {
  const v = useSettings((s) => s.vehicle);
  const widgets = useSettings((s) => s.homeWidgets);
  const scene = useScene();
  const max = density === 'tiny' ? 3 : 4;
  const shown = widgets.slice(0, max);
  const cams: CameraPreset[] = density === 'tiny' ? ['front34', 'side', 'rear34', 'wheel'] : (Object.keys(CAMERA_PRESETS) as CameraPreset[]);
  return (
    <section data-nav-zone="main" data-nav-order="1" aria-label="Vue véhicule" className="relative flex min-w-0 flex-1 flex-col px-5 pb-3 pt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="pointer-events-none">
          <div className="label">My BMW</div>
          <h1 className="mt-1 text-[2.3rem] font-extralight leading-none tracking-tight">{v.name}</h1>
          <div className="mt-1.5 text-[0.8rem] text-mute">{v.generation} · M Sport · 3 portes · {v.engine} {v.stage}</div>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          <button className={`chip ${scene.navMode === 'scene' ? 'chip-on' : ''}`} disabled={!can3d} onClick={() => scene.set({ navMode: scene.navMode === 'scene' ? 'ui' : 'scene' })} title="Piloter la vue 3D avec les commandes directionnelles">
            <Icon.rotate width={14} height={14} /> Vue 3D
          </button>
          {cams.map((c) => (
            <button key={c} className={`chip ${scene.camera === c ? 'chip-on' : ''}`} disabled={!can3d} onClick={() => scene.goCamera(c)}>{CAMERA_PRESETS[c].label}</button>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <div className="pointer-events-auto grid items-stretch gap-2.5" style={{ gridTemplateColumns: `repeat(${Math.max(1, shown.length)}, minmax(0, 1fr)) auto`, height: density === 'tiny' ? '5.6rem' : '6.6rem' }}>
        {shown.map((id) => {
          const W = WIDGETS[id];
          return <W key={id} />;
        })}
        <button className="card flex w-[3.2rem] flex-col items-center justify-center gap-1 text-[0.62rem] text-mute transition hover:text-fg" onClick={onEdit} aria-label="Personnaliser les widgets">
          <Icon.edit width={16} height={16} /> {widgets.length > max ? `+${widgets.length - max}` : 'Éditer'}
        </button>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ colonne de droite
function Aside({ go, density }: { go: (s: Screen) => void; density: Density }) {
  const now = useNow(1000);
  const v = useSettings((s) => s.vehicle);
  const m = useVehicleRepo((s) => s.snapshot.metrics);
  const limit = useSettings((s) => s.alertThresholds.coolantTemp);
  return (
    <aside data-nav-zone="aside" data-nav-order="2" aria-label="Informations"
      className="pointer-events-auto flex h-full shrink-0 flex-col gap-2 border-l border-line/40 bg-panel/55 p-3 backdrop-blur-md" style={{ width: '18.5rem' }}>
      <div className="flex items-end justify-between px-1">
        <div className="text-[2.6rem] font-extralight leading-none tabular-nums">{fmtTime(now)}</div>
        <div className="pb-1 text-right text-[0.72rem] capitalize leading-tight text-mute">{fmtDate(now)}</div>
      </div>
      <button className="card flex items-center gap-3 px-3 py-2.5 text-left" onClick={() => go('vehicle')}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-mute"><Icon.car width={18} height={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9rem]">{v.name} · {v.generation}</span>
          <span className="block truncate text-[0.7rem] text-mute">{v.engine} 1.5 Turbo · {v.stage} · {v.declaredHp} ch déclarés</span>
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2">
        <AsideMetric label="Vitesse" metric={m.speed} unit="km/h" onClick={() => go('engine')} />
        <AsideMetric label="Liquide refr." metric={m.coolantTemp} unit="°C" onClick={() => go('engine')} tone={thresholdState(m.coolantTemp.value, m.coolantTemp.source, limit)} />
        <AsideMetric label="Batterie" metric={m.battery} unit="V" digits={1} onClick={() => go('engine')} />
        <AsideMetric label="Turbo" metric={m.boost} unit="bar" digits={2} onClick={() => go('engine')} />
      </div>
      <ObdStatus onClick={() => go('settings')} />
      {density !== 'tiny' && <div className="flex-1" />}
      <MediaShortcuts go={go} />
    </aside>
  );
}

function AsideMetric({ label, metric, unit, digits = 0, onClick, tone }: { label: string; metric: Metric; unit: string; digits?: number; onClick: () => void; tone?: string }) {
  const d = useMetricDisplay(metric, digits);
  const ring = tone === 'over' ? 'border-bad/70' : tone === 'near' ? 'border-warn/60' : '';
  return (
    <button className={`card px-3 py-2 text-left ${ring}`} onClick={onClick}>
      <span className="flex items-center justify-between gap-1"><span className="label truncate !text-[0.6rem]">{label}</span><SourceBadge source={d.source} /></span>
      <span className="mt-1 block text-[1.55rem] font-light leading-none tabular-nums">{d.text}<span className="ml-1 text-[0.7rem] text-mute">{unit}</span></span>
    </button>
  );
}

function ObdStatus({ onClick }: { onClick: () => void }) {
  const c = useVehicleRepo((s) => s.connection);
  const updatedAt = useVehicleRepo((s) => s.snapshot.updatedAt);
  const now = useNow(1000).getTime();
  const age = updatedAt ? (now - updatedAt) / 1000 : null;
  const stale = age != null && age > 5;
  // qualité : simulation, ou d'après la latence et les erreurs mesurées
  const quality = c.status === 'demo' ? { n: 3, t: 'simulation' } : c.status !== 'connected' ? { n: 0, t: 'aucune' } : stale ? { n: 0, t: 'perte de signal' } : (c.latencyMs ?? 999) < 80 && c.errorCount < 3 ? { n: 3, t: 'bonne' } : (c.latencyMs ?? 999) < 200 ? { n: 2, t: 'moyenne' } : { n: 1, t: 'faible' };
  const label = { demo: 'Démonstration', disconnected: 'OBD déconnecté', scanning: 'Recherche…', connecting: 'Connexion…', initializing: 'Initialisation…', connected: 'OBD-II connecté', error: 'Erreur OBD' }[c.status];
  return (
    <button className={`card px-3 py-2 text-left ${c.status === 'error' || stale ? 'border-bad/60' : ''}`} onClick={onClick}>
      <span className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[0.82rem]">
          <span className={`h-2 w-2 rounded-full ${c.status === 'connected' && !stale ? 'bg-ok' : c.status === 'demo' ? 'bg-accent' : c.status === 'error' || stale ? 'bg-bad' : 'bg-mute'}`} />
          {label}
        </span>
        <span className="flex items-end gap-0.5" aria-label={`qualité ${quality.t}`}>
          {[1, 2, 3].map((i) => <span key={i} className={`w-1 rounded-sm ${i <= quality.n ? 'bg-fg/80' : 'bg-line'}`} style={{ height: `${0.3 + i * 0.22}rem` }} />)}
        </span>
      </span>
      <span className="mt-0.5 block truncate text-[0.68rem] text-mute">
        {c.acquisitionHz ? `${c.acquisitionHz} Hz` : '—'}{c.latencyMs ? ` · ${c.latencyMs} ms` : ''} · qualité {quality.t}{age != null ? ` · données il y a ${age < 1 ? '< 1' : Math.round(age)} s` : ''}
      </span>
    </button>
  );
}

/** Raccourcis multimédias : actifs uniquement dans l'APK Android (aucune intégration simulée). */
function MediaShortcuts({ go }: { go: (s: Screen) => void }) {
  const native = nativeAvailable();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => async () => {
    setErr(null);
    try { await fn(); } catch (e) { setErr((e as Error).message); }
  };
  const items: { label: string; icon: keyof typeof Icon; act: () => void }[] = [
    { label: 'Navigation', icon: 'nav', act: run(async () => { if (!(await AppLauncher.openCategory('maps'))) throw new Error('Aucune application de navigation'); }) },
    { label: 'Musique', icon: 'media', act: run(async () => { if (!(await AppLauncher.openCategory('music'))) throw new Error('Aucun lecteur'); }) },
    { label: 'Navigateur', icon: 'link', act: run(async () => { if (!(await AppLauncher.openCategory('browser'))) throw new Error('Aucun navigateur'); }) },
    { label: 'Réglages', icon: 'settings', act: run(() => AppLauncher.openSettings('general')) },
  ];
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="label !text-[0.6rem]">Applications</span>
        {!native && <span className="text-[0.6rem] text-mute">disponibles dans l’APK</span>}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {items.map((it) => {
          const I = Icon[it.icon];
          return (
            <button key={it.label} disabled={!native} onClick={it.act} className="card flex flex-col items-center gap-1 px-1 py-2 text-[0.6rem] text-mute disabled:opacity-40">
              <I width={18} height={18} /> {it.label}
            </button>
          );
        })}
      </div>
      {err && <div className="mt-1 text-[0.65rem] text-warn">{err}</div>}
      <button className="sr-only" onClick={() => go('media')}>Multimédia</button>
    </div>
  );
}

// ------------------------------------------------------------------ éditeur de widgets
function WidgetEditor({ onClose }: { onClose: () => void }) {
  const widgets = useSettings((s) => s.homeWidgets);
  const set = useSettings((s) => s.set);
  const move = (id: HomeWidgetId, d: -1 | 1) => {
    const i = widgets.indexOf(id);
    const j = i + d;
    if (i < 0 || j < 0 || j >= widgets.length) return;
    const next = [...widgets];
    [next[i], next[j]] = [next[j], next[i]];
    set({ homeWidgets: next });
  };
  const toggle = (id: HomeWidgetId) => set({ homeWidgets: widgets.includes(id) ? widgets.filter((w) => w !== id) : [...widgets, id] });
  const ordered = [...widgets, ...ALL_HOME_WIDGETS.filter((w) => !widgets.includes(w))];
  return (
    <div data-nav-modal className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card max-h-[92vh] w-[min(32rem,92vw)] overflow-y-auto p-5 screen-enter" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-light">Widgets de l’accueil</h2>
          <button data-nav-close className="btn px-2 py-2" onClick={onClose} aria-label="Fermer"><Icon.close width={16} height={16} /></button>
        </div>
        <div className="space-y-1.5">
          {ordered.map((id) => {
            const on = widgets.includes(id);
            return (
              <div key={id} className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${on ? 'border-accent/40 bg-accent/5' : 'border-line'}`}>
                <button role="switch" aria-checked={on} aria-label={WIDGET_LABEL[id]} onClick={() => toggle(id)} className={`h-5 w-5 rounded-md border ${on ? 'border-accent bg-accent' : 'border-line'}`} />
                <span className={`flex-1 text-sm ${on ? '' : 'text-mute'}`}>{WIDGET_LABEL[id]}</span>
                {on && (
                  <>
                    <button className="btn px-2 py-1 text-xs" aria-label={`Monter ${WIDGET_LABEL[id]}`} onClick={() => move(id, -1)}>↑</button>
                    <button className="btn px-2 py-1 text-xs" aria-label={`Descendre ${WIDGET_LABEL[id]}`} onClick={() => move(id, 1)}>↓</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-mute">Les 3 (petit écran) ou 4 premiers widgets s’affichent sous la BMW. Les valeurs N/A ne sont jamais remplacées par des estimations.</p>
      </div>
    </div>
  );
}
