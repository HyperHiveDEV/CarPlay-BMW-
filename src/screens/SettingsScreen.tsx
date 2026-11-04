import { useEffect, useState } from 'react';
import { ACTION_LABEL, DEFAULT_KEYMAP, NAV_ACTIONS, type NavAction } from '../input/actions';
import { InputManager } from '../input/InputManager';
import { useSettings, TRANSMISSION_LABEL, type ModelChoice, type Quality, type Transmission } from '../settings/settingsStore';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { ConnectionManager } from '../vehicle/ConnectionManager';
import type { BtDevice } from '../obd/transport';
import { isAllowedCommand } from '../obd/readOnlyGuard';
import { useScene } from '../state/sceneStore';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import { Notice, Row, SectionTitle, Segmented, Toggle } from '../components/ui';
import { Icon } from '../components/Icons';
import { resolveTier } from '../three/CarScene';
import type { DemoScenario } from '../vehicle/SimulatedVehicleProvider';
import type { AcquisitionMode } from '../vehicle/acquisition';
import { simulatedBody, useBodyStatus } from '../vehicle/bodyStatus';
import type { OpeningKey } from '../vehicle/types';

type Section = 'appearance' | '3d' | 'vehicle' | 'data' | 'controls' | 'diag';
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'appearance', label: 'Interface' },
  { id: '3d', label: 'Rendu 3D' },
  { id: 'vehicle', label: 'Véhicule' },
  { id: 'data', label: 'Source de données' },
  { id: 'controls', label: 'Commandes' },
  { id: 'diag', label: 'Diagnostic' },
];

export function SettingsScreen() {
  const [sec, setSec] = useState<Section>('appearance');
  const s = useSettings();
  return (
    <div className="absolute inset-0 overflow-y-auto px-8 pb-4 screen-enter">
      <SectionTitle kicker="Settings" title="Réglages" />
      <div className="grid grid-cols-[240px_1fr] gap-5">
        <div className="card self-start p-2">
          {SECTIONS.map((x) => (
            <button key={x.id} onClick={() => setSec(x.id)} className={`flex w-full rounded-xl px-3 py-3 text-left text-sm ${sec === x.id ? 'bg-ink/70 ring-1 ring-accent/40' : 'text-mute hover:text-fg'}`}>
              {x.label}
            </button>
          ))}
          <div className="mt-2 border-t border-line/60 p-2">
            <button className="btn w-full text-bad" onClick={() => confirm('Réinitialiser toutes les préférences ? (l’historique d’entretien est conservé)') && s.reset()}>
              <Icon.reset width={16} height={16} /> Réinitialiser
            </button>
          </div>
        </div>
        <div className="card min-w-0 px-6 py-2">
          {sec === 'appearance' && (
            <>
              <Row label="Couleur d’accent" hint="Le violet rappelle les phares personnalisés.">
                <Segmented value={s.accent} onChange={(v) => s.set({ accent: v })} options={[{ value: 'blue', label: 'Bleu BMW' }, { value: 'violet', label: 'Violet' }]} />
              </Row>
              <Row label="Mode d’affichage" hint="Jour : contraste renforcé pour la lecture au soleil.">
                <Segmented value={s.theme} onChange={(v) => s.set({ theme: v })} options={[{ value: 'night', label: 'Nuit' }, { value: 'day', label: 'Jour' }]} />
              </Row>
              <Row label="Unités" hint="Système métrique (km, km/h, °C, bar).">
                <span className="text-sm text-mute">Métrique</span>
              </Row>
              <Row label="Animation d’accueil" hint="Séquence d’ouverture de ~3,5 s.">
                <Toggle checked={s.introEnabled} onChange={(v) => s.set({ introEnabled: v })} />
              </Row>
            </>
          )}
          {sec === '3d' && <ThreeDSection />}
          {sec === 'vehicle' && <VehicleSection />}
          {sec === 'data' && <DataSection />}
          {sec === 'controls' && <ControlsSection />}
          {sec === 'diag' && <DiagSection />}
        </div>
      </div>
    </div>
  );
}

