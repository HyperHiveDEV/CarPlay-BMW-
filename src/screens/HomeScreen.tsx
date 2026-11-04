import { useState } from 'react';
import { ALL_HOME_WIDGETS, TRANSMISSION_LABEL, useSettings, type HomeWidgetId } from '../settings/settingsStore';
import { useScene, OPENING_LABEL } from '../state/sceneStore';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { Icon } from '../components/Icons';
import { Segmented, useMetricDisplay } from '../components/ui';
import { WIDGETS, WIDGET_LABEL } from '../components/HomeWidgets';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import type { Screen } from '../App';
import type { OpeningKey } from '../vehicle/types';
import { useTelemetry } from '../vehicle/telemetry';

/** My BMW V2 : identité du véhicule, widgets personnalisables, raccourcis, BMW 3D (7 caméras). */
export function HomeScreen({ go, ready }: { go: (s: Screen) => void; ready: boolean }) {
  const [editing, setEditing] = useState(false);
  const widgets = useSettings((s) => s.homeWidgets);
  if (!ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      <div className="pointer-events-auto flex h-full w-[min(38vw,470px)] flex-col gap-3 overflow-y-auto pb-2 pl-10 pr-1 stagger">
        <Identity />
        <div className="flex items-center justify-between pt-1">
          <span className="label">Widgets</span>
          <button className="btn px-3 py-1.5 text-xs" onClick={() => setEditing(true)}>
            <Icon.edit width={14} height={14} /> Personnaliser
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {widgets.map((id) => {
            const W = WIDGETS[id];
            return <W key={id} />;
          })}
          {widgets.length === 0 && <div className="col-span-2 text-sm text-mute">Aucun widget : touchez « Personnaliser ».</div>}
        </div>
      </div>
      <div className="pointer-events-auto absolute bottom-[68px] right-8 w-[min(46vw,560px)] stagger">
        <Shortcuts go={go} />
      </div>
      <CameraBar />
      {editing && <WidgetEditor onClose={() => setEditing(false)} />}
    </div>
  );
}

function Identity() {
  const v = useSettings((s) => s.vehicle);
  const gain = v.declaredHp - v.stockHp;
  return (
    <div>
      <div className="label">My BMW</div>
      <h1 className="mt-1.5 text-[clamp(38px,4.6vw,64px)] font-extralight leading-none tracking-tight">{v.name}</h1>
      <div className="mt-2.5 flex flex-wrap gap-2 text-xs">
        {[v.generation, 'M Sport', '3 portes', '2018'].map((t) => (
          <span key={t} className="rounded-md border border-line px-2 py-1 text-mute">{t}</span>
        ))}
      </div>
      <div className="card mt-4 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="label">Moteur</div>
            <div className="mt-1 text-xl">{v.engine} · {(v.displacementCc / 1000).toFixed(1)} L Turbo</div>
            <div className="text-xs text-mute">{v.cylinders} cylindres en ligne · essence · {v.displacementCc} cm³</div>
          </div>
          <span className="rounded-md border border-accent/50 bg-accent/10 px-2 py-1 text-xs font-semibold tracking-wider text-accent">{v.stage.toUpperCase()}</span>
        </div>
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <span className="label">Puissance déclarée</span>
            <span><span className="text-3xl font-light tabular-nums">{v.declaredHp}</span> <span className="text-sm text-mute">ch</span></span>
          </div>
          {/* barre origine → préparation : valeurs déclaratives, non mesurées */}
          <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-line/60">
            <div className="absolute inset-y-0 left-0 rounded-full bg-mute/50" style={{ width: `${(v.stockHp / v.declaredHp) * 100}%` }} />
            <div className="absolute inset-y-0 rounded-full bg-accent" style={{ left: `${(v.stockHp / v.declaredHp) * 100}%`, right: 0, animation: 'fadeUp .8s both' }} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-mute">
            <span>origine {v.stockHp} ch</span>
            <span>+{gain} ch ({Math.round((gain / v.stockHp) * 100)} %) · déclaratif, non mesuré</span>
          </div>
        </div>
        <div className="mt-3 border-t border-line/60 pt-2.5 text-xs text-mute">Transmission : {TRANSMISSION_LABEL[v.transmission]}</div>
      </div>
    </div>
  );
}

