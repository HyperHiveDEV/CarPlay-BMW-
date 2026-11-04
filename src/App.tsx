import { useCallback, useEffect, useState } from 'react';
import { CarScene } from './three/CarScene';
import { TopBar } from './components/TopBar';
import { NavBar } from './components/NavBar';
import { IntroOverlay } from './components/IntroOverlay';
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

export type Screen = 'home' | 'vehicle' | 'engine' | 'maintenance' | 'media' | 'settings';

/** Écrans accessibles en mouvement : informations essentielles et multimédia simple. */
const ALLOWED_MOVING: Screen[] = ['engine', 'media'];

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const accent = useSettings((s) => s.accent);
  const theme = useSettings((s) => s.theme);
  const introEnabled = useSettings((s) => s.introEnabled);
  const dataSource = useSettings((s) => s.dataSource);
  const defaultCamera = useSettings((s) => s.defaultCamera);
  const ortho = new URLSearchParams(location.search).has('ortho');
  const [phase, setPhase] = useState<'logo' | 'reveal' | 'done'>(introEnabled && !ortho ? 'logo' : 'done');
  const motion = useMotionState();

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

  const lockedScreen = motion === 'moving' ? !ALLOWED_MOVING.includes(screen) : motion === 'unknown' ? !['engine', 'media', 'settings'].includes(screen) : false;
  const show3d = (screen === 'home' || screen === 'vehicle') && !lockedScreen;
  const shift = screen === 'home' ? 0.11 : 0.02;
  const ready = phase === 'done';

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-ink">
      <CarScene visible={show3d || phase !== 'done'} interactive={show3d && motion === 'stationary' && ready} shift={phase === 'done' ? shift : 0.11} introActive={phase !== 'done'} onIntroDone={finishIntro} />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_70%_45%,transparent_40%,rgb(var(--c-ink)/.85)_100%)]" style={{ opacity: show3d ? 1 : 0 }} />
      <div className={`relative z-10 flex h-full flex-col transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`} style={{ pointerEvents: ready ? 'auto' : 'none' }}>
        <div className="pointer-events-auto"><TopBar /></div>
        <div className="pointer-events-none relative min-h-0 flex-1">
          <div key={screen} className={`absolute inset-0 ${show3d ? '' : 'pointer-events-auto'}`}>
            {lockedScreen ? (
              <DrivingView motion={motion} />
            ) : screen === 'home' ? (
              <HomeScreen go={setScreen} ready={ready} />
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
        </div>
        <div className="pointer-events-auto flex justify-center">
          <NavBar current={screen} go={setScreen} disabled={motion === 'moving' ? (['home', 'vehicle', 'maintenance', 'settings'] as Screen[]) : []} />
        </div>
      </div>
      <IntroOverlay phase={phase} onSkip={skip} />
    </div>
  );
}

function ModelTag() {
  const status = useScene((s) => s.modelStatus);
  const hovered = useScene((s) => s.hovered);
  if (status === 'glb' && !hovered) return null;
  return (
    <div className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-center">
      {status !== 'glb' && (
        <span className="rounded-md border border-line bg-ink/60 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-mute">RECONSTITUTION 3D D’APRÈS VOS PHOTOS</span>
      )}
      {hovered && <span className="text-xs text-mute">Toucher pour animer · {hovered === 'hood' ? 'capot' : hovered === 'tailgate' ? 'hayon' : 'portière'}</span>}
    </div>
  );
}
