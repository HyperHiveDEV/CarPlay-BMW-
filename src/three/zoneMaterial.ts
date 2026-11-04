import * as THREE from 'three';
import { B_PILLAR, DLO, DOOR, HEADLIGHT_SIDE, TAIL_LIGHT, WHEELS, X_FRONT, X_REAR } from './f21Blueprint';
import { HEAD_FRONT, HOOD_FRONT, KIDNEY, SIDE_INTAKE, ZONE, ZONE_LIMITS, halfWidth, yShoulder } from './f21Body';
import type { RenderTier } from './materials';

/**
 * Matériau de carrosserie « par zones » : la zone (peinture, vitrage, noir brillant, optiques,
 * grilles, feux, joints d'ouvrants…) est évaluée PAR PIXEL à partir de la position dans le repère
 * véhicule. Les contours sont donc nets quelle que soit la densité du maillage.
 *
 * La découpe des ouvrants est elle aussi faite par pixel (même règle que classifyPart dans
 * f21Body.ts) : un triangle à cheval sur une frontière appartient aux deux pièces et chaque
 * pièce élimine les pixels qui ne sont pas les siens → bords d'ouvrants nets, jours réguliers.
 *
 * mode 'outer' : peau extérieure ; mode 'inner' : doublure intérieure des ouvrants.
 */

const TABLE = 96;
const f = (v: number) => v.toFixed(4);
const L = ZONE_LIMITS;
const pad = (pts: [number, number][], n: number) => {
  const out = pts.map(([x, y]) => new THREE.Vector2(x, y));
  while (out.length < n) out.push(out[out.length - 1].clone());
  return out;
};

/** Demi-largeur d'un jour d'ouvrant (≈ 4,5 mm de jour visible). */
const GAP = 0.0022;

