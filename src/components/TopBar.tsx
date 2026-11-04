import { fmtTime, useNow } from './Clock';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { useScene } from '../state/sceneStore';
import { useSettings } from '../settings/settingsStore';

export function TopBar() {
  const now = useNow(10000);
  const conn = useVehicleRepo((s) => s.connection);
  const fps = useScene((s) => s.fps);
  const model = useScene((s) => s.modelStatus);
  const diag = useSettings((s) => s.diagnostics);
  const tag =
    conn.status === 'demo' ? { t: 'DEMO', c: 'text-accent border-accent/50' } : conn.status === 'connected' ? { t: 'LIVE · OBD', c: 'text-ok border-ok/50' } : { t: 'OBD · ' + conn.status, c: 'text-mute border-line' };
  return (
    <div className="flex h-14 shrink-0 items-center justify-between px-8">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-[0.32em]">F21</span>
        <span className="text-sm font-light tracking-[0.32em] text-mute">DIGITAL</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        {diag && <span className="font-mono text-xs text-mute">{fps} fps · {model}</span>}
        <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-[0.14em] ${tag.c}`}>{tag.t}</span>
        <span className="tabular-nums text-mute">{fmtTime(now)}</span>
      </div>
    </div>
  );
}