function ThreeDSection() {
  const s = useSettings();
  return (
    <>
      <Row label="Qualité graphique" hint="Auto : adapte la qualité au matériel et baisse si les FPS chutent.">
        <Segmented<Quality> value={s.quality} onChange={(v) => s.set({ quality: v })} options={[{ value: 'auto', label: 'Auto' }, { value: 'low', label: 'Économie' }, { value: 'medium', label: 'Standard' }, { value: 'high', label: 'Élevée' }]} />
      </Row>
      <Row label="Caméra par défaut">
        <select className="input w-48" value={s.defaultCamera} onChange={(e) => s.set({ defaultCamera: e.target.value as CameraPreset })}>
          {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((c) => <option key={c} value={c}>{CAMERA_PRESETS[c].label}</option>)}
        </select>
      </Row>
      <Row label="Sensibilité de rotation" hint={`${s.rotateSensitivity.toFixed(1)}×`}>
        <input type="range" min={0.2} max={2} step={0.1} value={s.rotateSensitivity} onChange={(e) => s.set({ rotateSensitivity: Number(e.target.value) })} className="w-56 accent-[rgb(var(--c-accent))]" />
      </Row>
      <ModelPicker />
      <Row label="Rotation lente automatique" hint="Rotation douce du véhicule à l’accueil.">
        <Toggle checked={s.autoRotate} onChange={(v) => s.set({ autoRotate: v })} />
      </Row>
    </>
  );
}

/** Sélecteur de modèle 3D (comparaison dans les mêmes conditions : caméra, éclairage, résolution). */
function ModelPicker() {
  const s = useSettings();
  return (
    <Row label="Modèle 3D" hint="Auto : modèle sous licence s’il est déposé (bmw_f21_lci.glb), sinon RealisticF21. GLB maquette : fichier personnalisé fourni (candidat, sans ouvrants séparés). En cas d’échec de chargement, repli automatique sur RealisticF21.">
      <Segmented<ModelChoice>
        value={s.modelSource}
        onChange={(v) => s.set({ modelSource: v })}
        options={[{ value: 'auto', label: 'Auto' }, { value: 'custom', label: 'GLB maquette' }, { value: 'realistic', label: 'RealisticF21' }, { value: 'legacy', label: 'Ancien' }]}
      />
    </Row>
  );
}

function VehicleSection() {
  const s = useSettings();
  const v = s.vehicle;
  const [km, setKm] = useState(v.mileageKm?.toString() ?? '');
  return (
    <>
      <Row label="Kilométrage" hint="Saisie manuelle : l’OBD générique ne fournit pas le compteur kilométrique de la F21.">
        <div className="flex gap-2">
          <input className="input w-36" inputMode="numeric" value={km} placeholder="km" onChange={(e) => setKm(e.target.value.replace(/[^\d]/g, ''))} />
          <button className="btn btn-accent" onClick={() => s.setVehicle({ mileageKm: km ? Number(km) : null, mileageUpdatedAt: km ? new Date().toISOString() : null })}>Enregistrer</button>
        </div>
      </Row>
      <Row label="Transmission" hint="À confirmer sur le certificat d’immatriculation / la VIN.">
        <select className="input w-72" value={v.transmission} onChange={(e) => s.setVehicle({ transmission: e.target.value as Transmission })}>
          {(Object.keys(TRANSMISSION_LABEL) as Transmission[]).map((t) => <option key={t} value={t}>{TRANSMISSION_LABEL[t]}</option>)}
        </select>
      </Row>
      <Row label="Puissance déclarée (ch)" hint={`Préparation ${v.stage} — origine ${v.stockHp} ch`}>
        <input className="input w-24" inputMode="numeric" value={v.declaredHp} onChange={(e) => s.setVehicle({ declaredHp: Number(e.target.value.replace(/[^\d]/g, '')) || 0 })} />
      </Row>
      <Row label="Préparation">
        <input className="input w-40" value={v.stage} onChange={(e) => s.setVehicle({ stage: e.target.value.slice(0, 20) })} />
      </Row>
      <Row label="Texte de plaque (3D)" hint="Plaque neutre : aucune immatriculation réelle n’est affichée.">
        <input className="input w-48" value={v.plateText} onChange={(e) => s.setVehicle({ plateText: e.target.value.slice(0, 12) })} />
      </Row>
      <Row label="Bandeau de pare-brise (3D)">
        <input className="input w-48" value={v.windshieldBanner} onChange={(e) => s.setVehicle({ windshieldBanner: e.target.value.slice(0, 18).toUpperCase() })} />
      </Row>
      <Row label="Identité" hint="BMW Série 1 116i · F21 LCI 2018 · 3 portes · M Sport · B38 1 499 cm³ 3 cylindres turbo essence">
        <span className="text-sm text-mute">Fixe</span>
      </Row>
    </>
  );
}

