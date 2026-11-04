import { useScene, OPENING_LABEL, type Blinker } from '../state/sceneStore';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import type { OpeningKey } from '../vehicle/types';
import { Icon } from '../components/Icons';
import { MetricTile, Segmented, SourceBadge, Toggle } from '../components/ui';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import { useSettings } from '../settings/settingsStore';

const OPENINGS: { key: OpeningKey; icon: keyof typeof Icon }[] = [
  { key: 'driverDoor', icon: 'door' },
  { key: 'passengerDoor', icon: 'door' },
  { key: 'hood', icon: 'hood' },
  { key: 'tailgate', icon: 'tailgate' },
];

const STATUS_LABEL: Record<string, string> = {
  demo: 'Mode démonstration', disconnected: 'Déconnecté', scanning: 'Recherche…', connecting: 'Connexion…',
  initializing: 'Initialisation…', connected: 'Connecté (OBD-II)', error: 'Erreur de connexion',
};

export function VehicleScreen() {
  const scene = useScene();
  const snap = useVehicleRepo((s) => s.snapshot);
  const conn = useVehicleRepo((s) => s.connection);
  const defaultCam = useSettings((s) => s.defaultCamera);
  const m = snap.metrics;
  const canOpen = scene.openingsSupported;

  return (
    <div className="pointer-events-none absolute inset-0 flex justify-between gap-6 px-8 pb-2">
      <div className="pointer-events-auto flex w-[min(30vw,360px)] flex-col gap-3 overflow-y-auto pb-2 stagger">
        <div>
          <div className="label">Vehicle</div>
          <h1 className="mt-1 text-3xl font-light">État du véhicule</h1>
        </div>
        <div className="card p-2">
          {OPENINGS.map(({ key, icon }) => {
            const I = Icon[icon];
            const real = snap.openings[key];
            const animOpen = scene.openings[key];
            return (
              <button
                key={key}
                disabled={!canOpen}
                onClick={() => scene.toggle(key)}
                onMouseEnter={() => scene.set({ hovered: key })}
                onMouseLeave={() => scene.set({ hovered: null })}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-ink/50 ${scene.hovered === key ? 'bg-ink/50' : ''}`}
              >
                <span className={`grid h-10 w-10 place-items-center rounded-xl border ${animOpen ? 'border-accent text-accent' : 'border-line text-mute'}`}>
                  <I width={20} height={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{OPENING_LABEL[key]}</span>
                  <span className="flex items-center gap-2 text-xs text-mute">
                    État réel : {real.state === 'unknown' ? 'non disponible' : real.state === 'open' ? 'ouvert' : 'fermé'}
                    <SourceBadge source={real.source} />
                  </span>
                </span>
                <span className="text-xs text-mute">{!canOpen ? 'N/D' : animOpen ? 'Fermer' : 'Ouvrir'}</span>
              </button>
            );
          })}
          <p className="px-3 pb-2 pt-1 text-[11px] leading-relaxed text-mute">
            {canOpen
              ? 'Animation 3D uniquement : aucune commande d’ouverture, de fermeture ou de verrouillage n’est envoyée au véhicule.'
              : 'Le modèle GLB maquette n’a pas d’ouvrants séparés : animations disponibles avec RealisticF21 (Réglages › Rendu 3D › Modèle 3D).'}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Batterie" metric={m.battery} digits={1} icon={<Icon.battery width={16} height={16} />} />
          <MetricTile label="Carburant" metric={m.fuel} icon={<Icon.fuel width={16} height={16} />} />
          <MetricTile label="Moteur" metric={m.coolantTemp} icon={<Icon.temp width={16} height={16} />} />
          <div className="card p-4">
            <div className="label">Connexion</div>
            <div className="mt-3 flex items-center gap-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${conn.status === 'connected' ? 'bg-ok' : conn.status === 'demo' ? 'bg-accent' : conn.status === 'error' ? 'bg-bad' : 'bg-mute'}`} />
              {STATUS_LABEL[conn.status]}
            </div>
            {conn.deviceName && <div className="mt-1 truncate text-xs text-mute">{conn.deviceName}</div>}
          </div>
        </div>
        <div className="card p-4">
          <div className="label mb-2">Alertes</div>
          {snap.alerts.length === 0 ? (
            <div className="text-sm text-mute">Aucune alerte remontée par les données disponibles.</div>
          ) : (
            snap.alerts.map((a) => (
              <div key={a.id} className={`flex items-center gap-2 text-sm ${a.level === 'critical' ? 'text-bad' : 'text-warn'}`}>
                <Icon.alert width={16} height={16} /> {a.message} <SourceBadge source={a.source} />
              </div>
            ))
          )}
          <div className="mt-2 text-[11px] text-mute">Les alertes officielles restent affichées par le combiné BMW.</div>
        </div>
      </div>

      <div className="pointer-events-auto flex w-[min(24vw,290px)] flex-col gap-3 overflow-y-auto pb-2 stagger">
        <div className="card p-4">
          <div className="label mb-3">Éclairage simulé</div>
          <Segmented value={scene.lightMode} onChange={(v) => scene.set({ lightMode: v })} options={[{ value: 'off', label: 'Éteint' }, { value: 'white', label: 'Blanc' }, { value: 'violet', label: 'Violet' }]} />
          <div className="mt-3 grid grid-cols-3 gap-2">
            {([['left', 'Gauche'], ['hazard', 'Détresse'], ['right', 'Droite']] as [Blinker, string][]).map(([b, l]) => (
              <button key={b} className={`btn px-2 text-xs ${scene.blinker === b ? 'btn-on' : ''}`} onClick={() => scene.set({ blinker: scene.blinker === b ? 'off' : b })}>
                {b === 'hazard' ? <Icon.hazard width={16} height={16} /> : <Icon.blinker width={16} height={16} />} {l}
              </button>
            ))}
          </div>
          <button
            className={`btn mt-2 w-full ${scene.brake ? 'btn-on' : ''}`}
            onPointerDown={() => scene.set({ brake: true })}
            onPointerUp={() => scene.set({ brake: false })}
            onPointerLeave={() => scene.brake && scene.set({ brake: false })}
          >
            <Icon.brake width={18} height={18} /> Feux stop (maintenir)
          </button>
          <div className="mt-2 text-[11px] text-mute">Représentation visuelle : n’agit pas sur les feux réels.</div>
        </div>
        <div className="card p-4">
          <div className="label mb-3">Jantes · démonstration</div>
          <div className="flex items-center justify-between text-sm">
            Rotation des roues <Toggle checked={scene.wheelSpin} onChange={(v) => scene.set({ wheelSpin: v })} label="Rotation des roues" />
          </div>
          <div className="mt-4 text-sm">Braquage</div>
          <input type="range" min={-1} max={1} step={0.01} value={scene.steer} onChange={(e) => scene.set({ steer: parseFloat(e.target.value) })} className="mt-2 w-full accent-[rgb(var(--c-accent))]" />
          <button className="btn mt-3 w-full" onClick={() => scene.goCamera('wheel')}>
            <Icon.wheel width={18} height={18} /> Examiner la jante
          </button>
        </div>
        <div className="card p-4">
          <div className="label mb-3">Caméra</div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((c) => (
              <button key={c} className={`btn px-2 text-xs ${scene.camera === c ? 'btn-on' : ''}`} onClick={() => scene.goCamera(c)}>
                {CAMERA_PRESETS[c].label}
              </button>
            ))}
          </div>
          <button
            className="btn mt-2 w-full"
            onClick={() => {
              scene.closeAll();
              scene.set({ steer: 0, wheelSpin: false, blinker: 'off' });
              scene.goCamera(defaultCam);
            }}
          >
            <Icon.reset width={18} height={18} /> Position initiale
          </button>
        </div>
      </div>
    </div>
  );
}
