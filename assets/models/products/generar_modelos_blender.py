# -*- coding: utf-8 -*-
"""
PrimOffice · Generador reproducible de modelos .glb (Blender)
=============================================================
Genera versiones simplificadas y LIGERAS de los productos y las exporta
a assets/models/products/<id>.glb, listas para el pipeline de setup-3d.js.

Requiere Blender (no estaba disponible en el entorno de generacion).
Uso:
    blender --background --python assets/models/products/generar_modelos_blender.py

Tras generar un .glb, activarlo en js/setup-3d.js: en REGISTRY, reemplazar
`model:null` por `model:'assets/models/products/<id>.glb'`. Si el .glb falla
o no existe, el configurador sigue usando la geometria procedural (fallback).

Escala: 1 unidad Blender = 1 metro (coincide con la escena de setup-3d.js).
Origen del objeto: base apoyada en Z=0 (en glTF -> Y arriba tras exportar).

NOTA: aca solo se incluyen los productos SIMPLES (pBox, pStandard, pHub,
pGlow). Los complejos (pArm, pNotebook, pMechanic, pMouseProV, pPhonePro)
quedan como TODO: requieren modelado/sculpt de mayor fidelidad o una
herramienta image-to-3D (no disponible sin credenciales).
"""
import bpy, os, math

OUT = os.path.join(os.path.dirname(bpy.data.filepath) or ".", "..", "..", "assets", "models", "products")
OUT = os.path.normpath(os.path.join(os.getcwd(), "assets", "models", "products"))

def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)

def mat(name, rgba, rough=0.6, metal=0.1, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emit is not None:
        try:
            bsdf.inputs["Emission Color"].default_value = emit
            bsdf.inputs["Emission Strength"].default_value = 1.5
        except Exception:
            pass
    return m

def cube(name, size, loc, m):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name
    o.scale = (size[0]/2, size[1]/2, size[2]/2)
    bpy.ops.object.transform_apply(scale=True)
    if m: o.data.materials.append(m)
    return o

def export(name):
    os.makedirs(OUT, exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    path = os.path.join(OUT, name + ".glb")
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True)
    print("exportado:", path)

# ---- pBox: bandeja de cables 40x18x10 cm (acero negro, tapa abatible) ----
def build_pBox():
    reset()
    steel = mat("steel", (0.17,0.19,0.23,1), 0.45, 0.55)
    w,h,d,t = 0.40,0.10,0.18,0.01
    cube("piso", (w,d,t), (0,0,t/2), steel)
    cube("pared_tras", (w,t,h), (0,-d/2+t/2,h/2), steel)
    cube("lado_l", (t,d,h), (-w/2+t/2,0,h/2), steel)
    cube("lado_r", (t,d,h), ( w/2-t/2,0,h/2), steel)
    lid = cube("tapa", (w,d*0.92,t), (0,0.02,h+0.02), mat("lid",(0.13,0.16,0.19,1),0.5,0.5))
    lid.rotation_euler[0] = math.radians(-20)
    export("pBox")

# ---- pStandard: riser de monitor (acero negro) ----
def build_pStandard():
    reset()
    steel = mat("steel2", (0.16,0.19,0.22,1), 0.42, 0.5)
    cube("plataforma", (0.34,0.20,0.022), (0,0,0.106), steel)
    for sx in (-1,1):
        cube("pata", (0.03,0.16,0.10), (sx*0.14,0,0.05), steel)
        cube("pie", (0.05,0.19,0.012), (sx*0.14,0,0.006), steel)
    export("pStandard")

# ---- pHub: hub USB-C 7en1 (aluminio) ----
def build_pHub():
    reset()
    alu = mat("alu", (0.60,0.65,0.70,1), 0.32, 0.7)
    cube("cuerpo", (0.13,0.046,0.018), (0,0,0.009), alu)
    port = mat("port", (0.06,0.08,0.10,1), 0.6, 0.1)
    for i in range(4):
        cube("puerto%d"%i, (0.016,0.004,0.008), (-0.045+i*0.028,0.023,0.009), port)
    export("pHub")

# ---- pGlow: barra de luz LED de monitor ----
def build_pGlow():
    reset()
    dk = mat("bar", (0.13,0.16,0.20,1), 0.5, 0.3)
    cube("barra", (0.44,0.05,0.028), (0,0,0), dk)
    cube("luz", (0.40,0.028,0.010), (0,0.008,-0.016), mat("warm",(1,0.95,0.83,1),0.4,0,emit=(1,0.95,0.83,1)))
    cube("contrapeso", (0.10,0.05,0.03), (0,-0.06,-0.06), dk)
    export("pGlow")

if __name__ == "__main__":
    build_pBox()
    build_pStandard()
    build_pHub()
    build_pGlow()
    # TODO (alta fidelidad / image-to-3D): pArm, pNotebook, pMechanic, pMouseProV, pPhonePro
    print("Listo. .glb en", OUT)