function DataSection() {
  const s = useSettings();
  const conn = useVehicleRepo((r) => r.connection);
  const [devices, setDevices] = useState<BtDevice[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const native = ConnectionManager.transport.nativeAvailable;

  const act = async (fn: () => Promise<unknown>) => {
    setErr(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Row label="Source des données véhicule" hint="DEMO : simulation complète. OBD-II : adaptateur ELM327 Bluetooth (lecture seule).">
        <Segmented
          value={s.dataSource}
          onChange={(v) => {
            s.set({ dataSource: v });
            if (v === 'demo') void ConnectionManager.startDemo();
            else void ConnectionManager.disconnect();
          }}
          options={[{ value: 'demo', label: 'Démonstration' }, { value: 'obd', label: 'OBD-II' }]}
        />
      </Row>
      <Row
        label="Fréquence d’acquisition OBD"
        hint={`Auto : adaptée à la latence et aux erreurs de l’adaptateur (1 à 10 Hz). Mesuré : ${conn.acquisitionHz ? `${conn.acquisitionHz} Hz` : '—'}${conn.latencyMs ? `, ${conn.latencyMs} ms/requête` : ''}${conn.limitedByAdapter ? ' — fréquence demandée supérieure aux capacités de l’adaptateur' : ''}.`}
      >
        <Segmented<AcquisitionMode> value={s.acquisition} onChange={(v) => s.set({ acquisition: v })} options={[{ value: 'auto', label: 'Auto' }, { value: '2', label: '2 Hz' }, { value: '5', label: '5 Hz' }, { value: '10', label: '10 Hz' }]} />
      </Row>
      {s.dataSource === 'obd' && (
        <div className="py-4">
          {!native && <Notice tone="warn">Connexion OBD disponible uniquement dans l’APK Android (Bluetooth série SPP). Sur PC, utilisez le mode démonstration.</Notice>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button className="btn btn-accent" disabled={!native || busy} onClick={() => act(async () => setDevices(await ConnectionManager.scan(true)))}><Icon.bt width={16} height={16} /> Rechercher les adaptateurs</button>
            {s.lastObdAddress && (
              <button className="btn" disabled={!native || busy} onClick={() => act(() => ConnectionManager.connectObd({ address: s.lastObdAddress!, name: s.lastObdName ?? undefined }))}>Reconnecter {s.lastObdName ?? s.lastObdAddress}</button>
            )}
            {(conn.status === 'connected' || conn.status === 'error') && <button className="btn" onClick={() => act(() => ConnectionManager.disconnect())}>Déconnecter</button>}
            <span className="text-sm text-mute">État : {conn.status}{conn.message ? ` — ${conn.message}` : ''}</span>
          </div>
          {devices && (
            <div className="mt-3 rounded-xl border border-line">
              {devices.length === 0 && <div className="p-3 text-sm text-mute">Aucun appareil trouvé. Jumelez l’adaptateur dans les réglages Bluetooth Android (code usuel 1234 ou 0000).</div>}
              {devices.map((d) => (
                <button key={d.address} disabled={busy} className="flex w-full items-center justify-between border-b border-line/50 px-4 py-3 text-left text-sm last:border-0 hover:bg-ink/40"
                  onClick={() => act(async () => { await ConnectionManager.connectObd(d); s.set({ lastObdAddress: d.address, lastObdName: d.name }); })}>
                  <span>{d.name || 'Appareil sans nom'} <span className="text-xs text-mute">{d.address}</span></span>
                  <span className="text-xs text-mute">{d.bonded ? 'jumelé' : 'détecté'}</span>
                </button>
              ))}
            </div>
          )}
          {err && <div className="mt-3"><Notice tone="bad">{err}</Notice></div>}
          {conn.supportedPids.length > 0 && (
            <div className="mt-4 text-xs text-mute">Protocole : {conn.protocol} · PID Mode 01 supportés : {conn.supportedPids.join(' ')}</div>
          )}
          <div className="mt-4"><Notice>Lecture seule : seules les requêtes Mode 01 (données courantes) et la lecture VIN sont autorisées. Écriture, codage, effacement des défauts et commandes d’actionneurs sont bloqués dans le code (JS et Kotlin). Les données propriétaires BMW ne sont pas accessibles via un adaptateur générique.</Notice></div>
        </div>
      )}
    </>
  );
}

/** États des ouvrants : simulation manuelle (démo) et option de synchronisation de l'animation 3D. */
function BodySimulation() {
  const body = useBodyStatus();
  const demo = useSettings((s) => s.dataSource === 'demo');
  const keys: [OpeningKey, string][] = [['driverDoor', 'Portière cond.'], ['passengerDoor', 'Portière pass.'], ['tailgate', 'Hayon'], ['hood', 'Capot']];
  return (
    <>
      <Row label="Synchroniser la 3D avec l’état des ouvrants" hint={`Source : ${body.kind === 'simulated' ? 'simulation (DEMO)' : 'aucune source réelle validée — états inconnus'}. Aucune commande n’est jamais envoyée au véhicule.`}>
        <Toggle checked={body.sync} onChange={(v) => body.set({ sync: v })} />
      </Row>
      <Row label="Simuler un signal d’ouvrant (DEMO)" hint="Filtrage anti-rebond 300 ms ; sans source réelle, les états restent « inconnu ».">
        <div className="flex flex-wrap justify-end gap-1.5">
          {keys.map(([k, l]) => {
            const st = body.states[k].state;
            return (
              <button key={k} className={`btn px-2.5 py-1.5 text-xs ${st === 'open' ? 'btn-on' : ''}`} disabled={!demo}
                onClick={() => { simulatedBody.simulate(k, st === 'open' ? 'closed' : 'open'); setTimeout(() => simulatedBody.simulate(k, st === 'open' ? 'closed' : 'open'), 350); }}>
                {l} : {st === 'unknown' ? 'inconnu' : st === 'open' ? 'ouvert' : 'fermé'}
              </button>
            );
          })}
        </div>
      </Row>
    </>
  );
}

/** Commandes : molette iDrive (future passerelle), clavier, télécommande USB, croix Android. */
function ControlsSection() {
  const s = useSettings();
  const [capture, setCapture] = useState<NavAction | null>(null);
  const map = { ...DEFAULT_KEYMAP, ...s.keymap };
  const keysFor = (a: NavAction) => Object.entries(map).filter(([, v]) => v === a).map(([k]) => (k === ' ' ? 'Espace' : k));
  useEffect(() => {
    if (!capture) return;
    const on = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      const k = InputManager.keyOf(e);
      if (k && k !== 'Escape') s.set({ keymap: { ...s.keymap, [k]: capture } });
      setCapture(null);
    };
    window.addEventListener('keydown', on, { capture: true });
    return () => window.removeEventListener('keydown', on, { capture: true });
  }, [capture, s]);
  return (
    <>
      <Notice>Interface pilotable sans écran tactile. La réception réelle des commandes iDrive dépendra de la passerelle matérielle choisie ; elle enverra ces mêmes actions à l’application.</Notice>
      {NAV_ACTIONS.map((a) => (
        <Row key={a} label={ACTION_LABEL[a]} hint={keysFor(a).join(' · ') || 'aucune touche'}>
          <button className={`btn px-3 py-1.5 text-xs ${capture === a ? 'btn-on' : ''}`} onClick={() => setCapture(a)}>{capture === a ? 'Appuyez sur une touche…' : 'Ajouter une touche'}</button>
        </Row>
      ))}
      <Row label="Touches personnalisées" hint={Object.keys(s.keymap).length ? Object.entries(s.keymap).map(([k, v]) => `${k} → ${ACTION_LABEL[v]}`).join(' · ') : 'aucune'}>
        <button className="btn px-3 py-1.5 text-xs" disabled={!Object.keys(s.keymap).length} onClick={() => s.set({ keymap: {} })}>Réinitialiser</button>
      </Row>
    </>
  );
}

function DiagSection() {
  const s = useSettings();
  const scene = useScene();
  const repo = useVehicleRepo();
  const [scenario, setScenario] = useState<DemoScenario>(ConnectionManager.simulator.scenario);
  const [cmd, setCmd] = useState('010C');
  return (
    <>
      <Row label="Mode diagnostic" hint="Affiche FPS et état du rendu dans la barre supérieure.">
        <Toggle checked={s.diagnostics} onChange={(v) => s.set({ diagnostics: v })} />
      </Row>
      <Row label="Scénario de démonstration" hint="« Roulage » permet de tester le verrouillage de l’interface en mouvement.">
        <Segmented<DemoScenario> value={scenario} disabled={s.dataSource !== 'demo'} onChange={(v) => { setScenario(v); ConnectionManager.setDemoScenario(v); }} options={[{ value: 'parked', label: 'Moteur arrêté' }, { value: 'idle', label: 'Ralenti' }, { value: 'driving', label: 'Roulage' }]} />
      </Row>
      <Row label="Rendu" hint={`Niveau effectif : ${resolveTier(s.quality, 0)} · ${scene.fps} FPS · WebGL ${document.createElement('canvas').getContext('webgl2') ? '2' : '1'}`}>
        <span className="text-sm text-mute">{scene.modelStatus}</span>
      </Row>
      <ModelPicker />
      <Row label="Modèle 3D chargé" hint={scene.modelMessage}>
        <span className="text-sm text-mute">{scene.modelStatus === 'glb' ? 'GLB' : scene.modelStatus === 'error' ? 'Repli' : 'Procédural'}</span>
      </Row>
      <Row label="Données" hint={`Dernière mise à jour : ${repo.snapshot.updatedAt ? new Date(repo.snapshot.updatedAt).toLocaleTimeString('fr-FR') : '—'} · valeurs rejetées par le validateur : ${repo.rejected}`}>
        <span className="text-sm text-mute">{repo.connection.status}</span>
      </Row>
      <BodySimulation />
      <Row label="Test de la garde lecture seule" hint="Vérifie si une commande serait transmise à l’adaptateur.">
        <div className="flex items-center gap-2">
          <input className="input w-32 font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} />
          <span className={`text-sm ${isAllowedCommand(cmd) ? 'text-ok' : 'text-bad'}`}>{isAllowedCommand(cmd) ? 'Autorisée' : 'Bloquée'}</span>
        </div>
      </Row>
    </>
  );
}
