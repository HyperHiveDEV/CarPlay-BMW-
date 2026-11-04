"""
BMW F21 Digital — préparation reproductible d'un GLB pour l'application (Blender ≥ 3.6).

Ce script :
  1. importe le GLB maquette (trimesh, Z vers le haut) ;
  2. corrige la latéralité (la maquette place l'échappement « left » côté y < 0) ;
  3. subdivise la coque et la découpe par plans (bisect) pour séparer
     portière conducteur, portière passager, capot et hayon en objets indépendants ;
  4. rattache vitres de portière, poignées et rétroviseurs aux portières, et lunette,
     becquet et feux intérieurs au hayon ;
  5. place l'origine de chaque ouvrant sur sa charnière ;
  6. regroupe chaque roue (pneu, voile, branches, centre) sous un pivot wheel_xx,
     et les roues avant sous un pivot de braquage steer_xx ;
  7. crée les matériaux nommés attendus par l'application (Paint, Glass, BlackGloss, Rim,
     Tyre, Chrome, Trim) et les noms de nœuds du manifeste (door_driver, hood, tailgate…) ;
  8. exporte public/models/bmw_f21_lci.glb (Y vers le haut) — chargé automatiquement en mode « Auto ».

Usage :
  blender --background --python tools/blender/f21_split_openings.py -- \
      public/models/BMW_116i_F21_2018_maquette_3D.glb public/models/bmw_f21_lci.glb

ATTENTION : non exécuté dans l'environnement de développement (Blender indisponible).
Avec la maquette actuelle (coque de 60 sommets), les découpes sont des plans droits :
le résultat est fonctionnel mais grossier. Le script est surtout destiné à un modèle plus détaillé —
adapter alors les constantes de la section RÉGIONS (coordonnées dans le repère du fichier source).
"""
import math
import sys
import bpy
import bmesh
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SRC = argv[0] if len(argv) > 0 else "public/models/BMW_116i_F21_2018_maquette_3D.glb"
DST = argv[1] if len(argv) > 1 else "public/models/bmw_f21_lci.glb"

# ------------------------------------------------------------------ RÉGIONS (repère source, m)
BODY_NAME = "F21 three-door body shell"
DOOR_FRONT_X = 0.65      # bord avant de portière (charnière)
DOOR_REAR_X = -0.89      # bord arrière de portière
DOOR_BOTTOM_Z = 0.35
DOOR_HALF_Y = 0.70       # |y| au-delà duquel une face est « latérale »
HOOD_REAR_X = 0.68       # base du pare-brise (charnière du capot)
HOOD_HALF_Y = 0.72
HOOD_MIN_Z = 0.80
TAILGATE_FRONT_X = -1.72 # charnière du hayon (fin du pavillon)
TAILGATE_HALF_Y = 0.60
TAILGATE_MIN_Z = 0.72
SUBDIV_CUTS = 6

# ------------------------------------------------------------------ outils
def obj(name):
    return bpy.data.objects.get(name)

def objects_like(fragment):
    return [o for o in bpy.data.objects if fragment.lower() in o.name.lower()]

def set_origin(o, point):
    bpy.context.scene.cursor.location = point
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")

def parent_keep(child, parent):
    m = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = m

def separate_faces(src, predicate, new_name):
    """Sépare les faces dont le centre (repère monde) vérifie predicate(c, n)."""
    bpy.ops.object.select_all(action="DESELECT")
    src.select_set(True)
    bpy.context.view_layer.objects.active = src
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(src.data)
    mw = src.matrix_world
    for f in bm.faces:
        c = mw @ f.calc_center_median()
        n = (mw.to_3x3() @ f.normal).normalized()
        f.select = predicate(c, n)
    bmesh.update_edit_mesh(src.data)
    before = set(bpy.data.objects)
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    new = [o for o in bpy.data.objects if o not in before]
    if not new:
        raise RuntimeError(f"Aucune face sélectionnée pour {new_name}")
    new[0].name = new_name
    return new[0]

def bisect(o, co, no):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.bisect(plane_co=co, plane_no=no, use_fill=False, clear_inner=False, clear_outer=False)
    bpy.ops.object.mode_set(mode="OBJECT")

# ------------------------------------------------------------------ 1. import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

# ------------------------------------------------------------------ 2. repère + latéralité
# L'import glTF convertit Y-haut → Z-haut ; le fichier trimesh étant déjà Z-haut, il arrive couché.
# On « cuit » pour chaque maillage : rotation −90° autour de X, puis miroir Y (la maquette place
# l'échappement « left » côté y < 0), directement en coordonnées monde ; transformations remises à zéro.
from mathutils import Matrix
FIX = Matrix.Scale(-1, 4, (0, 1, 0)) @ Matrix.Rotation(-math.pi / 2, 4, "X")
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(FIX @ mw)
    o.matrix_world = Matrix.Identity(4)
    o.data.flip_normals()  # le miroir inverse l'orientation des faces
    o.data.update()
for o in [o for o in bpy.data.objects if o.type == "EMPTY"]:
    bpy.data.objects.remove(o, do_unlink=True)

body = obj(BODY_NAME) or objects_like("body shell")[0]

# ------------------------------------------------------------------ 3. subdivision + découpes
bpy.ops.object.select_all(action="DESELECT")
body.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.subdivide(number_cuts=SUBDIV_CUTS, smoothness=0.0)
bpy.ops.object.mode_set(mode="OBJECT")
for x in (DOOR_FRONT_X, DOOR_REAR_X, HOOD_REAR_X, TAILGATE_FRONT_X):
    bisect(body, (x, 0, 0), (1, 0, 0))
