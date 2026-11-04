import { useSettings } from '../settings/settingsStore';
import { useScene } from '../state/sceneStore';
import { fmtDate, fmtKm, fmtTime, useNow } from '../components/Clock';
import { Icon } from '../components/Icons';
import { Segmented } from '../components/ui';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import { DEMO_MILEAGE_KM } from '../maintenance/demoHistory';
import type { Screen } from '../App';

export function HomeScreen({ go, ready }: { go: (s: Screen) => void; ready: boolean }) {
  const v = useSettings((s) => s.vehicle);
  const dataSource = useSettings((s) => s.dataSource);
  const now = useNow(1000);
  const scene = useScene();
  const km = v.mileageKm ?? (dataSource === 'demo' ? DEMO_MILEAGE_KM : null);
  const kmIsDemo = v.mileageKm == null && dataSource === 'demo';
  if (!ready) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex">
      <div className="pointer-events-auto flex h-full w-[min(36vw,440px)] flex-col justify-between py-2 pl-10 stagger">
        <div>
          <div className="label">My BMW</div>
          <h1 className="mt-2 text-[clamp(40px,5.4vw,72px)] font-extralight leading-none tracking-tight">BMW 116i</h1>
          <div className="mt-3 flex items-center gap-3 text-lg font-light text-mute">
            <span>{v.generation}</span>
            <span className="h-1 w-1 rounded-full bg-mute/60" />
            <span>M Sport · 3 portes</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Spec k="Moteur" v={`${v.engine} · ${(v.displacementCc / 1000).toFixed(1)} L Turbo`} s={`${v.cylinders} cylindres · essence`} />
          <Spec k="Préparation" v={v.stage} s={`origine ${v.stockHp} ch`} accent />
          <Spec k="Puissance déclarée" v={`${v.declaredHp} ch`} s="valeur déclarative, non mesurée" />
          <button className="text-left" onClick={() => go('settings')}>
            <Spec k="Kilométrage" v={km == null ? 'Non renseigné' : `${fmtKm(km)} km`} s={kmIsDemo ? 'valeur DEMO — à saisir' : v.mileageUpdatedAt ? `saisi le ${new Date(v.mileageUpdatedAt).toLocaleDateString('fr-FR')}` : 'toucher pour saisir'} />
          </button>
        </div>
        <div>
          <div className="text-[clamp(44px,5vw,64px)] font-extralight leading-none tabular-nums">{fmtTime(now)}</div>
          <div className="mt-2 text-base capitalize text-mute">{fmtDate(now)}</div>
        </div>
      </div>

      <div className="pointer-events-auto absolute bottom-3 right-8 flex items-center gap-3">
        <Segmented<CameraPreset>
          value={scene.camera}
          onChange={(c) => scene.goCamera(c)}
          options={(['front34', 'side', 'rear34', 'wheel'] as CameraPreset[]).map((c) => ({ value: c, label: CAMERA_PRESETS[c].label }))}
        />
        <Segmented
          value={scene.lightMode}
          onChange={(m) => scene.set({ lightMode: m })}
          options={[{ value: 'off', label: 'Feux off' }, { value: 'white', label: 'Blanc' }, { value: 'violet', label: 'Violet' }]}
        />
        <button className="btn" onClick={() => go('vehicle')}>
          <Icon.car width={18} height={18} /> Ouvrants
        </button>
      </div>
    </div>
  );
}

function Spec({ k, v, s, accent }: { k: string; v: string; s?: string; accent?: boolean }) {
  return (
    <div className="card px-4 py-3.5">
      <div className="label">{k}</div>
      <div className={`mt-1.5 text-xl font-normal ${accent ? 'text-accent' : ''}`}>{v}</div>
      {s && <div className="mt-0.5 text-xs text-mute">{s}</div>}
    </div>
  );
}
