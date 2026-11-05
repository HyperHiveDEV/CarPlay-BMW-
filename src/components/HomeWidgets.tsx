import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { HomeWidgetId } from '../settings/settingsStore';
import { useSettings } from '../settings/settingsStore';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { useMaintenance, visibleEntries } from '../maintenance/maintenanceStore';
import { computeAll } from '../maintenance/maintenanceLogic';
import { DEMO_MILEAGE_KM } from '../maintenance/demoHistory';
import { thresholdState } from '../vehicle/alertThresholds';
import { fmtDate, fmtKm, fmtTime, useNow } from './Clock';
import { Icon } from './Icons';
import { SourceBadge, useMetricDisplay } from './ui';

export const WIDGET_LABEL: Record<HomeWidgetId, string> = {
  clock: 'Heure et date',
  mileage: 'Kilométrage',
  maintenance: 'Prochain entretien',
  coolant: 'Température moteur',
  battery: 'Batterie',
  fuel: 'Carburant',
  connection: 'Connexion véhicule',
  alerts: 'Alertes',
};

function Shell({ title, icon, badge, children, tone }: { title: string; icon?: ReactNode; badge?: ReactNode; children: ReactNode; tone?: 'warn' | 'bad' }) {
  const ring = tone === 'bad' ? 'border-bad/60' : tone === 'warn' ? 'border-warn/50' : '';
  return (
    <div className={`card flex h-full min-h-0 flex-col justify-between overflow-hidden px-3.5 py-2.5 ${ring}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label flex min-w-0 items-center gap-1.5 truncate !text-[0.6rem]">{icon && <span className="text-mute">{icon}</span>}{title}</span>
        {badge}
      </div>
      <div className="mt-1 min-w-0">{children}</div>
    </div>
  );
}

function ClockWidget() {
  const now = useNow(1000);
  return (
    <Shell title="Heure">
      <div className="text-[2rem] font-extralight leading-none tabular-nums">{fmtTime(now)}</div>
      <div className="mt-1 truncate text-[0.7rem] capitalize text-mute">{fmtDate(now)}</div>
    </Shell>
  );
}

function MileageWidget() {
  const v = useSettings((s) => s.vehicle);
  const demo = useSettings((s) => s.dataSource === 'demo');
  const km = v.mileageKm ?? (demo ? DEMO_MILEAGE_KM : null);
  return (
    <Shell title="Kilométrage" badge={v.mileageKm == null && km != null ? <SourceBadge source="DEMO" /> : undefined}>
      <div className="text-[1.75rem] font-light leading-none tabular-nums">{km == null ? '—' : fmtKm(km)} <span className="text-sm text-mute">km</span></div>
      <div className="truncate text-[0.68rem] text-mute">{v.mileageUpdatedAt ? `saisi le ${new Date(v.mileageUpdatedAt).toLocaleDateString('fr-FR')}` : 'saisie manuelle (Réglages)'}</div>
    </Shell>
  );
}

function MaintenanceWidget() {
  const store = useMaintenance();
  const v = useSettings((s) => s.vehicle);
  const entries = visibleEntries(store);
  const isDemo = entries.length > 0 && entries[0].isDemo;
  const km = v.mileageKm ?? (isDemo ? DEMO_MILEAGE_KM : null);
  const next = useMemo(() => {
    const rank = { overdue: 0, soon: 1, ok: 2, unknown: 3 } as const;
    return computeAll(entries, km)
      .filter((s) => s.status !== 'unknown')
      .sort((a, b) => rank[a.status] - rank[b.status] || (a.remainingDays ?? 1e9) - (b.remainingDays ?? 1e9))[0];
  }, [entries, km]);
  const tone = next?.status === 'overdue' ? 'bad' : next?.status === 'soon' ? 'warn' : undefined;
  return (
    <Shell title="Prochain entretien" icon={<Icon.wrench width={14} height={14} />} badge={isDemo ? <SourceBadge source="DEMO" /> : undefined} tone={tone}>
      {next ? (
        <>
          <div className="truncate text-[1rem]">{next.category.label}</div>
          <div className={`text-xs ${tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-mute'}`}>
            {next.remainingDays != null ? (next.remainingDays < 0 ? `dépassé de ${-next.remainingDays} j` : `dans ${next.remainingDays} j`) : ''}
            {next.remainingKm != null ? ` · ${next.remainingKm < 0 ? `dépassé de ${fmtKm(-next.remainingKm)}` : `dans ${fmtKm(next.remainingKm)}`} km` : ''}
          </div>
        </>
      ) : (
        <div className="text-sm text-mute">Aucune échéance renseignée</div>
      )}
    </Shell>
  );
}

