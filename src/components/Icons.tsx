import type { SVGProps } from 'react';

/** Icônes monochromes (trait 1.6) dessinées pour l'application. */
const base = (p: SVGProps<SVGSVGElement>) => ({ width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, ...p });

export const Icon = {
  home: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /></svg>),
  car: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 15.5v-2.8c0-.6.3-1.1.8-1.4L7 9.5l2.2-3a2 2 0 0 1 1.6-.8h3.5a2 2 0 0 1 1.6.8l2.6 3.3 1.9.6c.9.3 1.6 1.1 1.6 2.1v3" /><circle cx="7" cy="16" r="2" /><circle cx="17" cy="16" r="2" /><path d="M9 16h6M7 9.5h11" /></svg>),
  engine: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 10h2V8h3V6h5v2h3l2 2h1v6h-1l-2 2H9l-3-3H4z" /><path d="M2 11v4M11 6V4M9 4h5" /></svg>),
  wrench: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3.6 17a1.4 1.4 0 0 0 2 2l5.7-5.7a4 4 0 0 0 5.1-5.4l-2.4 2.4-2-.5-.5-2z" /></svg>),
  media: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 18V6l11-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="17.5" cy="16" r="2.5" /></svg>),
  settings: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>),
  door: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 20V9l6-5h8v16z" /><path d="M5 12h14M15 15h2" /></svg>),
  hood: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 16h18M5 16l3-6h8l3 6" /><path d="M8 10 6 5" /></svg>),
  tailgate: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 18h16M6 18V9l4-4h8v13" /><path d="M10 5 6 3" /></svg>),
  light: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M9 6c-3 0-5 2.7-5 6s2 6 5 6h2V6z" /><path d="M14 8h6M14 12h7M14 16h6" /></svg>),
  blinker: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M10 6 4 12l6 6M14 6l6 6-6 6" /></svg>),
  hazard: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 4 3 19h18z" /><path d="M12 9.5 7.8 17h8.4z" /></svg>),
  brake: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="6" /><path d="M12 9v3.5M12 15h.01M4.5 6.5a10 10 0 0 0 0 11M19.5 6.5a10 10 0 0 1 0 11" /></svg>),
  camera: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M3 8h4l2-3h6l2 3h4v11H3z" /><circle cx="12" cy="13" r="3.5" /></svg>),
  reset: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>),
  wheel: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2" /><path d="M12 3.5V10M4.3 9.4l5.8 1.9M7 19l3.7-5.3M17 19l-3.7-5.3M19.7 9.4l-5.8 1.9" /></svg>),
  rotate: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>),
  battery: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="3" y="7" width="18" height="12" rx="2" /><path d="M7 7V5h3v2M14 7V5h3v2M7 13h3M15.5 11.5v3M14 13h3" /></svg>),
  fuel: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v15M3 20h12M6 8h6" /><path d="M14 9h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V8l-3-3" /></svg>),
  temp: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0z" /><path d="M12 9v7" /></svg>),
  bt: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="m7 7 10 10-5 4V3l5 4L7 17" /></svg>),
  nav: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 2 4.5 20.3l7.5-3.8 7.5 3.8z" /></svg>),
  apps: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></svg>),
  volume: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 9.5v5h4l5 4v-13l-5 4z" /><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11" /></svg>),
  play: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M7 5v14l12-7z" /></svg>),
  pause: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M8 5v14M16 5v14" /></svg>),
  next: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M5 5v14l10-7zM19 5v14" /></svg>),
  prev: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M19 5v14L9 12zM5 5v14" /></svg>),
  plus: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>),
  edit: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></svg>),
  trash: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>),
  close: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  alert: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M12 3 2 20h20z" /><path d="M12 10v4.5M12 17.5h.01" /></svg>),
  link: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>),
  bug: (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><rect x="7" y="8" width="10" height="12" rx="5" /><path d="M12 8V5M9 5l1.5 2M15 5l-1.5 2M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M4 7l3 2M20 7l-3 2" /></svg>),
};
export type IconName = keyof typeof Icon;
