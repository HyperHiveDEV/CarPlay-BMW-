import * as THREE from 'three';
import { B_PILLAR, DLO, DOOR, HEADLIGHT_SIDE, TAIL_LIGHT, WHEELS, X_FRONT, X_REAR } from './f21Blueprint';
import { HEAD_FRONT, SIDE_INTAKE, ZONE, ZONE_LIMITS, halfWidth, yShoulder } from './f21Body';
import type { RenderTier } from './materials';

/**
 * Matériau de carrosserie « par zones » : la zone (peinture, vitrage, noir brillant, optiques,
 * grilles, feux…) est évaluée PAR PIXEL à partir de la position dans le repère véhicule.
 * Les contours (vitres, feux, haricots, joints de portière) sont donc nets quelle que soit
 * la densité du maillage — indispensable pour rester léger sur un autoradio.
 */

const TABLE = 96;
const f = (v: number) => v.toFixed(4);
const ZONE_X = { roofFront: f(ZONE_LIMITS.roofFront), cowl: f(ZONE_LIMITS.cowl), roofRear: f(ZONE_LIMITS.roofRear), hatchBottom: f(ZONE_LIMITS.hatchBottom) };
const pad = (pts: [number, number][], n: number) => {
  const out = pts.map(([x, y]) => new THREE.Vector2(x, y));
  while (out.length < n) out.push(out[out.length - 1].clone());
  return out;
};

