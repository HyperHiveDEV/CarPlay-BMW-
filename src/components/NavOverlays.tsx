import { useEffect, useRef } from 'react';
import { useScene, OPENING_LABEL } from '../state/sceneStore';
import { CAMERA_PRESETS, type CameraPreset } from '../three/cameraPresets';
import type { OpeningKey } from '../vehicle/types';
import { Icon } from './Icons';
import { focusEl, focusablesIn } from '../input/focusNavigator';
import type { Screen } from '../App';

/**
 * Menu OPTION contextuel (bouton OPTION de l'iDrive, touche « O » au clavier).
 * Toutes les commandes sont accessibles sans écran tactile.
 */
export function OptionMenu({ screen, can3d, onClose, go, section }: { screen: Screen; can3d: boolean; onClose: () => void; go: (s: Screen) => void; section?: 'openings' }) {
  const scene = useScene();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const first = section === 'openings' ? ref.current?.querySelector<HTMLElement>('[data-section="openings"] button') : focusablesIn(ref.current!)[1];
    focusEl(first ?? null);
  }, [section]);
  const with3d = can3d && (screen === 'home' || screen === 'vehicle');
  const item = (label: string, onClick: () => void, active = false, disabled = false) => (
    <button key={label} disabled={disabled} onClick={() => { onClick(); onClose(); }}
      className={`btn w-full justify-start px-3 py-2 text-sm ${active ? 'btn-on' : ''}`}>{label}</button>
  );
  return (
    <div data-nav-modal className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div ref={ref} className="card max-h-[92vh] w-[min(36rem,94vw)] overflow-y-auto p-4 screen-enter" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-light">Options</h2>
          <button data-nav-close className="btn px-2 py-2" onClick={onClose} aria-label="Fermer"><Icon.close width={16} height={16} /></button>
        </div>
        {with3d ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="label">Vue 3D</div>
              {item('Piloter la vue 3D', () => scene.set({ navMode: 'scene' }))}
              {(Object.keys(CAMERA_PRESETS) as CameraPreset[]).map((c) => item(`Caméra : ${CAMERA_PRESETS[c].label}`, () => scene.goCamera(c), scene.camera === c))}
            </div>
            <div className="space-y-1.5" data-section="openings">
              <div className="label">Ouvrants (animation 3D)</div>
              {(Object.keys(OPENING_LABEL) as OpeningKey[]).map((k) =>
                item(`${scene.openings[k] ? 'Fermer' : 'Ouvrir'} : ${OPENING_LABEL[k]}`, () => scene.toggle(k), scene.openings[k], !scene.openingsSupported),
              )}
              <div className="label pt-2">Éclairage simulé</div>
              {item('Feux éteints', () => scene.set({ lightMode: 'off' }), scene.lightMode === 'off')}
              {item('Phares blancs', () => scene.set({ lightMode: 'white' }), scene.lightMode === 'white')}
              {item('Phares violets', () => scene.set({ lightMode: 'violet' }), scene.lightMode === 'violet')}
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="label">Aller à</div>
            {(['home', 'vehicle', 'engine', 'maintenance', 'media', 'settings'] as Screen[]).map((s) =>
              item({ home: 'My BMW', vehicle: 'Vehicle', engine: 'Engine', maintenance: 'Maintenance', media: 'Media', settings: 'Settings' }[s], () => go(s), s === screen),
            )}
            {!can3d && (screen === 'home' || screen === 'vehicle') && <p className="pt-2 text-xs text-mute">Commandes 3D indisponibles : véhicule en mouvement ou vitesse inconnue.</p>}
          </div>
        )}
        <p className="mt-3 text-[0.7rem] text-mute">BACK / Échap : fermer · rotation / flèches : choisir · pression / Entrée : valider</p>
      </div>
    </div>
  );
}

/** Aide affichée pendant le pilotage de la vue 3D. */
export function SceneHud() {
  const mode = useScene((s) => s.navMode);
  if (mode !== 'scene') return null;
  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-xl border border-accent/60 bg-ink/85 px-4 py-2 text-center text-[0.78rem] shadow-lg backdrop-blur">
      <div className="label mb-0.5 text-accent">Pilotage de la vue 3D</div>
      ◀ ▶ rotation · ▲ ▼ inclinaison · + / − zoom · Valider : ouvrants · BACK : quitter
    </div>
  );
}
