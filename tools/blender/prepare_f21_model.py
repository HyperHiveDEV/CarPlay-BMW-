"""
BMW F21 Digital — préparation d'un VRAI modèle 3D BMW F21 LCI (sous licence) pour l'application.

Contrairement à f21_split_openings.py (spécifique à la maquette trimesh), ce script ne fabrique
aucune géométrie : il réorganise un modèle professionnel existant.

  1. importe le modèle source (.blend, .fbx, .obj, .glb/.gltf) ;
  2. oriente et met à l'échelle : avant = +X, haut = +Z (Blender), longueur hors tout = 4,324 m ;
  3. rassemble les objets de chaque ouvrant (portières, capot, hayon) d'après des motifs de noms
     définis dans un fichier JSON (voir f21_mapping.example.json), sous un pivot placé sur la charnière
     (coordonnées données dans le JSON, ou déduites automatiquement de la boîte englobante) ;
  4. regroupe chaque roue (pneu, jante, centre, disque…) sous wheel_fl/fr/rl/rr, et les roues avant
     sous steer_fl/fr ;
  5. renomme les matériaux selon les rôles de l'application (Paint, Glass, BlackGloss, Rim, Tyre,
     Chrome, Trim) et les pièces lumineuses (light_head_l, light_tail_r, blinker_fl…) ;
  6. applique la personnalisation du véhicule : peinture blanche, rétroviseurs et calandre noir
     brillant, jantes anthracite (si les pièces existent dans le modèle) ;
  7. optionnel : décimation au-delà d'un budget de triangles (autoradio) ;
  8. exporte public/models/bmw_f21_lci.glb (Y vers le haut) + public/models/model-manifest.json.
     En mode « Auto », l'application le charge à la place de la reconstitution procédurale.

Usage :
  blender --background --python tools/blender/prepare_f21_model.py -- <source> <mapping.json> [sortie.glb]

Non exécuté dans l'environnement de développement (Blender indisponible) : à valider sur un poste
équipé de Blender ≥ 3.6, avec le modèle réellement acquis.
"""
import json
import math
import os
import re
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
if len(argv) < 2:
    raise SystemExit("Usage : blender -b -P prepare_f21_model.py -- <source> <mapping.json> [sortie.glb]")
SRC, MAPPING = argv[0], argv[1]
DST = argv[2] if len(argv) > 2 else "public/models/bmw_f21_lci.glb"
CFG = json.load(open(MAPPING, encoding="utf-8"))
TARGET_LENGTH = CFG.get("target_length_m", 4.324)


def match(name, patterns):
    return any(re.search(p, name, re.IGNORECASE) for p in patterns)


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def world_bbox(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def make_empty(name, loc, parent=None):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    if parent:
        bpy.context.view_layer.update()
        reparent(e, parent)
    return e


def reparent(child, parent):
    bpy.context.view_layer.update()
    m = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = m


# ------------------------------------------------------------------ 1. import
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(SRC)[1].lower()
if ext == ".blend":
    with bpy.data.libraries.load(SRC) as (src, dst):
        dst.objects = src.objects
    for o in dst.objects:
        if o:
            bpy.context.scene.collection.objects.link(o)
elif ext == ".fbx":
    bpy.ops.import_scene.fbx(filepath=SRC)
elif ext == ".obj":
    bpy.ops.wm.obj_import(filepath=SRC)
elif ext in (".glb", ".gltf"):
    bpy.ops.import_scene.gltf(filepath=SRC)
else:
    raise SystemExit(f"Format non pris en charge : {ext}")

for o in list(bpy.data.objects):
    if match(o.name, CFG.get("delete", [])):
        bpy.data.objects.remove(o, do_unlink=True)

# ------------------------------------------------------------------ 2. orientation et échelle
root = make_empty("F21_root", (0, 0, 0))
for o in list(bpy.data.objects):
    if o.parent is None and o is not root:
        reparent(o, root)
root.rotation_euler = [math.radians(a) for a in CFG.get("rotate_deg", [0, 0, 0])]
bpy.context.view_layer.update()
lo, hi = world_bbox(meshes())
scale = TARGET_LENGTH / max(hi.x - lo.x, 1e-6)
root.scale = (scale, scale, scale)
bpy.context.view_layer.update()
lo, hi = world_bbox(meshes())
root.location -= Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))  # centré, roues au sol
bpy.context.view_layer.update()
print(f"Dimensions : L {hi.x - lo.x:.3f}  l {hi.y - lo.y:.3f}  H {hi.z - lo.z:.3f} m (échelle ×{scale:.4f})")