export function createZoneMaterial(
  tier: RenderTier,
  partId: number,
  pivot: THREE.Vector3,
  shared: { uHeadEm: { value: THREE.Color }; uTailEm: { value: THREE.Color } },
  mode: 'outer' | 'inner' = 'outer',
) {
  const physical = tier !== 'low';
  const inner = mode === 'inner';
  const m = physical && !inner
    ? new THREE.MeshPhysicalMaterial({ color: '#F3F4F1', roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.15 })
    : new THREE.MeshStandardMaterial({ color: inner ? '#1d1f23' : '#F1F2EF', roughness: inner ? 0.85 : 0.28, metalness: 0.04 });
  const shoulder: number[] = [];
  const width: number[] = [];
  for (let i = 0; i < TABLE; i++) {
    const x = X_REAR + ((X_FRONT - X_REAR) * i) / (TABLE - 1);
    shoulder.push(yShoulder(x));
    width.push(halfWidth(x));
  }
  const uniforms = {
    uPivot: { value: pivot.clone() },
    uPart: { value: partId },
    uDLO: { value: pad(DLO, 20) },
    uBP: { value: pad(B_PILLAR, 4) },
    uDoor: { value: pad(DOOR, 20) },
    uTail: { value: pad(TAIL_LIGHT, 10) },
    uHeadS: { value: pad(HEADLIGHT_SIDE, 6) },
    uHeadF: { value: pad(HEAD_FRONT, 12) },
    uIntake: { value: pad(SIDE_INTAKE, 6) },
    uShoulder: { value: shoulder },
    uWidth: { value: width },
    uXR: { value: X_REAR },
    uXF: { value: X_FRONT },
    uWheels: { value: new THREE.Vector4(WHEELS.front.x, WHEELS.front.archR, WHEELS.rear.x, WHEELS.rear.archR) },
    uWheelY: { value: WHEELS.radius },
    uHeadEm: shared.uHeadEm,
    uTailEm: shared.uTailEm,
  };

  const partRule = `
float hoodFrontY(float az){ return az < ${f(HOOD_FRONT.az0)} ? ${f(HOOD_FRONT.y0)} : ${f(HOOD_FRONT.y0)} + (az - ${f(HOOD_FRONT.az0)}) * ${f(HOOD_FRONT.slope)}; }
// distance signée (> 0 à l'intérieur) aux limites géométriques du capot et du hayon
float hoodSD(vec3 P, float w){ float az = abs(P.z); return min(min(P.x - ${f(L.cowl)}, w * ${f(L.hoodSide)} - az), P.y - hoodFrontY(az)); }
float tgSD(vec3 P){ return min(min(${f(L.roofRear)} - P.x, ${f(L.tailgateHalf)} - abs(P.z)), P.y - ${f(L.tailgateBottom)}); }
int partOf(vec3 P, vec3 Nn, float w){
  if (abs(Nn.z) > 0.45 && inDoor(P.xy) && P.y > ${f(L.doorBottom)}) return P.z < 0. ? 1 : 2;
  if (hoodSD(P, w) > 0.) return 3;
  if (tgSD(P) > 0.) return 4;
  return 0;
}`;

  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform vec3 uPivot;\nvarying vec3 vObjPos;\nvarying vec3 vObjN;${inner ? '\nattribute vec3 aOuter;\nattribute vec3 aOuterN;' : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        inner ? '#include <begin_vertex>\nvObjPos = aOuter + uPivot;\nvObjN = aOuterN;' : '#include <begin_vertex>\nvObjPos = position + uPivot;\nvObjN = normal;',
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vObjPos;
varying vec3 vObjN;
uniform vec2 uDLO[20]; uniform vec2 uBP[4]; uniform vec2 uDoor[20]; uniform vec2 uTail[10];
uniform vec2 uHeadS[6]; uniform vec2 uHeadF[12]; uniform vec2 uIntake[6];
uniform float uShoulder[${TABLE}]; uniform float uWidth[${TABLE}];
uniform float uXR; uniform float uXF; uniform vec4 uWheels; uniform float uWheelY;
uniform vec3 uHeadEm; uniform vec3 uTailEm; uniform int uPart;
#define POLY(NAME, ARR, N) bool NAME(vec2 p){ bool c=false; for(int i=0;i<N;i++){ int j = i==0 ? N-1 : i-1; vec2 a=ARR[i]; vec2 b=ARR[j]; if(((a.y>p.y)!=(b.y>p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-6)+a.x)) c=!c; } return c; }
#define PDIST(NAME, ARR, N) float NAME(vec2 p){ float d=1e3; for(int i=0;i<N;i++){ int j = i==0 ? N-1 : i-1; vec2 a=ARR[j]; vec2 b=ARR[i]; vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-8),0.,1.); d=min(d,length(p-a-t*ab)); } return d; }
POLY(inDLO, uDLO, 20) POLY(inBP, uBP, 4) POLY(inTail, uTail, 10) POLY(inHeadS, uHeadS, 6) POLY(inHeadF, uHeadF, 12) POLY(inIntake, uIntake, 6) POLY(inDoor, uDoor, 20)
PDIST(dDLO, uDLO, 20) PDIST(dDoor, uDoor, 20) PDIST(dTail, uTail, 10) PDIST(dHeadF, uHeadF, 12)
float tbl(float x, bool sh){ float f = clamp((x-uXR)/(uXF-uXR),0.,1.)*${TABLE - 1}.; int i = min(int(floor(f)), ${TABLE - 2}); float t = f-float(i);
  float a = sh ? uShoulder[i] : uWidth[i]; float b = sh ? uShoulder[i+1] : uWidth[i+1]; return mix(a,b,t); }
float rrd(vec2 p, vec2 c, vec2 h, float r){ vec2 d=abs(p-c)-(h-r); return length(max(d,0.)) + min(max(d.x,d.y),0.) - r; }
${partRule}
`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float zClear = 1.0;
{
  vec3 P = vObjPos; vec3 Nn = normalize(vObjN);
  float az = abs(P.z); vec2 sv = P.xy;
  float ys = tbl(P.x, true); float w = tbl(P.x, false);
  if (partOf(P, Nn, w) != uPart) discard;
${inner ? `  diffuseColor.rgb = vec3(0.035, 0.037, 0.042); roughnessFactor = 0.85; metalnessFactor = 0.;
}` : `
  bool sideF = abs(Nn.z) > 0.45; bool frontF = Nn.x > 0.25; bool rearF = Nn.x < -0.25;
  int zone = ${ZONE.paint};
  bool gh = P.y > ys + 0.012;
  if (gh && sideF && inDLO(sv)) { zone = (inBP(sv) || dDLO(sv) < 0.014) ? ${ZONE.gloss} : ${ZONE.glass}; }
  else if (gh && !sideF && P.x < ${f(L.cowl)} && P.x > ${f(L.roofFront)} && az < 0.67 - (P.x-${f(L.roofFront)})*0.08) {
    zone = (az > 0.61 - (P.x-${f(L.roofFront)})*0.08 || P.x < ${f(L.roofFront)} + 0.022 || P.x > ${f(L.cowl)} - 0.03) ? ${ZONE.gloss} : ${ZONE.glass};
  } else if (gh && !sideF && P.x < ${f(L.roofRear)} - 0.01 && P.x > ${f(L.hatchBottom)} && az < 0.6 && P.y > ys + 0.02) {
    zone = (az > 0.545 || P.x > ${f(L.roofRear)} - 0.045) ? ${ZONE.gloss} : ${ZONE.glass};
  }
  float headEdge = 1.;
  bool frontish = Nn.x > 0.05;
  if (P.x > 1.62 && frontish) {
    if (az > 0.29 && inHeadF(vec2(az, P.y))) { zone = ${ZONE.headLens}; headEdge = dHeadF(vec2(az, P.y)); }
    else if (rrd(vec2(az, P.y), vec2(${f(KIDNEY.cz)}, ${f(KIDNEY.cy)}), vec2(${f(KIDNEY.hz)}, ${f(KIDNEY.hy)}), ${f(KIDNEY.r)}) < 0.) zone = rrd(vec2(az, P.y), vec2(${f(KIDNEY.cz)}, ${f(KIDNEY.cy)}), vec2(${f(KIDNEY.hz)}, ${f(KIDNEY.hy)}), ${f(KIDNEY.r)}) > -0.01 ? ${ZONE.gloss} : ${ZONE.kidney};
    else if (frontF && az < 0.45 && P.y > 0.235 && P.y < 0.40) zone = ${ZONE.mesh};
    else if (inIntake(vec2(az, P.y))) zone = ${ZONE.mesh};
  }
  if (P.x > 1.55 && sideF && inHeadS(sv)) zone = ${ZONE.headLens};
  if (P.x > 1.72 && P.y < 0.207) zone = ${ZONE.gloss};
  float tailEdge = 1.;
  if (az > 0.4 && P.x < -1.75 && inTail(sv)) { zone = ${ZONE.tail}; tailEdge = dTail(sv); }
  if (P.x < -2.0 && rearF) {
    if (P.y < 0.33) zone = ${ZONE.gloss};
    else if (az > 0.62 && az < 0.86 && P.y < 0.53) zone = (az > 0.66 && az < 0.8 && P.y > 0.36 && P.y < 0.385) ? ${ZONE.reflector} : ${ZONE.gloss};
  }
  if (P.x < -2.15 && sideF && P.y < 0.53 && P.y > 0.3) zone = ${ZONE.gloss};

  // jours d'ouvrants : trait sombre net + léger ombrage de part et d'autre (profondeur du jour)
  float seamD = 1.;
  if (sideF && P.y < ys + 0.01) seamD = min(seamD, dDoor(sv));
  seamD = min(seamD, abs(hoodSD(P, w)));
  seamD = min(seamD, abs(tgSD(P)));
  if (seamD < ${f(GAP)} && (zone == ${ZONE.paint} || zone == ${ZONE.gloss})) zone = ${ZONE.seam};

  // passages de roue et soubassement
  float dF = length(sv - vec2(uWheels.x, uWheelY)); float dR = length(sv - vec2(uWheels.z, uWheelY));
  if ((dF < uWheels.y + 0.004 || dR < uWheels.w + 0.004) && !sideF) zone = ${ZONE.cavity};
  if (Nn.y < -0.55) zone = ${ZONE.trim};

  if (zone == ${ZONE.paint}) { diffuseColor.rgb *= mix(0.78, 1.0, smoothstep(${f(GAP)}, 0.014, seamD)); }
  else if (zone == ${ZONE.glass}) { diffuseColor.rgb = vec3(0.004, 0.005, 0.007); roughnessFactor = 0.04; metalnessFactor = 0.0; }
  else if (zone == ${ZONE.gloss}) { diffuseColor.rgb = vec3(0.006, 0.007, 0.008); roughnessFactor = 0.14; metalnessFactor = 0.1; }
  else if (zone == ${ZONE.kidney}) { diffuseColor.rgb = vec3(0.016, 0.017, 0.02); roughnessFactor = 0.45; metalnessFactor = 0.2; zClear = 0.3; }
  else if (zone == ${ZONE.trim}) { diffuseColor.rgb = vec3(0.02); roughnessFactor = 0.7; metalnessFactor = 0.; zClear = 0.; }
  else if (zone == ${ZONE.seam}) { diffuseColor.rgb = vec3(0.012); roughnessFactor = 0.9; metalnessFactor = 0.; zClear = 0.; }
  else if (zone == ${ZONE.cavity}) { diffuseColor.rgb = vec3(0.012); roughnessFactor = 0.95; metalnessFactor = 0.; zClear = 0.; }
  else if (zone == ${ZONE.mesh}) { diffuseColor.rgb = vec3(0.014, 0.015, 0.017); roughnessFactor = 0.75; metalnessFactor = 0.; zClear = 0.;
    // grille alvéolée M Sport
    vec2 g = vec2(P.z, P.y) * vec2(70., 80.); g.x += step(1., mod(g.y, 2.)) * 0.5;
    vec2 c = abs(fract(g) - 0.5); diffuseColor.rgb *= 0.35 + 0.9 * step(0.36, max(c.x, c.y)); }
  else if (zone == ${ZONE.headLens}) {
    // optique : fond chromé fumé, liseré noir, réflecteurs
    diffuseColor.rgb = vec3(0.32, 0.34, 0.37); roughnessFactor = 0.12; metalnessFactor = 0.95;
    if (headEdge > 0.006 && headEdge < 0.016) { diffuseColor.rgb = vec3(0.05, 0.055, 0.06); }
    if (headEdge < 0.006) { diffuseColor.rgb = vec3(0.01); metalnessFactor = 0.1; }
    totalEmissiveRadiance += uHeadEm * 0.04;
  }
  else if (zone == ${ZONE.tail}) {
    // feu LCI : verre rouge fumé et guide de lumière en L le long du contour
    diffuseColor.rgb = vec3(0.16, 0.006, 0.012); roughnessFactor = 0.06; metalnessFactor = 0.1;
    float band = 1. - smoothstep(0.008, 0.018, tailEdge);
    totalEmissiveRadiance += uTailEm * (0.25 + 1.6 * band);
    diffuseColor.rgb += vec3(0.25, 0.01, 0.02) * band;
  }
  else if (zone == ${ZONE.reflector}) { diffuseColor.rgb = vec3(0.45, 0.02, 0.03); roughnessFactor = 0.3; }
  if (!gl_FrontFacing) { diffuseColor.rgb = vec3(0.03); roughnessFactor = 0.9; metalnessFactor = 0.; zClear = 0.; }
}`}
`,
      )
      .replace(
        '#include <lights_physical_fragment>',
        '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat *= zClear;\n#endif',
      );
  };
  m.customProgramCacheKey = () => `f21zone-${physical}-${mode}`;
  m.side = inner ? THREE.FrontSide : partId === 0 ? THREE.FrontSide : THREE.DoubleSide;
  return m;
}
