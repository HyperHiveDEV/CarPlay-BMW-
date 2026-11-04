import { Icon } from './Icons';
import type { Screen } from '../App';

const ITEMS: { id: Screen; label: string; icon: keyof typeof Icon }[] = [
  { id: 'home', label: 'My BMW', icon: 'home' },
  { id: 'vehicle', label: 'Vehicle', icon: 'car' },
  { id: 'engine', label: 'Engine', icon: 'engine' },
  { id: 'maintenance', label: 'Maintenance', icon: 'wrench' },
  { id: 'media', label: 'Media', icon: 'media' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

/** Barre latérale gauche (zone de navigation « sidebar », ordre 0). */
export function Sidebar({ current, go, disabled = [] }: { current: Screen; go: (s: Screen) => void; disabled?: Screen[] }) {
  return (
    <nav data-nav-zone="sidebar" data-nav-order="0" aria-label="Navigation principale"
      className="flex h-full shrink-0 flex-col items-center gap-1 border-r border-line/50 bg-panel/70 py-3 backdrop-blur-md" style={{ width: '4.75rem' }}>
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-line/70 text-[0.7rem] font-semibold tracking-[0.12em] text-fg">F21</div>
      <div className="flex flex-1 flex-col justify-center gap-1.5">
        {ITEMS.map((it) => {
          const I = Icon[it.icon];
          const active = current === it.id;
          return (
            <button key={it.id} aria-current={active ? 'page' : undefined} aria-label={it.label} disabled={disabled.includes(it.id)} onClick={() => go(it.id)}
              className={`nav-item group relative flex w-[3.9rem] flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.62rem] font-medium tracking-wide transition duration-200 disabled:opacity-25 ${active ? 'bg-ink/80 text-fg' : 'text-mute hover:bg-ink/40 hover:text-fg'}`}>
              <span className={`absolute left-0 top-1/2 h-6 -translate-x-[0.45rem] -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${active ? 'w-[3px] opacity-100' : 'w-0 opacity-0'}`} />
              <I width={21} height={21} />
              <span className="leading-none">{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