function CoolantWidget() {
  const m = useVehicleRepo((s) => s.snapshot.metrics.coolantTemp);
  const limit = useSettings((s) => s.alertThresholds.coolantTemp);
  const d = useMetricDisplay(m);
  const st = thresholdState(m.value, d.source, limit);
  return (
    <Shell title="Liquide refr." icon={<Icon.temp width={14} height={14} />} badge={<SourceBadge source={d.source} />} tone={st === 'over' ? 'bad' : st === 'near' ? 'warn' : undefined}>
      <div className="text-[1.75rem] font-light leading-none tabular-nums">{d.text} <span className="text-sm text-mute">°C</span></div>
      <div className="truncate text-[0.68rem] text-mute">seuil d’alerte {limit} °C</div>
    </Shell>
  );
}

function BatteryWidget() {
  const m = useVehicleRepo((s) => s.snapshot.metrics.battery);
  const d = useMetricDisplay(m, 1);
  const low = m.value != null && d.source !== 'NA' && m.value < 11.8;
  return (
    <Shell title="Batterie" icon={<Icon.battery width={14} height={14} />} badge={<SourceBadge source={d.source} />} tone={low ? 'warn' : undefined}>
      <div className="text-[1.75rem] font-light leading-none tabular-nums">{d.text} <span className="text-sm text-mute">V</span></div>
      <div className="truncate text-[0.68rem] text-mute">{m.value == null ? 'non mesurée' : m.value >= 13.2 ? 'charge (moteur tournant)' : m.value >= 12.3 ? 'repos — correcte' : 'faible'}</div>
    </Shell>
  );
}

function FuelWidget() {
  const m = useVehicleRepo((s) => s.snapshot.metrics.fuel);
  const d = useMetricDisplay(m);
  const pct = m.value != null && d.source !== 'NA' ? Math.max(0, Math.min(100, m.value)) : null;
  return (
    <Shell title="Carburant" icon={<Icon.fuel width={14} height={14} />} badge={<SourceBadge source={d.source} />}>
      <div className="text-[1.75rem] font-light leading-none tabular-nums">{d.text} <span className="text-sm text-mute">%</span></div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">{pct != null && <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${pct}%` }} />}</div>
    </Shell>
  );
}

const STATUS: Record<string, string> = { demo: 'Démonstration', disconnected: 'Déconnecté', scanning: 'Recherche…', connecting: 'Connexion…', initializing: 'Initialisation…', connected: 'OBD-II connecté', error: 'Erreur' };
function ConnectionWidget() {
  const c = useVehicleRepo((s) => s.connection);
  return (
    <Shell title="Connexion" icon={<Icon.bt width={14} height={14} />} badge={<SourceBadge source={c.status === 'connected' ? 'LIVE' : c.status === 'demo' ? 'DEMO' : 'NA'} />}>
      <div className="flex items-center gap-2 text-lg">
        <span className={`h-2 w-2 rounded-full ${c.status === 'connected' ? 'bg-ok' : c.status === 'demo' ? 'bg-accent' : c.status === 'error' ? 'bg-bad' : 'bg-mute'}`} />
        {STATUS[c.status]}
      </div>
      <div className="truncate text-[0.68rem] text-mute">{c.acquisitionHz ? `${c.acquisitionHz} Hz${c.latencyMs ? ` · ${c.latencyMs} ms/requête` : ''}` : c.deviceName ?? '—'}</div>
    </Shell>
  );
}

function AlertsWidget() {
  const alerts = useVehicleRepo((s) => s.snapshot.alerts);
  return (
    <Shell title="Alertes" icon={<Icon.alert width={14} height={14} />} tone={alerts.some((a) => a.level === 'critical') ? 'bad' : alerts.length ? 'warn' : undefined}>
      {alerts.length ? (
        <div className="space-y-0.5 text-sm">{alerts.slice(0, 2).map((a) => <div key={a.id} className={a.level === 'critical' ? 'text-bad' : 'text-warn'}>{a.message}</div>)}</div>
      ) : (
        <div className="text-sm text-mute">Aucune alerte dans les données disponibles</div>
      )}
    </Shell>
  );
}

export const WIDGETS: Record<HomeWidgetId, () => JSX.Element> = {
  clock: ClockWidget, mileage: MileageWidget, maintenance: MaintenanceWidget, coolant: CoolantWidget,
  battery: BatteryWidget, fuel: FuelWidget, connection: ConnectionWidget, alerts: AlertsWidget,
};
