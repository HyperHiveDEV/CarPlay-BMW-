/** Provenance d'une donnée : LIVE = lue sur le véhicule, DEMO = simulée, NA = indisponible. */
export type DataSource = 'LIVE' | 'DEMO' | 'NA';

export interface Metric {
  value: number | null;
  source: DataSource;
  unit: string;
  /** horodatage ms de la dernière valeur valide */
  ts: number;
}

export type MetricKey =
  | 'rpm'
  | 'speed'
  | 'coolantTemp'
  | 'oilTemp'
  | 'intakeAirTemp'
  | 'map'
  | 'baro'
  | 'boost'
  | 'throttle'
  | 'load'
  | 'battery'
  | 'fuel';

export type OpeningKey = 'driverDoor' | 'passengerDoor' | 'hood' | 'tailgate';
export type OpeningState = 'open' | 'closed' | 'unknown';

export interface VehicleAlert {
  id: string;
  level: 'info' | 'warning' | 'critical';
  message: string;
  source: DataSource;
}

export interface VehicleSnapshot {
  metrics: Record<MetricKey, Metric>;
  /** État réel des ouvrants : 'unknown' tant qu'aucune source fiable ne le fournit. */
  openings: Record<OpeningKey, { state: OpeningState; source: DataSource }>;
  alerts: VehicleAlert[];
  updatedAt: number;
}

export type ConnectionStatus =
  | 'demo'
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'initializing'
  | 'connected'
  | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  deviceName?: string;
  deviceAddress?: string;
  message?: string;
  /** PID Mode 01 réellement supportés par le calculateur (hex, ex. "0C") */
  supportedPids: string[];
  protocol?: string;
  lastFrameAt?: number;
  errorCount: number;
}

export interface VehicleProvider {
  readonly kind: 'simulated' | 'obd';
  start(onData: (patch: Partial<Record<MetricKey, Metric>>) => void): Promise<void>;
  stop(): Promise<void>;
  /** Mise en pause sans fermer la connexion (application en arrière-plan). */
  pause(): void;
  resume(): void;
}

export const METRIC_UNITS: Record<MetricKey, string> = {
  rpm: 'tr/min',
  speed: 'km/h',
  coolantTemp: '°C',
  oilTemp: '°C',
  intakeAirTemp: '°C',
  map: 'kPa',
  baro: 'kPa',
  boost: 'bar',
  throttle: '%',
  load: '%',
  battery: 'V',
  fuel: '%',
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  rpm: 'Régime',
  speed: 'Vitesse',
  coolantTemp: 'Liquide de refroidissement',
  oilTemp: 'Huile moteur',
  intakeAirTemp: "Air d'admission",
  map: "Pression d'admission",
  baro: 'Pression atmosphérique',
  boost: 'Suralimentation',
  throttle: 'Accélérateur',
  load: 'Charge moteur',
  battery: 'Tension batterie',
  fuel: 'Carburant',
};

export function emptyMetric(key: MetricKey): Metric {
  return { value: null, source: 'NA', unit: METRIC_UNITS[key], ts: 0 };
}

export function emptySnapshot(): VehicleSnapshot {
  const metrics = Object.fromEntries(
    (Object.keys(METRIC_UNITS) as MetricKey[]).map((k) => [k, emptyMetric(k)]),
  ) as Record<MetricKey, Metric>;
  const unknown = { state: 'unknown' as OpeningState, source: 'NA' as DataSource };
  return {
    metrics,
    openings: { driverDoor: unknown, passengerDoor: unknown, hood: unknown, tailgate: unknown },
    alerts: [],
    updatedAt: 0,
  };
}
