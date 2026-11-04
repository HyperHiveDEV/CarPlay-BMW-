import { useEffect, useState } from 'react';
import { AppLauncher, NATIVE_ONLY, nativeAvailable, type InstalledApp } from '../native/AppLauncher';
import { Icon } from '../components/Icons';
import { Notice, SectionTitle } from '../components/ui';

type Tab = 'music' | 'nav' | 'apps' | 'bt' | 'audio';
const TABS: { id: Tab; label: string; icon: keyof typeof Icon }[] = [
  { id: 'music', label: 'Musique', icon: 'media' },
  { id: 'nav', label: 'Navigation', icon: 'nav' },
  { id: 'apps', label: 'Applications', icon: 'apps' },
  { id: 'bt', label: 'Bluetooth', icon: 'bt' },
  { id: 'audio', label: 'Réglages audio', icon: 'volume' },
];

export function MediaScreen() {
  const [tab, setTab] = useState<Tab>('music');
  const [apps, setApps] = useState<InstalledApp[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const native = nativeAvailable();

  useEffect(() => {
    if (!native) return;
    AppLauncher.listApps().then(setApps).catch((e) => setError(String(e.message ?? e)));
  }, [native]);

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message ?? String(e));
    }
  };
  const byCat = (c: InstalledApp['category']) => (apps ?? []).filter((a) => a.category === c);

  return (
    <div className="absolute inset-0 overflow-y-auto px-8 pb-4 screen-enter">
      <SectionTitle kicker="Media" title="Multimédia" />
      <div className="grid grid-cols-[240px_1fr] gap-5">
        <div className="card self-start p-2">
          {TABS.map((t) => {
            const I = Icon[t.icon];
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${tab === t.id ? 'bg-ink/70 text-fg ring-1 ring-accent/40' : 'text-mute hover:text-fg'}`}>
                <I width={20} height={20} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {!native && <Notice tone="warn">{NATIVE_ONLY}</Notice>}
          {error && <Notice tone="bad">{error}</Notice>}

          {tab === 'music' && (
            <div className="card p-6">
              <div className="label">Lecture en cours</div>
              <div className="mt-2 text-sm text-mute">
                Les commandes ci-dessous pilotent la session média Android active (lecteur ouvert sur l’autoradio). Le titre en cours n’est pas lu par l’application.
              </div>
              <div className="mt-6 flex items-center justify-center gap-6">
                <button className="btn h-14 w-14 rounded-full" disabled={!native} onClick={() => run(() => AppLauncher.mediaKey('previous'))} aria-label="Précédent"><Icon.prev /></button>
                <button className="btn btn-accent h-20 w-20 rounded-full" disabled={!native} onClick={() => run(() => AppLauncher.mediaKey('play_pause'))} aria-label="Lecture/Pause"><Icon.play width={28} height={28} /></button>
                <button className="btn h-14 w-14 rounded-full" disabled={!native} onClick={() => run(() => AppLauncher.mediaKey('next'))} aria-label="Suivant"><Icon.next /></button>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <button className="btn" disabled={!native} onClick={() => run(async () => { if (!(await AppLauncher.openCategory('music'))) throw new Error('Aucune application musicale par défaut trouvée.'); })}>Ouvrir le lecteur par défaut</button>
                {byCat('music').map((a) => <AppChip key={a.packageName} app={a} onClick={() => run(() => AppLauncher.launch(a.packageName))} />)}
              </div>
            </div>
          )}
          {tab === 'nav' && (
            <div className="card p-6">
              <div className="label">Navigation</div>
              <div className="mt-2 text-sm text-mute">Ouvre l’application de navigation installée sur l’autoradio. Aucune carte n’est intégrée (fonctionnement hors ligne garanti par l’application choisie).</div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button className="btn btn-accent" disabled={!native} onClick={() => run(async () => { if (!(await AppLauncher.openCategory('maps'))) throw new Error('Aucune application de navigation trouvée.'); })}><Icon.nav width={18} height={18} /> Navigation par défaut</button>
                {byCat('navigation').map((a) => <AppChip key={a.packageName} app={a} onClick={() => run(() => AppLauncher.launch(a.packageName))} />)}
              </div>
            </div>
          )}
          {tab === 'apps' && (
            <div className="card p-6">
              <div className="label mb-4">Applications installées</div>
              {native && apps === null && <div className="text-sm text-mute">Chargement…</div>}
              {native && apps?.length === 0 && <div className="text-sm text-mute">Aucune application lançable détectée.</div>}
              {!native && <div className="text-sm text-mute">La liste des applications Android s’affiche dans l’APK.</div>}
              <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                {(apps ?? []).map((a) => (
                  <button key={a.packageName} onClick={() => run(() => AppLauncher.launch(a.packageName))} className="flex flex-col items-center gap-2 rounded-xl p-3 transition hover:bg-ink/50">
                    {a.icon ? <img src={`data:image/png;base64,${a.icon}`} className="h-12 w-12" alt="" /> : <span className="grid h-12 w-12 place-items-center rounded-xl border border-line"><Icon.apps /></span>}
                    <span className="line-clamp-2 text-center text-xs">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === 'bt' && (
            <div className="card p-6">
              <div className="label">Bluetooth</div>
              <div className="mt-2 text-sm text-mute">Le jumelage du téléphone se gère dans les réglages Android de l’autoradio. L’adaptateur OBD-II se configure dans Settings › Source de données.</div>
              <button className="btn btn-accent mt-5" disabled={!native} onClick={() => run(() => AppLauncher.openSettings('bluetooth'))}><Icon.bt width={18} height={18} /> Ouvrir les réglages Bluetooth</button>
            </div>
          )}
          {tab === 'audio' && <AudioPanel native={native} run={run} />}
          <div className="text-[11px] text-mute">Cette application ne reproduit pas Apple CarPlay ni Android Auto et fonctionne indépendamment de ces systèmes.</div>
        </div>
      </div>
    </div>
  );
}

function AudioPanel({ native, run }: { native: boolean; run: (fn: () => Promise<unknown>) => void }) {
  const [vol, setVol] = useState<{ value: number; max: number } | null>(null);
  useEffect(() => {
    if (native) AppLauncher.getVolume().then(setVol).catch(() => setVol(null));
  }, [native]);
  return (
    <div className="card p-6">
      <div className="label">Volume média (Android)</div>
      {vol ? (
        <div className="mt-4 flex items-center gap-4">
          <Icon.volume />
          <input type="range" min={0} max={vol.max} value={vol.value} className="w-full accent-[rgb(var(--c-accent))]" onChange={(e) => { const v = Number(e.target.value); setVol({ ...vol, value: v }); run(() => AppLauncher.setVolume(v)); }} />
          <span className="w-10 text-right tabular-nums">{vol.value}</span>
        </div>
      ) : (
        <div className="mt-2 text-sm text-mute">{native ? 'Volume non disponible.' : 'Réglable dans l’APK.'}</div>
      )}
      <div className="mt-3 text-xs text-mute">L’égaliseur et la balance dépendent de l’autoradio : ouvrez ses réglages son.</div>
      <button className="btn mt-4" disabled={!native} onClick={() => run(() => AppLauncher.openSettings('sound'))}>Réglages son de l’autoradio</button>
    </div>
  );
}

function AppChip({ app, onClick }: { app: InstalledApp; onClick: () => void }) {
  return (
    <button className="btn" onClick={onClick}>
      {app.icon && <img src={`data:image/png;base64,${app.icon}`} className="h-5 w-5" alt="" />} {app.label}
    </button>
  );
}
