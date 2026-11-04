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

export function NavBar({ current, go, disabled = [] }: { current: Screen; go: (s: Screen) => void; disabled?: Screen[] }) {
  return (
    <nav className="mx-auto mb-4 flex shrink-0 items-center gap-1 rounded-2xl border border-line/70 bg-panel/80 p-1.5 backdrop-blur-md">
      {ITEMS.map((it) => {
        const I = Icon[it.icon];
        const active = current === it.id;
        return (
          <button
            key={it.id}
            disabled={disabled.includes(it.id)}
            onClick={() => go(it.id)}
            className={`relative flex min-w-[112px] flex-col items-center gap-1 rounded-xl px-4 py-2 text-[12px] font-medium tracking-wide transition disabled:opacity-30 ${active ? 'bg-ink/80 text-fg' : 'text-mute hover:text-fg'}`}
          >
            <I width={22} height={22} />
            {it.label}
            <span className={`absolute bottom-0.5 h-[2px] rounded-full bg-accent transition-all duration-300 ${active ? 'w-8 opacity-100' : 'w-0 opacity-0'}`} />
          </button>
        );
      })}
    </nav>
  );
}