# ------------------------------------------------------------------ 3. ouvrants
OPENING_NAMES = {"driverDoor": "door_driver", "passengerDoor": "door_passenger", "hood": "hood", "tailgate": "tailgate"}
for key, node in OPENING_NAMES.items():
    spec = CFG["openings"].get(key)
    if not spec:
        print(f"! ouvrant {key} non défini dans le mapping")
        continue
    parts = [o for o in meshes() if match(o.name, spec["patterns"])]
    if not parts:
        print(f"! aucun objet pour {key} (motifs {spec['patterns']})")
        continue
    blo, bhi = world_bbox(parts)
    hinge = spec.get("hinge")
    if hinge is None:  # déduction : portière = arête avant extérieure, capot = arête arrière haute, hayon = arête avant haute
        if key in ("driverDoor", "passengerDoor"):
            y = bhi.y if (blo.y + bhi.y) > 0 else blo.y
            hinge = (bhi.x, y, (blo.z + bhi.z) / 2)
        elif key == "hood":
            hinge = (blo.x, 0, bhi.z)
        else:
            hinge = (bhi.x, 0, bhi.z)
    pivot = make_empty(node, hinge, root)
    for p in parts:
        reparent(p, pivot)
    print(f"✓ {node} : {len(parts)} objets, charnière {tuple(round(v, 3) for v in hinge)}")

# ------------------------------------------------------------------ 4. roues
for key, spec in CFG.get("wheels", {}).items():  # key = fl, fr, rl, rr
    parts = [o for o in meshes() if match(o.name, spec["patterns"])]
    if not parts:
        print(f"! roue {key} introuvable")
        continue
    blo, bhi = world_bbox(parts)
    center = (blo + bhi) / 2
    parent = make_empty(f"steer_{key}", center, root) if key.startswith("f") else root
    wheel = make_empty(f"wheel_{key}", center, parent)
    for p in parts:
        reparent(p, wheel)
    print(f"✓ wheel_{key} : {len(parts)} objets, centre {tuple(round(v, 3) for v in center)}")

# ------------------------------------------------------------------ 5–6. matériaux, feux, personnalisation
def principled(name, color, metal, rough, alpha=1.0, coat=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if alpha < 1:
        m.blend_method = "BLEND"
    return m

ROLE_MATERIALS = {
    "Paint": principled("Paint", (0.92, 0.93, 0.92), 0.0, 0.25, coat=1.0),
    "Glass": principled("Glass", (0.04, 0.05, 0.06), 0.0, 0.03, alpha=0.55),
    "BlackGloss": principled("BlackGloss", (0.008, 0.008, 0.009), 0.1, 0.12, coat=1.0),
    "Rim": principled("Rim", (0.30, 0.32, 0.35), 0.75, 0.35),
    "Tyre": principled("Tyre", (0.025, 0.025, 0.025), 0.0, 0.9),
    "Chrome": principled("Chrome", (0.85, 0.85, 0.85), 1.0, 0.08),
    "Trim": principled("Trim", (0.03, 0.03, 0.03), 0.0, 0.7),
}
for role, patterns in CFG.get("materials", {}).items():
    target = ROLE_MATERIALS[role]
    for o in meshes():
        for slot in o.material_slots:
            if slot.material and (match(slot.material.name, patterns) or match(o.name, patterns)):
                slot.material = target
for light, patterns in CFG.get("lights", {}).items():
    for o in meshes():
        if match(o.name, patterns):
            side = "l" if world_bbox([o])[0].y + world_bbox([o])[1].y > 0 else "r"
            o.name = f"{light}_{side}" if not light.endswith(("_l", "_r", "fl", "fr", "rl", "rr")) else light

# ------------------------------------------------------------------ 7. budget de triangles
budget = CFG.get("triangle_budget")
if budget:
    total = sum(len(o.data.polygons) for o in meshes())
    if total > budget:
        ratio = budget / total
        for o in meshes():
            mod = o.modifiers.new("decimate", "DECIMATE")
            mod.ratio = max(ratio, 0.2)
        print(f"Décimation ×{ratio:.2f} ({total} → ~{budget} polygones)")

# ------------------------------------------------------------------ 8. export + manifeste
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_yup=True, export_apply=True)
manifest = {
    "file": "models/" + os.path.basename(DST),
    "scale": 1,
    "rotationY": 0,
    "openings": {
        "driverDoor": {"node": "door_driver", "axis": "y", "angle": -1.12, "durationS": 1.15},
        "passengerDoor": {"node": "door_passenger", "axis": "y", "angle": 1.12, "durationS": 1.15},
        "hood": {"node": "hood", "axis": "z", "angle": 0.92, "durationS": 1.5},
        "tailgate": {"node": "tailgate", "axis": "z", "angle": -1.22, "durationS": 1.7},
    },
    "wheels": {"fl": "wheel_fl", "fr": "wheel_fr", "rl": "wheel_rl", "rr": "wheel_rr", "steerFl": "steer_fl", "steerFr": "steer_fr"},
    "lights": {
        "headlights": ["light_head_l", "light_head_r"], "tail": ["light_tail_l", "light_tail_r"], "brake": ["light_brake_l", "light_brake_r"],
        "blinkLeft": ["blinker_fl", "blinker_rl", "blinker_mirror_l"], "blinkRight": ["blinker_fr", "blinker_rr", "blinker_mirror_r"],
    },
    "materials": {k: k.lower() if k != "BlackGloss" else "gloss" for k in ROLE_MATERIALS},
}
manifest["materials"] = {"Paint": "paint", "Glass": "glass", "BlackGloss": "gloss", "Rim": "rim", "Tyre": "tyre", "Chrome": "chrome", "Trim": "trim"}
with open(os.path.join(os.path.dirname(DST), "model-manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2, ensure_ascii=False)
print("Export OK :", DST)