function Shortcuts({ go }: { go: (s: Screen) => void }) {
  const scene = useScene();
  const rpm = useMetricDisplay(useVehicleRepo((s) => s.snapshot.metrics.rpm));
  const coolant = useMetricDisplay(useVehicleRepo((s) => s.snapshot.metrics.coolantTemp));
  const recording = useTelemetry((s) => !!s.recording);
  const open = (Object.keys(scene.openings) as OpeningKey[]).filter((k) => scene.openings[k]);
  const items: { id: Screen; label: string; icon: keyof typeof Icon; sub: string }[] = [
    { id: 'vehicle', label: 'Vehicle', icon: 'car', sub: open.length ? `${open.map((k) => OPENING_LABEL[k].toLowerCase()).join(', ')} ouvert(s)` : 'ouvrants, feux, caméras' },
    { id: 'engine', label: 'Engine', icon: 'engine', sub: `${rpm.text} tr/min · ${coolant.text} °C${recording ? ' · REC' : ''}` },
    { id: 'maintenance', label: 'Maintenance', icon: 'wrench', sub: 'carnet et échéances' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2.5 pt-1">
      {items.map((it) => {
        const I = Icon[it.icon];
        return (
          <button key={it.id} onClick={() => go(it.id)} className="card group flex flex-col items-start gap-2 p-3 text-left transition duration-300 hover:-translate-y-0.5 hover:border-accent/50 active:scale-[.98]">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-line text-mute transition group-hover:border-accent group-hover:text-accent"><I width={18} height={18} /></span>
            <span className="text-sm">{it.label}</span>
            <span className="line-clamp-2 text-[11px] leading-snug text-mute">{it.sub}</span>
          </button>
        );
      })}
    </div>
  );
}

function CameraBar() {
  const scene = useScene();
  return (
    <div className="pointer-events-auto absolute bottom-3 right-8 flex flex-wrap items-center justify-end gap-3">
      <Segmented<CameraPreset>
        value={scene.camera}
        onChange={(c) => scene.goCamera(c)}
        options={(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((c) => ({ value: c, label: CAMERA_PRESETS[c].label }))}
      />
      <Segmented
        value={scene.lightMode}
        onChange={(m) => scene.set({ lightMode: m })}
        options={[{ value: 'off', label: 'Feux off' }, { value: 'white', label: 'Blanc' }, { value: 'violet', label: 'Violet' }]}
      />
    </div>
  );
}

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
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-[min(520px,92vw)] p-6 screen-enter" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-light">Widgets de l’accueil</h2>
          <button className="btn px-2 py-2" onClick={onClose} aria-label="Fermer"><Icon.close width={18} height={18} /></button>
        </div>
        <div className="space-y-1.5">
          {ordered.map((id) => {
            const on = widgets.includes(id);
            return (
              <div key={id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${on ? 'border-accent/40 bg-accent/5' : 'border-line'}`}>
                <button role="switch" aria-checked={on} aria-label={WIDGET_LABEL[id]} onClick={() => toggle(id)} className={`h-5 w-5 rounded-md border ${on ? 'border-accent bg-accent' : 'border-line'}`} />
                <span className={`flex-1 text-sm ${on ? '' : 'text-mute'}`}>{WIDGET_LABEL[id]}</span>
                {on && (
                  <>
                    <button className="btn px-2 py-1 text-xs" aria-label="Monter" onClick={() => move(id, -1)}>↑</button>
                    <button className="btn px-2 py-1 text-xs" aria-label="Descendre" onClick={() => move(id, 1)}>↓</button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-mute">Choix et ordre enregistrés localement. Les valeurs N/A ne sont jamais remplacées par des estimations.</p>
      </div>
    </div>
  );
}
