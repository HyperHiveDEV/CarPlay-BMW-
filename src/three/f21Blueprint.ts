/**
 * GABARIT RELEVÉ SUR LA PHOTO DE PROFIL DU VÉHICULE DU PROPRIÉTAIRE (BMW 116i F21 LCI, M Sport).
 * Coordonnées en pixels de la photo recadrée (origine en haut à gauche, avant de la voiture à gauche),
 * converties en mètres avec l'empattement réel (2 690 mm) et la longueur réelle (4 324 mm).
 *
 * Repère 3D : X = avant, Y = haut, Z = droite (conducteur = −Z).
 */

const FRONT_AXLE_PX = 312;
const REAR_AXLE_PX = 1427;
const PX_PER_M_X = (REAR_AXLE_PX - FRONT_AXLE_PX) / 2.69;
const GROUND_PX = 686;
const PX_PER_M_Y = 435;
/** correction de perspective des porte-à-faux (longueur réelle 4 324 mm) */
const OVERHANG_K = 1.135;

export const FRONT_AXLE_X = 1.365;
export const REAR_AXLE_X = -1.325;

export function pxX(xc: number) {
  if (xc < FRONT_AXLE_PX) return FRONT_AXLE_X + ((FRONT_AXLE_PX - xc) / PX_PER_M_X) * OVERHANG_K;
  if (xc > REAR_AXLE_PX) return REAR_AXLE_X - ((xc - REAR_AXLE_PX) / PX_PER_M_X) * OVERHANG_K;
  return FRONT_AXLE_X - (xc - FRONT_AXLE_PX) / PX_PER_M_X;
}
export const pxY = (yc: number) => (GROUND_PX - yc) / PX_PER_M_Y;
export const P = (pts: [number, number][]) => pts.map(([x, y]) => [pxX(x), pxY(y)] as [number, number]);

/** Ligne supérieure : bouclier, capot, pare-brise, pavillon, lunette, hayon, bouclier arrière. */
export const TOP = P([
  [80, 468], [84, 440], [95, 414], [110, 388], [130, 366], [160, 347], [200, 328], [250, 309], [300, 296],
  [400, 280], [500, 265], [560, 256], [600, 240], [650, 205], [700, 170], [750, 136], [790, 116], [840, 102],
  [900, 92], [1000, 84], [1100, 79], [1200, 75], [1300, 72], [1400, 70], [1480, 72], [1530, 79],
  [1565, 100], [1600, 125], [1640, 155], [1670, 180], [1700, 205], [1722, 228], [1735, 252], [1740, 290],
  [1746, 322], [1765, 370], [1784, 415], [1792, 445],
]);

/** Ligne inférieure : lame avant, bas de caisse, diffuseur (hors passages de roue). */
export const BOTTOM = P([
  [80, 468], [83, 520], [89, 560], [100, 586], [130, 601], [170, 606], [600, 607], [1000, 606], [1300, 600],
  [1615, 586], [1700, 580], [1736, 560], [1768, 532], [1785, 500], [1792, 445],
]);

/** Ligne de ceinture (bas des vitres) prolongée vers l'avant (ailes) et l'arrière (feux). */
export const BELT = P([
  [80, 470], [100, 395], [200, 347], [300, 320], [400, 304], [500, 292], [575, 285], [700, 279], [900, 267],
  [1050, 255], [1200, 243], [1400, 228], [1500, 226], [1600, 240], [1700, 246], [1745, 258], [1792, 445],
]);

/** Ligne de caractère (arête vive au-dessus de la poignée). */
export const CHARACTER = P([
  [80, 470], [120, 395], [180, 372], [520, 336], [1000, 301], [1300, 285], [1600, 262], [1740, 300], [1792, 445],
]);

/** Nervure inférieure concave (bas de portière). */
export const SWAGE = P([
  [80, 500], [200, 470], [500, 452], [1000, 470], [1250, 480], [1650, 470], [1792, 470],
]);

/** Surface vitrée latérale (portière + custode) avec le « coup de crosse » arrondi. */
export const DLO = P([
  [576, 284], [640, 240], [700, 192], [760, 143], [830, 112], [900, 101], [1000, 96], [1100, 95], [1200, 96],
  [1300, 100], [1380, 107], [1428, 124], [1452, 153], [1452, 185], [1432, 210], [1400, 225], [1200, 242],
  [1050, 254], [900, 265], [700, 278],
]);

/** Montant B noir brillant (séparation vitre de porte / custode). */
export const B_PILLAR = P([[1090, 97], [1104, 97], [1068, 256], [1053, 256]]);

/** Contour de portière (vitre encadrée incluse). */
export const DOOR = P([
  [582, 290], [545, 312], [518, 340], [511, 380], [514, 450], [524, 520], [535, 566], [1030, 556], [1045, 480],
  [1060, 380], [1070, 300], [1078, 258], [1104, 97], [1000, 94], [900, 99], [830, 109], [760, 140], [700, 189],
  [640, 237],
]);

/** Feu arrière (vue de côté). */
export const TAIL_LIGHT = P([
  [1605, 246], [1700, 242], [1737, 258], [1739, 300], [1722, 330], [1690, 346], [1660, 341], [1622, 292], [1606, 266],
]);

/** Projecteur avant (vue de côté). */
export const HEADLIGHT_SIDE = P([[97, 383], [140, 380], [178, 394], [160, 418], [120, 438], [99, 440]]);

export const WHEELS = {
  radius: 0.322,
  front: { x: FRONT_AXLE_X, archR: 0.372 },
  rear: { x: REAR_AXLE_X, archR: 0.382 },
  halfTrackFront: 0.765,
  halfTrackRear: 0.775,
};

/** Charnières (repère 3D). */
export const HINGES = {
  door: pxX(516),
  hood: { x: pxX(588), y: pxY(250) },
  tailgate: { x: pxX(1528), y: pxY(76) },
};

export const X_FRONT = TOP[0][0];
export const X_REAR = TOP[TOP.length - 1][0];

/** Becquet de toit (extension noir brillant) et antenne requin, profils relevés. */
export const SPOILER = P([[1488, 71], [1560, 65], [1603, 68], [1597, 77], [1566, 99], [1532, 90], [1500, 80]]);
export const SHARK_FIN = P([[1352, 72], [1392, 47], [1428, 44], [1442, 71]]);
