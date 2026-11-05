/**
 * Navigation au focus, sans écran tactile.
 *
 * L'interface est découpée en zones (`data-nav-zone="sidebar|main|aside"`, ordonnées par
 * `data-nav-order`). Une fenêtre modale (`data-nav-modal`) confine le focus.
 *  - next / prev (rotation de molette) : élément suivant / précédent de la zone (en boucle)
 *  - up / down : élément le plus proche dans la direction (géométrie), à défaut prev / next
 *  - left / right : zone précédente / suivante
 *  - select : active l'élément (clic) ; back : ferme la fenêtre ouverte
 */

const FOCUSABLE = 'button:not([disabled]), [role="switch"]:not([aria-disabled="true"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [data-focusable]';

const visible = (el: HTMLElement) => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"], [inert]');
};

export function focusablesIn(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => visible(el) && !el.closest('[data-nav-skip]'));
}

/** Racine active : la dernière fenêtre modale ouverte, sinon le document. */
export function activeRoot(doc: Document = document): HTMLElement | Document {
  const modals = [...doc.querySelectorAll<HTMLElement>('[data-nav-modal]')].filter(visible);
  return modals[modals.length - 1] ?? doc;
}

export function zones(root: HTMLElement | Document): HTMLElement[] {
  if (root !== document && (root as HTMLElement).hasAttribute?.('data-nav-modal')) return [root as HTMLElement];
  return [...root.querySelectorAll<HTMLElement>('[data-nav-zone]')]
    .filter((z) => visible(z) && focusablesIn(z).length > 0)
    .sort((a, b) => Number(a.dataset.navOrder ?? 0) - Number(b.dataset.navOrder ?? 0));
}

const center = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
};

/** Élément le plus proche dans une direction verticale (pondère l'écart horizontal). */
export function nearestVertical(from: HTMLElement, list: HTMLElement[], dir: 1 | -1): HTMLElement | null {
  const a = center(from);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === from) continue;
    const b = center(el);
    const dy = (b.y - a.y) * dir;
    if (dy <= 4) continue;
    const score = dy + Math.abs(b.x - a.x) * 2;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

export function focusEl(el: HTMLElement | null | undefined) {
  if (!el) return false;
  el.focus({ preventScroll: false });
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  document.documentElement.dataset.navFocus = 'on';
  return true;
}

/** Dernier élément focalisé hors fenêtre modale : sert à reprendre après fermeture d'un menu. */
let lastFocus: HTMLElement | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement | null;
    if (el && el !== document.body && !el.closest('[data-nav-modal]')) lastFocus = el;
  });
}

/** Applique une action de navigation ; renvoie true si elle a été traitée. */
export function navigate(action: 'next' | 'prev' | 'up' | 'down' | 'left' | 'right' | 'select', doc: Document = document): boolean {
  const root = activeRoot(doc);
  const zs = zones(root);
  if (!zs.length) return false;
  let current = doc.activeElement as HTMLElement | null;
  // focus perdu (menu fermé, vue 3D quittée) : on repart du dernier élément connu
  if ((!current || current === doc.body) && lastFocus?.isConnected && visible(lastFocus) && zs.some((z) => z.contains(lastFocus))) {
    current = lastFocus;
    if (action === 'select') return focusEl(current);
  }
  const zoneOf = (el: HTMLElement | null) => (el ? zs.find((z) => z.contains(el)) ?? null : null);
  let zone = zoneOf(current);
  if (!zone || !current || current === doc.body) {
    // premier appui : élément actif de la première zone utile
    const z = zs.find((x) => x.dataset.navZone === 'sidebar') ?? zs[0];
    return focusEl(z.querySelector<HTMLElement>('[aria-current="page"]') ?? focusablesIn(z)[0]);
  }
  const items = focusablesIn(zone);
  const i = items.indexOf(current);
  switch (action) {
    case 'select':
      current.click();
      return true;
    case 'next':
    case 'prev': {
      const d = action === 'next' ? 1 : -1;
      return focusEl(items[(i + d + items.length) % items.length]);
    }
    case 'up':
    case 'down': {
      const d = action === 'down' ? 1 : -1;
      const n = nearestVertical(current, items, d);
      return focusEl(n ?? items[(i + d + items.length) % items.length]);
    }
    case 'left':
    case 'right': {
      if (zs.length === 1) return focusEl(items[(i + (action === 'right' ? 1 : -1) + items.length) % items.length]);
      const zi = zs.indexOf(zone);
      zone = zs[(zi + (action === 'right' ? 1 : -1) + zs.length) % zs.length];
      const target = focusablesIn(zone);
      // l'élément le plus proche en hauteur dans la nouvelle zone
      const y = center(current).y;
      const pick = zone.querySelector<HTMLElement>('[aria-current="page"]') ?? target.reduce((b, el) => (Math.abs(center(el).y - y) < Math.abs(center(b).y - y) ? el : b), target[0]);
      return focusEl(pick);
    }
  }
  return false;
}

/** Ferme la fenêtre modale active (bouton marqué data-nav-close ou « Fermer »). */
export function closeActiveModal(doc: Document = document): boolean {
  const root = activeRoot(doc);
  if (root === doc) return false;
  const btn = (root as HTMLElement).querySelector<HTMLElement>('[data-nav-close], [aria-label="Fermer"]');
  if (btn) { btn.click(); return true; }
  return false;
}
