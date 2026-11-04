import { useMemo, useState } from 'react';
import { useMaintenance, visibleEntries } from '../maintenance/maintenanceStore';
import { computeAll, type CategoryStatus } from '../maintenance/maintenanceLogic';
import { CATEGORIES, categoryLabel, type MaintenanceEntry } from '../maintenance/types';
import { DEMO_MILEAGE_KM } from '../maintenance/demoHistory';
import { useSettings } from '../settings/settingsStore';
import { fmtKm } from '../components/Clock';
import { Icon } from '../components/Icons';
import { Notice, SectionTitle, Toggle } from '../components/ui';

const STATUS_STYLE = {
  ok: ['À jour', 'text-ok border-ok/40'],
  soon: ['Bientôt', 'text-warn border-warn/40'],
  overdue: ['Dépassé', 'text-bad border-bad/40'],
  unknown: ['Non renseigné', 'text-mute border-line'],
} as const;

export function MaintenanceScreen({ locked }: { locked: boolean }) {
  const store = useMaintenance();
  const vehicle = useSettings((s) => s.vehicle);
  const entries = visibleEntries(store);
  const isDemo = entries.length > 0 && entries[0].isDemo;
  const currentKm = vehicle.mileageKm ?? (isDemo ? DEMO_MILEAGE_KM : null);
  const statuses = useMemo(() => computeAll(entries, currentKm), [entries, currentKm]);
  const upcoming = statuses.filter((s) => s.status === 'soon' || s.status === 'overdue');
  const [editing, setEditing] = useState<MaintenanceEntry | 'new' | null>(null);
  const history = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="absolute inset-0 overflow-y-auto px-8 pb-4 screen-enter">
      <SectionTitle
        kicker="Maintenance"
        title="Carnet d’entretien"
        right={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="label">Kilométrage actuel</div>
              <div className="text-2xl font-light tabular-nums">
                {fmtKm(currentKm)} <span className="text-sm text-mute">km{vehicle.mileageKm == null && currentKm != null ? ' · DEMO' : ''}</span>
              </div>
            </div>
            <button className="btn btn-accent" disabled={locked} onClick={() => setEditing('new')}>
              <Icon.plus width={18} height={18} /> Ajouter une intervention
            </button>
          </div>
        }
      />
      {isDemo && (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
          <span><b className="font-semibold text-accent">DEMO</b> — historique fictif affiché tant qu’aucune intervention réelle n’est saisie.</span>
          <span className="flex items-center gap-2 text-xs text-mute">Afficher la démo <Toggle checked={store.showDemo} onChange={store.setShowDemo} /></span>
        </div>
      )}
      {upcoming.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {upcoming.map((u) => (
            <span key={u.category.id} className={`rounded-lg border px-3 py-1.5 text-sm ${u.status === 'overdue' ? 'border-bad/50 text-bad' : 'border-warn/50 text-warn'}`}>
              {u.category.label} · {describeDue(u)}
            </span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1.25fr_1fr] gap-5">
        <div className="grid grid-cols-2 gap-3 self-start xl:grid-cols-3">
          {statuses.map((s) => (
            <div key={s.category.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm">{s.category.label}</span>
                <span className={`rounded-md border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wider ${STATUS_STYLE[s.status][1]}`}>{STATUS_STYLE[s.status][0]}</span>
              </div>
              <div className="mt-3 text-xs text-mute">Dernière : {s.last ? `${new Date(s.last.date).toLocaleDateString('fr-FR')}${s.last.mileageKm != null ? ` · ${fmtKm(s.last.mileageKm)} km` : ''}` : 'aucune saisie'}</div>
              <div className="mt-1 text-xs text-mute">Prochaine : {describeDue(s)}{s.fromInterval ? ' (intervalle indicatif)' : ''}</div>
            </div>
          ))}
        </div>
        <div className="card self-start p-2">
          <div className="label px-3 pb-1 pt-3">Historique des interventions</div>
          {history.length === 0 && <div className="px-3 py-6 text-sm text-mute">Aucune intervention enregistrée. Ajoutez la première pour suivre les échéances.</div>}
          {history.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-ink/40">
              <div className="w-20 shrink-0 text-xs tabular-nums text-mute">{new Date(e.date).toLocaleDateString('fr-FR')}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{e.title || categoryLabel(e.category)}</div>
                <div className="truncate text-xs text-mute">
                  {categoryLabel(e.category)}{e.mileageKm != null ? ` · ${fmtKm(e.mileageKm)} km` : ''}{e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
              {!e.isDemo && (
                <div className="flex gap-1">
                  <button className="btn px-2 py-2" disabled={locked} aria-label="Modifier" onClick={() => setEditing(e)}><Icon.edit width={16} height={16} /></button>
                  <button className="btn px-2 py-2" disabled={locked} aria-label="Supprimer" onClick={() => confirm('Supprimer cette intervention ?') && store.remove(e.id)}><Icon.trash width={16} height={16} /></button>
                </div>
              )}
            </div>
          ))}
          <div className="px-3 pb-3 pt-2">
            <Notice>Rappels propres à l’application, indépendants du système BMW CBS (Condition Based Service) du véhicule. Données stockées localement, disponibles hors ligne.</Notice>
          </div>
        </div>
      </div>
      {editing && <EntryForm initial={editing === 'new' ? null : editing} currentKm={vehicle.mileageKm} onClose={() => setEditing(null)} />}
    </div>
  );
}

function describeDue(s: CategoryStatus) {
  const parts: string[] = [];
  if (s.dueDate) parts.push(new Date(s.dueDate).toLocaleDateString('fr-FR'));
  if (s.dueKm != null) parts.push(`${fmtKm(s.dueKm)} km`);
  if (!parts.length) return 'non définie';
  if (s.remainingKm != null) parts.push(s.remainingKm < 0 ? `dépassée de ${fmtKm(-s.remainingKm)} km` : `dans ${fmtKm(s.remainingKm)} km`);
  else if (s.remainingDays != null) parts.push(s.remainingDays < 0 ? `dépassée de ${-s.remainingDays} j` : `dans ${s.remainingDays} j`);
  return parts.join(' · ');
}

function EntryForm({ initial, currentKm, onClose }: { initial: MaintenanceEntry | null; currentKm: number | null; onClose: () => void }) {
  const { add, update } = useMaintenance();
  const [f, setF] = useState({
    category: initial?.category ?? 'oil',
    title: initial?.title ?? '',
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    mileageKm: initial?.mileageKm?.toString() ?? currentKm?.toString() ?? '',
    note: initial?.note ?? '',
    nextDueDate: initial?.nextDueDate ?? '',
    nextDueKm: initial?.nextDueKm?.toString() ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const submit = () => {
    if (!f.date) return setErr('La date est obligatoire.');
    const km = f.mileageKm.trim() === '' ? null : Number(f.mileageKm);
    const nkm = f.nextDueKm.trim() === '' ? null : Number(f.nextDueKm);
    if ((km != null && (!Number.isFinite(km) || km < 0)) || (nkm != null && (!Number.isFinite(nkm) || nkm < 0))) return setErr('Kilométrage invalide.');
    if (km != null && nkm != null && nkm <= km) return setErr('L’échéance kilométrique doit être supérieure au kilométrage de l’intervention.');
    const data = { category: f.category as MaintenanceEntry['category'], title: f.title.trim(), date: f.date, mileageKm: km, note: f.note.trim(), nextDueDate: f.nextDueDate || null, nextDueKm: nkm };
    if (initial) update(initial.id, data);
    else add(data);
    onClose();
  };
  return (
    <div data-nav-modal className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-[min(640px,92vw)] p-6 screen-enter" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-light">{initial ? 'Modifier l’intervention' : 'Nouvelle intervention'}</h2>
          <button className="btn px-2 py-2" onClick={onClose} aria-label="Fermer"><Icon.close width={18} height={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Type">
            <select className="input" value={f.category} onChange={(e) => set('category', e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Intitulé (facultatif)"><input className="input" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="ex. Huile 0W-30 LL-04" /></Field>
          <Field label="Date *"><input type="date" className="input" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          <Field label="Kilométrage"><input inputMode="numeric" className="input" value={f.mileageKm} onChange={(e) => set('mileageKm', e.target.value.replace(/[^\d]/g, ''))} placeholder="km" /></Field>
          <Field label="Prochaine échéance — date"><input type="date" className="input" value={f.nextDueDate} onChange={(e) => set('nextDueDate', e.target.value)} /></Field>
          <Field label="Prochaine échéance — km"><input inputMode="numeric" className="input" value={f.nextDueKm} onChange={(e) => set('nextDueKm', e.target.value.replace(/[^\d]/g, ''))} placeholder="km" /></Field>
          <div className="col-span-2"><Field label="Note"><textarea className="input min-h-[72px]" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="Garage, pièces, références…" /></Field></div>
        </div>
        {err && <div className="mt-3 text-sm text-bad">{err}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-accent" onClick={submit}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