bisect(body, (0, 0, DOOR_BOTTOM_Z), (0, 0, 1))
bisect(body, (0, 0, TAILGATE_MIN_Z), (0, 0, 1))

def door_pred(sign):
    return lambda c, n: DOOR_REAR_X < c.x < DOOR_FRONT_X and c.z > DOOR_BOTTOM_Z and c.y * sign > DOOR_HALF_Y * 0.9 and abs(n.y) > 0.4

# après le miroir, le côté conducteur (gauche) est y > 0
door_l = separate_faces(body, door_pred(+1), "door_driver")
door_r = separate_faces(body, door_pred(-1), "door_passenger")
hood = separate_faces(body, lambda c, n: c.x > HOOD_REAR_X and abs(c.y) < HOOD_HALF_Y and c.z > HOOD_MIN_Z and n.z > 0.3, "hood")
tailgate = separate_faces(body, lambda c, n: c.x < TAILGATE_FRONT_X and abs(c.y) < TAILGATE_HALF_Y and c.z > TAILGATE_MIN_Z and (n.x < -0.2 or n.z > 0.3), "tailgate")

# ------------------------------------------------------------------ 4. accessoires rattachés
for o in list(bpy.data.objects):
    n = o.name.lower()
    if o.type != "MESH" or o in (door_l, door_r, hood, tailgate, body):
        continue
    side_left = o.matrix_world.translation.y + sum((o.matrix_world @ Vector(v)).y for v in o.bound_box) / 8 > 0
    if any(k in n for k in ("front side window", "door handle", "mirror")):
        parent_keep(o, door_l if side_left else door_r)
    elif any(k in n for k in ("rear windshield", "roof spoiler", "inner rear taillight")):
        parent_keep(o, tailgate)

# ------------------------------------------------------------------ 5. charnières
set_origin(door_l, (DOOR_FRONT_X, 0.86, 0.6))
set_origin(door_r, (DOOR_FRONT_X, -0.86, 0.6))
set_origin(hood, (HOOD_REAR_X, 0.0, 1.06))
# charnière du hayon : bord avant / haut de l'ensemble réellement rattaché (coque + lunette + becquet)
bpy.context.view_layer.update()
tg_pts = [o.matrix_world @ Vector(c) for o in [tailgate, *tailgate.children_recursive] if o.type == "MESH" for c in o.bound_box]
set_origin(tailgate, (max(p.x for p in tg_pts), 0.0, max(p.z for p in tg_pts)))

# ------------------------------------------------------------------ 6. roues
for axle in ("front", "rear"):
    for sign, suffix in ((+1, "l"), (-1, "r")):
        parts = [o for o in bpy.data.objects if o.type == "MESH" and axle in o.name.lower()
                 and any(k in o.name.lower() for k in ("tire", "inner face", "spoke", "roundel"))
                 and sum((o.matrix_world @ Vector(v)).y for v in o.bound_box) / 8 * sign > 0]
        tire = next(o for o in parts if "tire" in o.name.lower())
        center = sum((tire.matrix_world @ Vector(v) for v in tire.bound_box), Vector()) / 8
        key = ("f" if axle == "front" else "r") + suffix
        wheel = bpy.data.objects.new(f"wheel_{key}", None)
        bpy.context.scene.collection.objects.link(wheel)
        wheel.location = center
        if axle == "front":
            steer = bpy.data.objects.new(f"steer_{key}", None)
            bpy.context.scene.collection.objects.link(steer)
            steer.location = center
            bpy.context.view_layer.update()
            parent_keep(wheel, steer)
        bpy.context.view_layer.update()
        for p in parts:
            parent_keep(p, wheel)

# ------------------------------------------------------------------ 7. matériaux nommés
def mat(name, color, metal=0.0, rough=0.5, alpha=1.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Roughness"].default_value = rough
    b.inputs["Alpha"].default_value = alpha
    return m

M = {
    "Paint": mat("Paint", (0.93, 0.94, 0.93), 0, 0.25), "Glass": mat("Glass", (0.05, 0.07, 0.09), 0, 0.05, 0.6),
    "BlackGloss": mat("BlackGloss", (0.01, 0.01, 0.01), 0.1, 0.15), "Rim": mat("Rim", (0.32, 0.34, 0.37), 0.7, 0.35),
    "Tyre": mat("Tyre", (0.03, 0.03, 0.03), 0, 0.9), "Chrome": mat("Chrome", (0.8, 0.8, 0.8), 1, 0.1),
    "Trim": mat("Trim", (0.03, 0.03, 0.03), 0, 0.7),
}
RULES = [
    (("body shell", "roof upper", "side skirt", "door handle", "sharkfin", "shoulder", "door_", "hood", "tailgate"), "Paint"),
    (("window", "windshield"), "Glass"), (("tire",), "Tyre"), (("spoke", "inner face"), "Rim"),
    (("exhaust", "fog"), "Chrome"), (("door cut",), "Trim"),
]
LIGHTS = {"headlight led ring": "light_head", "tail light": "light_tail", "inner rear taillight": "light_brake"}
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    n = o.name.lower()
    target = next((m for keys, m in RULES if any(k in n for k in keys)), "BlackGloss")
    o.data.materials.clear()
    o.data.materials.append(M[target])
    for k, base in LIGHTS.items():
        if k in n:
            o.name = f"{base}_{'l' if sum((o.matrix_world @ Vector(v)).y for v in o.bound_box) > 0 else 'r'}"

# ------------------------------------------------------------------ 8. export
bpy.ops.export_scene.gltf(filepath=DST, export_format="GLB", export_yup=True, export_apply=True)
print("Export OK :", DST)
