import { RpmGauge } from '../components/RpmGauge';
import { LineChart } from '../components/LineChart';
import { MetricTile, SectionTitle, SourceBadge } from '../components/ui';
import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { useSettings } from '../settings/settingsStore';
import { Icon } from '../components/Icons';

export function EngineScreen() {
  const m = useVehicleRepo((s) => s.snapshot.metrics);
  const h = useVehicleRepo((s) => s.history);
  const conn = useVehicleRepo((s) => s.connection);
  const v = useSettings((s) => s.vehicle);
  const src = conn.status === 'demo' ? 'DEMO' : conn.status === 'connected' ? 'LIVE' : 'NA';
  return (
    <div className="absolute inset-0 overflow-y-auto px-8 pb-4 screen-enter">
      <SectionTitle
        kicker="Engine · Performance"
        title={`BMW ${v.engine} — ${(v.displacementCc / 1000).toFixed(1)} L Turbo`}
        right={
          <div className="flex items-center gap-2 text-xs text-mute">
            Source des données <SourceBadge source={src} />
          </div>
        }
      />
      <div className="grid grid-cols-[auto_1fr] gap-5">
        <div className="flex flex-col gap-4">
          <div className="card grid place-items-center p-4">
            <RpmGauge size={Math.min(360, Math.max(260, window.innerHeight * 0.48))} />
          </div>
          <div className="card p-4">
            <div className="flex items-center justify-between">
              <span className="label">Puissance déclarée</span>
              <span className="rounded-md border border-line px-1.5 text-[10px] tracking-widest text-mute">FIXE</span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-4xl font-light">{v.declaredHp}</span>
              <span className="text-mute">ch · {v.stage}</span>
            </div>
            <div className="mt-1 text-xs text-mute">
              Valeur déclarative de la préparation (origine {v.stockHp} ch). Non mesurée — aucune estimation de puissance en temps réel.
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-mute">
              {[`${v.cylinders} cylindres en ligne`, 'Essence', 'Turbo', `${v.displacementCc} cm³`].map((t) => (
                <span key={t} className="rounded-lg border border-line px-2 py-1">{t}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-4 gap-3">
            <MetricTile label="Liquide refr." metric={m.coolantTemp} icon={<Icon.temp width={15} height={15} />} />
            <MetricTile label="Huile" metric={m.oilTemp} icon={<Icon.temp width={15} height={15} />} />
            <MetricTile label="Suralimentation" metric={m.boost} digits={2} />
            <MetricTile label="Pression admission" metric={m.map} />
            <MetricTile label="Accélérateur" metric={m.throttle} />
            <MetricTile label="Charge moteur" metric={m.load} />
            <MetricTile label="Batterie" metric={m.battery} digits={1} icon={<Icon.battery width={15} height={15} />} />
            <MetricTile label="Air admission" metric={m.intakeAirTemp} />
          </div>
          <div className="card grid grid-cols-3 gap-6 p-5">
            <LineChart label="Régime · 60 s" data={h.rpm} min={0} max={7000} unit="tr/min" height={120} />
            <LineChart label="Suralimentation · 60 s" data={h.boost} min={-0.8} max={1.6} unit="bar" height={120} color="#168BFF" />
            <LineChart label="Liquide refr. · 60 s" data={h.coolantTemp} min={0} max={120} unit="°C" height={120} color="#FBBF24" />
          </div>
          <div className="text-[11px] leading-relaxed text-mute">
            LIVE = lu via OBD-II standard · DEMO = simulé · N/A = non fourni par le calculateur ou périmé (&gt; 5 s). Suralimentation dérivée de la pression
            d’admission (PID 0B) moins la pression atmosphérique (PID 33) ; le PID 0B plafonne à 255 kPa. La température d’huile (PID 5C) n’est souvent pas
            exposée par la DME BMW en OBD générique.
          </div>
        </div>
      </div>
    </div>
  );
}
