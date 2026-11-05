/**
 * Actions logiques de navigation, indépendantes de la source physique.
 * Correspondance cible iDrive : rotation = next/prev, pression = select, inclinaisons = left/right/up/down,
 * BACK = back, MENU = home, OPTION = option. Zoom : commandes dédiées.
 */
export type NavAction = 'next' | 'prev' | 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'home' | 'option' | 'zoomIn' | 'zoomOut';

export type InputSource = 'keyboard' | 'pointer' | 'touch' | 'android' | 'remote' | 'idrive' | 'test';

export const NAV_ACTIONS: NavAction[] = ['next', 'prev', 'up', 'down', 'left', 'right', 'select', 'back', 'home', 'option', 'zoomIn', 'zoomOut'];

/** Libellés pour l'aide et les réglages. */
export const ACTION_LABEL: Record<NavAction, string> = {
  next: 'Rotation (suivant)', prev: 'Rotation (précédent)', up: 'Haut', down: 'Bas', left: 'Zone précédente', right: 'Zone suivante',
  select: 'Valider', back: 'Retour (BACK)', home: 'Accueil (MENU)', option: 'Options (OPTION)', zoomIn: 'Zoom avant', zoomOut: 'Zoom arrière',
};

/** Clavier par défaut (claviers, télécommandes USB et croix directionnelle Android envoient ces touches). */
export const DEFAULT_KEYMAP: Record<string, NavAction> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'select', NumpadEnter: 'select', ' ': 'select',
  Escape: 'back', Backspace: 'back', BrowserBack: 'back', GoBack: 'back',
  Home: 'home', m: 'home', M: 'home', ContextMenu: 'option', o: 'option', O: 'option',
  ']': 'next', '[': 'prev', Tab: 'next', 'Shift+Tab': 'prev',
  '+': 'zoomIn', '=': 'zoomIn', PageUp: 'zoomIn', '-': 'zoomOut', PageDown: 'zoomOut',
};
