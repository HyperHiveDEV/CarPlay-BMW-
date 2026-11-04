import { useCallback, useEffect, useRef, useState } from 'react';
import { CarScene } from './three/CarScene';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { IntroOverlay } from './components/IntroOverlay';
import { OptionMenu, SceneHud } from './components/NavOverlays';
import { useLayout } from './components/layout';
import { HomeScreen } from './screens/HomeScreen';
import { VehicleScreen } from './screens/VehicleScreen';
import { EngineScreen } from './screens/EngineScreen';
import { MaintenanceScreen } from './screens/MaintenanceScreen';
import { MediaScreen } from './screens/MediaScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DrivingView } from './screens/DrivingView';
import { useSettings } from './settings/settingsStore';
import { useScene } from './state/sceneStore';
import { ConnectionManager } from './vehicle/ConnectionManager';
import { useMotionState } from './vehicle/drivingSafety';
import { setAlertThresholds } from './vehicle/VehicleDataRepository';
import { inputManager } from './input/InputManager';
import { activeRoot, closeActiveModal, focusEl, navigate } from './input/focusNavigator';
import type { NavAction } from './input/actions';
import { BODY_KEYS, simulatedBody, setBodyProvider, useBodyStatus, NoBodyStatusProvider } from './vehicle/bodyStatus';

export type Screen = 'home' | 'vehicle' | 'engine' | 'maintenance' | 'media' | 'settings';

