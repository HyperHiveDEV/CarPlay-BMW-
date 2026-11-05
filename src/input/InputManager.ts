import { DEFAULT_KEYMAP, NAV_ACTIONS, type InputSource, type NavAction } from './actions';

export type InputHandler = (action: NavAction, source: InputSource) => boolean | void;

/**
 * Gestionnaire centralisé des commandes. Les adaptateurs (clavier, Android, future passerelle iDrive…)
 * traduisent les signaux reçus en actions logiques ; les gestionnaires abonnés (le dernier inscrit
 * en premier) les consomment. Aucune source n'est privilégiée : l'interface ne dépend pas du matériel.
 */
export class InputManager {
  private handlers: InputHandler[] = [];
  private keymap: Record<string, NavAction> = { ...DEFAULT_KEYMAP };
  lastSource: InputSource | null = null;

  /** Abonnement ; renvoie la fonction de désabonnement. Un gestionnaire qui renvoie true consomme l'action. */
  subscribe(h: InputHandler) {
    this.handlers.push(h);
    return () => {
      this.handlers = this.handlers.filter((x) => x !== h);
    };
  }

  dispatch(action: NavAction, source: InputSource): boolean {
    if (!NAV_ACTIONS.includes(action)) return false;
    this.lastSource = source;
    for (let i = this.handlers.length - 1; i >= 0; i--) if (this.handlers[i](action, source) === true) return true;
    return false;
  }

  setKeymap(map: Record<string, NavAction>) {
    this.keymap = { ...DEFAULT_KEYMAP, ...map };
  }
  getKeymap() {
    return { ...this.keymap };
  }

  /** Clé normalisée d'un événement clavier (« Shift+Tab », « ArrowUp »…). */
  static keyOf(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>) {
    if (e.ctrlKey || e.altKey || e.metaKey) return null;
    return e.key === 'Tab' && e.shiftKey ? 'Shift+Tab' : e.key;
  }

  actionForKey(e: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>): NavAction | null {
    const k = InputManager.keyOf(e);
    return k ? this.keymap[k] ?? null : null;
  }

  /** Adaptateur clavier / télécommande USB / croix directionnelle Android. */
  attachKeyboard(target: Window) {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      // dans un champ de saisie, seules Échap et (Maj+)Tab restent des commandes de navigation
      if (typing && !['Escape', 'Tab'].includes(e.key)) return;
      const a = this.actionForKey(e);
      if (!a) return;
      if (this.dispatch(a, 'keyboard')) e.preventDefault();
    };
    target.addEventListener('keydown', onKey);
    return () => target.removeEventListener('keydown', onKey);
  }

  /**
   * Adaptateur d'événements natifs : `window.dispatchEvent(new CustomEvent('f21-input', { detail: { action, source } }))`.
   * Utilisé par l'activité Android (bouton retour) et par une future passerelle iDrive.
   */
  attachCustomEvents(target: Window) {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ action: NavAction; source?: InputSource }>).detail;
      if (d?.action) this.dispatch(d.action, d.source ?? 'android');
    };
    target.addEventListener('f21-input', on);
    return () => target.removeEventListener('f21-input', on);
  }
}

export const inputManager = new InputManager();