export function createZoneMaterial(tier: RenderTier, partId: number, pivot: THREE.Vector3, shared: { uHeadEm: { value: THREE.Color }; uTailEm: { value: THREE.Color } }) {
  const physical = tier !== 'low';
  const m = physical
    ? new THREE.MeshPhysicalMaterial({ color: '#F4F5F2', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.1 })
    : new THREE.MeshStandardMaterial({ color: '#F1F2EF', roughness: 0.3, metalness: 0.05 });
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
    uHeadF: { value: pad(HEAD_FRONT, 10) },
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

  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uPivot;\nvarying vec3 vObjPos;\nvarying vec3 vObjN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position + uPivot;\nvObjN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vObjPos;
varying vec3 vObjN;
uniform vec2 uDLO[20]; uniform vec2 uBP[4]; uniform vec2 uDoor[20]; uniform vec2 uTail[10];
uniform vec2 uHeadS[6]; uniform vec2 uHeadF[10]; uniform vec2 uIntake[6];
uniform float uShoulder[${TABLE}]; uniform float uWidth[${TABLE}];
uniform float uXR; uniform float uXF; uniform vec4 uWheels; uniform float uWheelY;
uniform vec3 uHeadEm; uniform vec3 uTailEm; uniform int uPart;
#define POLY(NAME, ARR, N) bool NAME(vec2 p){ bool c=false; for(int i=0;i<N;i++){ int j = i==0 ? N-1 : i-1; vec2 a=ARR[i]; vec2 b=ARR[j]; if(((a.y>p.y)!=(b.y>p.y)) && (p.x < (b.x-a.x)*(p.y-a.y)/(b.y-a.y+1e-6)+a.x)) c=!c; } return c; }
#define PDIST(NAME, ARR, N) float NAME(vec2 p){ float d=1e3; for(int i=0;i<N;i++){ int j = i==0 ? N-1 : i-1; vec2 a=ARR[j]; vec2 b=ARR[i]; vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),1e-8),0.,1.); d=min(d,length(p-a-t*ab)); } return d; }
POLY(inDLO, uDLO, 20) POLY(inBP, uBP, 4) POLY(inTail, uTail, 10) POLY(inHeadS, uHeadS, 6) POLY(inHeadF, uHeadF, 10) POLY(inIntake, uIntake, 6)
PDIST(dDLO, uDLO, 20) PDIST(dDoor, uDoor, 20) POLY(inDoor, uDoor, 20)
float tbl(float x, bool sh){ float f = clamp((x-uXR)/(uXF-uXR),0.,1.)*${TABLE - 1}.; int i = min(int(floor(f)), ${TABLE - 2}); float t = f-float(i);
  float a = sh ? uShoulder[i] : uWidth[i]; float b = sh ? uShoulder[i+1] : uWidth[i+1]; return mix(a,b,t); }
bool rr(vec2 p, vec2 c, vec2 h, float r){ vec2 d=max(abs(p-c)-(h-r),0.); return dot(d,d)<=r*r; }
`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
{
  vec3 P = vObjPos; vec3 Nn = normalize(vObjN);
  float az = abs(P.z); vec2 sv = P.xy;
  float ys = tbl(P.x, true); float w = tbl(P.x, false);
  bool sideF = abs(Nn.z) > 0.45; bool frontF = Nn.x > 0.25; bool rearF = Nn.x < -0.25;
  // découpe exacte des ouvrants (même règle que classifyPart dans f21Body.ts)
  int part = 0;
  if (sideF && inDoor(sv) && P.y > ${f(ZONE_LIMITS.doorBottom)}) part = P.z < 0. ? 1 : 2;
  else if (P.x > ${ZONE_X.cowl} && (Nn.y > 0.42 || (frontF && P.y > 0.69)) && az < w * 0.87 && P.y > 0.66) part = 3;
  else if (P.x < ${ZONE_X.roofRear} && az < 0.6 && P.y > 0.66 && !sideF && (rearF || Nn.y > 0.3)) part = 4;
  if (part != uPart) discard;
  int zone = ${ZONE.paint};
  bool gh = P.y > ys + 0.012;
  if (gh && sideF && inDLO(sv)) { zone = (inBP(sv) || dDLO(sv) < 0.014) ? ${ZONE.gloss} : ${ZONE.glass}; }
  else if (gh && !sideF && P.x < ${ZONE_X.cowl} && P.x > ${ZONE_X.roofFront} && az < 0.67 - (P.x-${ZONE_X.roofFront})*0.08) {
    zone = (az > 0.61 - (P.x-${ZONE_X.roofFront})*0.08 || P.x < ${ZONE_X.roofFront} + 0.022 || P.x > ${ZONE_X.cowl} - 0.025) ? ${ZONE.gloss} : ${ZONE.glass};
  } else if (gh && !sideF && P.x < ${ZONE_X.roofRear} && P.x > ${ZONE_X.hatchBottom} && az < 0.63 && P.y > ys + 0.02) {
    zone = (az > 0.575 || P.x > ${ZONE_X.roofRear} - 0.03) ? ${ZONE.gloss} : ${ZONE.glass};
  }
  if (P.x > 1.62 && frontF) {
    if (az > 0.28 && inHeadF(vec2(az, P.y))) zone = ${ZONE.headLens};
    else if (rr(vec2(az, P.y), vec2(0.142, 0.603), vec2(0.108, 0.064), 0.045)) zone = ${ZONE.kidney};
    else if (az < 0.45 && P.y > 0.235 && P.y < 0.40) zone = ${ZONE.mesh};
    else if (inIntake(vec2(az, P.y))) zone = ${ZONE.mesh};
  }
  if (P.x > 1.55 && sideF && inHeadS(sv)) zone = ${ZONE.headLens};
  if (P.x > 1.72 && P.y < 0.207) zone = ${ZONE.gloss};
  if (az > 0.4 && P.x < -1.75 && inTail(sv)) zone = ${ZONE.tail};
  if (P.x < -2.0 && rearF) {
    if (P.y < 0.33) zone = ${ZONE.gloss};
    else if (az > 0.62 && az < 0.86 && P.y < 0.53) zone = (az > 0.66 && az < 0.8 && P.y > 0.36 && P.y < 0.385) ? ${ZONE.reflector} : ${ZONE.gloss};
  }
  if (P.x < -2.15 && sideF && P.y < 0.53 && P.y > 0.3) zone = ${ZONE.gloss};
  // joints de portière (trait fin)
  if (sideF && zone == ${ZONE.paint} && dDoor(sv) < 0.0028 && P.y < ys + 0.01) zone = ${ZONE.seam};
  // passages de roue et soubassement
  float dF = length(sv - vec2(uWheels.x, uWheelY)); float dR = length(sv - vec2(uWheels.z, uWheelY));
  if ((dF < uWheels.y + 0.004 || dR < uWheels.w + 0.004) && !sideF) zone = ${ZONE.cavity};
  if (Nn.y < -0.55) zone = ${ZONE.trim};

  if (zone == ${ZONE.glass}) { diffuseColor.rgb = vec3(0.004, 0.005, 0.007); roughnessFactor = 0.05; metalnessFactor = 0.0; }
  else if (zone == ${ZONE.gloss} || zone == ${ZONE.kidney}) { diffuseColor.rgb = vec3(0.006, 0.007, 0.008); roughnessFactor = 0.16; metalnessFactor = 0.1; }
  else if (zone == ${ZONE.trim} || zone == ${ZONE.seam}) { diffuseColor.rgb = vec3(0.02); roughnessFactor = 0.7; metalnessFactor = 0.; }
  else if (zone == ${ZONE.cavity}) { diffuseColor.rgb = vec3(0.012); roughnessFactor = 0.95; metalnessFactor = 0.; }
  else if (zone == ${ZONE.mesh}) { diffuseColor.rgb = vec3(0.015, 0.016, 0.018); roughnessFactor = 0.8; metalnessFactor = 0.;
    float hx = sin(P.z*160.)*sin(P.y*160.); diffuseColor.rgb *= 0.6 + 0.6*step(0.2, hx); }
  else if (zone == ${ZONE.headLens}) { diffuseColor.rgb = vec3(0.06, 0.07, 0.085); roughnessFactor = 0.06; metalnessFactor = 0.8; totalEmissiveRadiance += uHeadEm * 0.12; }
  else if (zone == ${ZONE.tail}) { diffuseColor.rgb = vec3(0.32, 0.01, 0.02); roughnessFactor = 0.1; metalnessFactor = 0.1; totalEmissiveRadiance += uTailEm; }
  else if (zone == ${ZONE.reflector}) { diffuseColor.rgb = vec3(0.45, 0.02, 0.03); roughnessFactor = 0.3; }
}
`,
      );
  };
  m.customProgramCacheKey = () => `f21zone-${physical}`;
  m.side = THREE.FrontSide;
  return m;
}