/** Écrans accessibles en mouvement : informations essentielles et multimédia simple. */
const ALLOWED_MOVING: Screen[] = ['engine', 'media'];
const TITLES: Record<Screen, string> = { home: 'My BMW', vehicle: 'Vehicle', engine: 'Engine', maintenance: 'Maintenance', media: 'Media', settings: 'Settings' };

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const history = useRef<Screen[]>([]);
  const [option, setOption] = useState<null | 'menu' | 'openings'>(null);
  const accent = useSettings((s) => s.accent);
  const theme = useSettings((s) => s.theme);
  const introEnabled = useSettings((s) => s.introEnabled);
  const dataSource = useSettings((s) => s.dataSource);
  const defaultCamera = useSettings((s) => s.defaultCamera);
  const alertThresholds = useSettings((s) => s.alertThresholds);
  const acquisition = useSettings((s) => s.acquisition);
  const keymap = useSettings((s) => s.keymap);
  const ortho = new URLSearchParams(location.search).has('ortho');
  const [phase, setPhase] = useState<'logo' | 'reveal' | 'done'>(introEnabled && !ortho ? 'logo' : 'done');
  const motion = useMotionState();
  const layout = useLayout();

  // seuils d'alerte et fréquence d'acquisition (Engine V2 / Réglages)
  useEffect(() => setAlertThresholds(alertThresholds), [alertThresholds]);
  useEffect(() => ConnectionManager.setAcquisitionMode(acquisition), [acquisition]);
  useEffect(() => inputManager.setKeymap(keymap), [keymap]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    document.documentElement.dataset.theme = theme;
  }, [accent, theme]);

  // Démarrage de la source de données
  useEffect(() => {
    if (dataSource === 'demo') void ConnectionManager.startDemo();
    else ConnectionManager.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // États des ouvrants : simulation en démonstration, aucune source réelle validée sinon (états inconnus)
  useEffect(() => {
    setBodyProvider(dataSource === 'demo' ? simulatedBody : new NoBodyStatusProvider());
  }, [dataSource]);
  // Animation 3D synchronisée sur les états filtrés (jamais de commande vers le véhicule)
  useEffect(
    () =>
      useBodyStatus.subscribe((b, prev) => {
        if (!b.sync) return;
        for (const k of BODY_KEYS) {
          const st = b.states[k].state;
          if (st === prev.states[k].state || st === 'unknown') continue;
          const open = st === 'open';
          if (useScene.getState().openings[k] !== open) useScene.getState().toggle(k);
        }
      }),
    [],
  );

  // Pause / reprise lorsque l'application passe en arrière-plan
  useEffect(() => {
    const h = () => (document.hidden ? ConnectionManager.pause() : ConnectionManager.resume());
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);

  useEffect(() => {
    useScene.getState().goCamera(defaultCamera);
    if (!introEnabled) useScene.getState().set({ introDone: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== 'logo') return;
    const t = setTimeout(() => setPhase('reveal'), 1200);
    return () => clearTimeout(t);
  }, [phase]);

  const finishIntro = useCallback(() => {
    setPhase('done');
    useScene.getState().set({ introDone: true });
  }, []);
  const skip = () => {
    useScene.getState().set({ lightMode: 'violet' });
    finishIntro();
  };

  const go = useCallback((s: Screen) => {
    setScreen((cur) => {
      if (cur !== s) history.current = [...history.current.slice(-19), cur];
      return s;
    });
    useScene.getState().set({ navMode: 'ui' });
  }, []);

  const lockedScreen = motion === 'moving' ? !ALLOWED_MOVING.includes(screen) : motion === 'unknown' ? !['engine', 'media', 'settings'].includes(screen) : false;
  const show3d = (screen === 'home' || screen === 'vehicle') && !lockedScreen;
  const ready = phase === 'done';
  const can3d = show3d && motion === 'stationary' && ready;
  // la voiture est centrée dans la zone utile (entre la barre latérale et la colonne de droite)
  const shift = screen === 'home' ? (layout.sidebarPx - layout.asidePx) / 2 / layout.w : screen === 'vehicle' ? 0.02 : 0;

  // le pilotage 3D se coupe si la 3D devient indisponible (mouvement, autre écran)
  useEffect(() => {
    if (!can3d && useScene.getState().navMode === 'scene') useScene.getState().set({ navMode: 'ui' });
  }, [can3d]);

  // ---------------------------------------------------------------- commandes (clavier, Android, iDrive…)
  const state = useRef({ screen, can3d, option });
  state.current = { screen, can3d, option };
  useEffect(() => {
    const offKeys = inputManager.attachKeyboard(window);
    const offNative = inputManager.attachCustomEvents(window);
    const off = inputManager.subscribe((a: NavAction) => {
      const { can3d: c3d, option: opt } = state.current;
      const scene = useScene.getState();
      // fenêtre ouverte : focus confiné, BACK ferme
      if (activeRoot() !== document) {
        if (a === 'back' || a === 'option') return closeActiveModal() || (opt ? (setOption(null), true) : true);
        if (a === 'home') { closeActiveModal(); setOption(null); go('home'); return true; }
        return navigate(a === 'zoomIn' || a === 'zoomOut' ? 'select' : a);
      }
      // pilotage de la vue 3D
      if (scene.navMode === 'scene' && c3d) {
        const step = 0.26;
        switch (a) {
          case 'left': case 'prev': scene.orbit(-step, 0); return true;
          case 'right': case 'next': scene.orbit(step, 0); return true;
          case 'up': scene.orbit(0, -0.12); return true;
          case 'down': scene.orbit(0, 0.12); return true;
          case 'zoomIn': scene.orbit(0, 0, 0.85); return true;
          case 'zoomOut': scene.orbit(0, 0, 1.18); return true;
          case 'select': setOption('openings'); return true;
          case 'option': setOption('menu'); return true;
          case 'back': scene.set({ navMode: 'ui' }); return true;
          case 'home': scene.set({ navMode: 'ui' }); go('home'); return true;
        }
      }
      switch (a) {
        case 'option': setOption('menu'); return true;
        case 'home':
          go('home');
          setTimeout(() => focusEl(document.querySelector<HTMLElement>('[data-nav-zone="sidebar"] [aria-current="page"]')), 50);
          return true;
        case 'back': {
          const inSidebar = !!document.activeElement?.closest('[data-nav-zone="sidebar"]');
          const prev = history.current.pop();
          if (!inSidebar) return focusEl(document.querySelector<HTMLElement>('[data-nav-zone="sidebar"] [aria-current="page"]'));
          if (prev) { setScreen(prev); setTimeout(() => focusEl(document.querySelector<HTMLElement>('[data-nav-zone="sidebar"] [aria-current="page"]')), 50); }
          return true;
        }
        case 'zoomIn': case 'zoomOut':
          if (c3d) { scene.orbit(0, 0, a === 'zoomIn' ? 0.85 : 1.18); return true; }
          return false;
        default:
          return navigate(a);
      }
    });
    // un clic ou un toucher masque le contour de focus « molette »
    const onPointer = () => delete document.documentElement.dataset.navFocus;
    window.addEventListener('pointerdown', onPointer);
    return () => { offKeys(); offNative(); off(); window.removeEventListener('pointerdown', onPointer); };
  }, [go]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <CarScene visible={show3d || phase !== 'done'} interactive={can3d} shift={phase === 'done' ? shift : 0} introActive={phase !== 'done'} onIntroDone={finishIntro} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_48%,transparent_45%,rgb(var(--c-ink)/.8)_100%)]" style={{ opacity: show3d ? 1 : 0 }} />
      <div className={`relative z-10 flex h-full transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ pointerEvents: ready ? 'auto' : 'none' }}>
        <div className="pointer-events-auto h-full">
          <Sidebar current={screen} go={go} disabled={motion === 'moving' ? (['home', 'vehicle', 'maintenance', 'settings'] as Screen[]) : []} />
        </div>
        <div className="relative flex h-full min-w-0 flex-1 flex-col">
          <div className="pointer-events-auto"><TopBar title={TITLES[screen]} showClock={screen !== 'home' || lockedScreen} /></div>
          <div className="pointer-events-none relative min-h-0 flex-1">
            <div key={screen} data-nav-zone={screen === 'home' && !lockedScreen ? undefined : 'main'} data-nav-order="1" className={`absolute inset-0 ${show3d ? '' : 'pointer-events-auto'}`}>
              {lockedScreen ? (
                <DrivingView motion={motion} />
              ) : screen === 'home' ? (
                <HomeScreen go={go} ready={ready} density={layout.density} can3d={can3d} />
              ) : screen === 'vehicle' ? (
                <VehicleScreen />
              ) : screen === 'engine' ? (
                <EngineScreen />
              ) : screen === 'maintenance' ? (
                <MaintenanceScreen locked={motion !== 'stationary'} />
              ) : screen === 'media' ? (
                <MediaScreen />
              ) : (
                <SettingsScreen />
              )}
            </div>
            {show3d && <ModelTag />}
            <SceneHud />
          </div>
        </div>
      </div>
      {option && <OptionMenu screen={screen} can3d={can3d} go={go} section={option === 'openings' ? 'openings' : undefined} onClose={() => setOption(null)} />}
      <IntroOverlay phase={phase} onSkip={skip} />
    </div>
  );
}

function ModelTag() {
  const status = useScene((s) => s.modelStatus);
  const hovered = useScene((s) => s.hovered);
  if (status === 'glb' && !hovered) return null;
  return (
    <div className="pointer-events-none absolute bottom-[7.6rem] left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center" style={{ marginLeft: '-9rem' }}>
      {status !== 'glb' && (
        <span className="rounded-md border border-line/70 bg-ink/60 px-2 py-0.5 text-[0.6rem] font-semibold tracking-[0.14em] text-mute">MAQUETTE 3D PROVISOIRE · D’APRÈS VOS PHOTOS</span>
      )}
      {hovered && <span className="text-xs text-mute">Toucher pour animer · {hovered === 'hood' ? 'capot' : hovered === 'tailgate' ? 'hayon' : 'portière'}</span>}
    </div>
  );
}
