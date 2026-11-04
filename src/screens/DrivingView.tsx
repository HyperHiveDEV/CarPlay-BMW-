import { useVehicleRepo } from '../vehicle/VehicleDataRepository';
import { useMetricDisplay } from '../components/ui';
import type { MotionState } from '../vehicle/drivingSafety';
import { ConnectionManager } from '../vehicle/ConnectionManager';

/** Vue essentielle affichée en mouvement (ou vitesse inconnue) : aucune interaction complexe. */
export function DrivingView({ motion }: { motion: MotionState }) {
  const m = useVehicleRepo((s) => s.snapshot.metrics);
  const speed = useMetricDisplay(m.speed);
  const rpm = useMetricDisplay(m.rpm);
  const coolant = useMetricDisplay(m.coolantTemp);
  const demo = useVehicleRepo((s) => s.connection.status === 'demo');
  return (
    <div className="absolute inset-0 grid place-items-center screen-enter">
      <div className="text-center">
        <div className="label">{motion === 'moving' ? 'Mode conduite' : 'Vitesse inconnue — interface limitée par sécurité'}</div>
        <div className="mt-4 text-[clamp(96px,16vw,200px)] font-extralight leading-none tabular-nums">{speed.text}</div>
        <div className="text-lg text-mute">km/h · {speed.source === 'NA' ? 'N/A' : speed.source}</div>
        <div className="mt-10 flex justify-center gap-16 text-left">
          <div><div className="label">Régime</div><div className="text-4xl font-light tabular-nums">{rpm.text}<span className="ml-1 text-base text-mute">tr/min</span></div></div>
          <div><div className="label">Liquide refr.</div><div className="text-4xl font-light tabular-nums">{coolant.text}<span className="ml-1 text-base text-mute">°C</span></div></div>
        </div>
        <div className="mx-auto mt-10 max-w-md text-xs text-mute">
          Manipulation 3D et saisies désactivées tant que l’arrêt du véhicule n’est pas confirmé. Les informations officielles restent sur le combiné BMW.
        </div>
        {demo && (
          <button className="btn pointer-events-auto mt-6" onClick={() => ConnectionManager.setDemoScenario('idle')}>
            Arrêter la simulation de roulage (DEMO)
          </button>
        )}
      </div>
    </div>
  );
}
