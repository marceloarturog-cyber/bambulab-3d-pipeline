"""
Servicio de procesamiento de mallas 3D para el pipeline Bambu Lab.
Encapsula toda la lógica de conversión, validación, reparación y optimización.
"""

import logging
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional

import trimesh
import numpy as np

logger = logging.getLogger(__name__)

SUPPORTED_FORMATS = {'.obj', '.dae', '.3ds', '.ply', '.glb', '.gltf', '.stl', '.3mf', '.off', '.wrl'}

SCALE_PRESETS = {
    '1:50': 0.02,
    '1:75': 1 / 75,
    '1:100': 0.01,
    '1:150': 1 / 150,
    '1:200': 0.005,
    '1:250': 1 / 250,
    '1:500': 0.002,
}

UNIT_CONVERSIONS = {
    ('m', 'mm'): 1000,
    ('cm', 'mm'): 10,
    ('in', 'mm'): 25.4,
    ('ft', 'mm'): 304.8,
    ('mm', 'mm'): 1,
}

BAMBU_PRINTERS = {
    'X1C':    {'x': 256, 'y': 256, 'z': 256, 'name': 'Bambu Lab X1 Carbon'},
    'X1':     {'x': 256, 'y': 256, 'z': 256, 'name': 'Bambu Lab X1'},
    'P1S':    {'x': 256, 'y': 256, 'z': 256, 'name': 'Bambu Lab P1S'},
    'P1P':    {'x': 256, 'y': 256, 'z': 256, 'name': 'Bambu Lab P1P'},
    'A1':     {'x': 256, 'y': 256, 'z': 256, 'name': 'Bambu Lab A1'},
    'A1mini': {'x': 180, 'y': 180, 'z': 180, 'name': 'Bambu Lab A1 mini'},
}

PRINT_PROFILES = {
    'maqueta_detalle': {
        'layer_height': 0.12, 'infill': 15, 'infill_pattern': 'gyroid',
        'walls': 3, 'top_layers': 5, 'bottom_layers': 4,
        'speed': 150, 'supports': 'auto', 'material': 'PLA',
        'description': 'Alta calidad para presentación'
    },
    'maqueta_rapida': {
        'layer_height': 0.20, 'infill': 10, 'infill_pattern': 'grid',
        'walls': 2, 'top_layers': 4, 'bottom_layers': 3,
        'speed': 250, 'supports': 'auto', 'material': 'PLA',
        'description': 'Balance velocidad/calidad'
    },
    'maqueta_draft': {
        'layer_height': 0.28, 'infill': 8, 'infill_pattern': 'grid',
        'walls': 2, 'top_layers': 3, 'bottom_layers': 3,
        'speed': 300, 'supports': 'auto', 'material': 'PLA',
        'description': 'Borrador rápido'
    },
    'estructural': {
        'layer_height': 0.16, 'infill': 30, 'infill_pattern': 'cubic',
        'walls': 4, 'top_layers': 6, 'bottom_layers': 5,
        'speed': 120, 'supports': 'auto', 'material': 'PETG',
        'description': 'Resistente para exhibición'
    },
}


@dataclass
class MeshInfo:
    vertices: int = 0
    faces: int = 0
    dimensions_x: float = 0
    dimensions_y: float = 0
    dimensions_z: float = 0
    volume: float = 0
    is_manifold: bool = False
    is_convex: bool = False


@dataclass
class ValidationResult:
    is_valid: bool = True
    issues: list = field(default_factory=list)
    warnings: list = field(default_factory=list)


@dataclass
class RepairResult:
    repairs_applied: list = field(default_factory=list)
    success: bool = False


@dataclass
class PrintEstimate:
    layers: int = 0
    layer_height: float = 0
    weight_g: float = 0
    filament_m: float = 0
    time_h: float = 0
    material: str = "PLA"
    infill: str = ""
    profile: str = ""


@dataclass
class PipelineResult:
    success: bool = False
    mesh_info: Optional[MeshInfo] = None
    validation: Optional[ValidationResult] = None
    repair: Optional[RepairResult] = None
    estimate: Optional[PrintEstimate] = None
    fits_printer: bool = True
    pieces_count: int = 1
    output_path: Optional[str] = None
    output_size_mb: float = 0
    config: dict = field(default_factory=dict)
    error: Optional[str] = None


class MeshProcessor:

    def load(self, filepath: str) -> trimesh.Trimesh:
        path = Path(filepath)
        ext = path.suffix.lower()

        if ext == '.skp':
            raise ValueError(
                "Archivos .skp no se pueden leer directamente. "
                "Exporta desde SketchUp como .obj o .dae primero."
            )
        if ext not in SUPPORTED_FORMATS:
            raise ValueError(f"Formato no soportado: {ext}")

        scene_or_mesh = trimesh.load(str(path))

        if isinstance(scene_or_mesh, trimesh.Scene):
            meshes = [g for g in scene_or_mesh.geometry.values() if isinstance(g, trimesh.Trimesh)]
            if not meshes:
                raise ValueError("No se encontraron geometrías válidas")
            mesh = trimesh.util.concatenate(meshes)
        elif isinstance(scene_or_mesh, trimesh.Trimesh):
            mesh = scene_or_mesh
        else:
            raise ValueError(f"Tipo no esperado: {type(scene_or_mesh)}")

        return mesh

    def get_info(self, mesh: trimesh.Trimesh) -> MeshInfo:
        bounds = mesh.bounds
        dims = bounds[1] - bounds[0]
        return MeshInfo(
            vertices=len(mesh.vertices),
            faces=len(mesh.faces),
            dimensions_x=float(dims[0]),
            dimensions_y=float(dims[1]),
            dimensions_z=float(dims[2]),
            volume=float(abs(mesh.volume)),
            is_manifold=bool(mesh.is_watertight),
            is_convex=bool(mesh.is_convex),
        )

    def convert_units(self, mesh: trimesh.Trimesh, from_units: str) -> trimesh.Trimesh:
        key = (from_units.lower(), 'mm')
        factor = UNIT_CONVERSIONS.get(key, 1)
        if factor != 1:
            mesh.apply_scale(factor)
        return mesh

    def apply_scale(self, mesh: trimesh.Trimesh, scale: str = None, factor: float = None) -> trimesh.Trimesh:
        if scale and scale in SCALE_PRESETS:
            mesh.apply_scale(SCALE_PRESETS[scale])
        elif factor:
            mesh.apply_scale(factor)
        return mesh

    def validate(self, mesh: trimesh.Trimesh) -> ValidationResult:
        result = ValidationResult()

        if not mesh.is_watertight:
            result.issues.append("Mesh no es sólido (no watertight)")
            result.is_valid = False

        if not mesh.is_winding_consistent:
            result.issues.append("Normales inconsistentes")
            result.is_valid = False

        areas = mesh.area_faces
        degenerate = int(np.sum(areas < 1e-10))
        if degenerate > 0:
            result.issues.append(f"{degenerate} caras degeneradas")
            result.is_valid = False

        vol = mesh.volume
        if vol <= 0:
            result.issues.append(f"Volumen inválido ({vol:.2f})")
            result.is_valid = False

        dims = mesh.bounds[1] - mesh.bounds[0]
        for i, axis in enumerate(['X', 'Y', 'Z']):
            if dims[i] < 0.1:
                result.warnings.append(f"Eje {axis} muy pequeño ({dims[i]:.4f}mm)")
            if dims[i] > 10000:
                result.warnings.append(f"Eje {axis} muy grande ({dims[i]:.1f}mm)")

        if len(mesh.faces) > 2_000_000:
            result.warnings.append(f"Alto conteo de caras ({len(mesh.faces):,})")

        return result

    def repair(self, mesh: trimesh.Trimesh) -> RepairResult:
        result = RepairResult()

        try:
            mesh.fix_normals()
            result.repairs_applied.append("Normales corregidas")
        except Exception:
            pass

        initial_faces = len(mesh.faces)
        mesh.remove_degenerate_faces()
        removed = initial_faces - len(mesh.faces)
        if removed > 0:
            result.repairs_applied.append(f"{removed} caras degeneradas eliminadas")

        initial_verts = len(mesh.vertices)
        mesh.merge_vertices()
        merged = initial_verts - len(mesh.vertices)
        if merged > 0:
            result.repairs_applied.append(f"{merged} vértices fusionados")

        if not mesh.is_watertight:
            try:
                mesh.fill_holes()
                if mesh.is_watertight:
                    result.repairs_applied.append("Huecos rellenados")
            except Exception:
                pass

        mesh.remove_unreferenced_vertices()
        result.success = True
        return result

    def optimize(self, mesh: trimesh.Trimesh, orient: bool = True) -> trimesh.Trimesh:
        if orient:
            dims = mesh.bounds[1] - mesh.bounds[0]
            areas = [dims[0] * dims[1], dims[0] * dims[2], dims[1] * dims[2]]
            if areas[1] > areas[0] and areas[1] >= areas[2]:
                rot = trimesh.transformations.rotation_matrix(np.radians(90), [1, 0, 0])
                mesh.apply_transform(rot)
            elif areas[2] > areas[0] and areas[2] > areas[1]:
                rot = trimesh.transformations.rotation_matrix(np.radians(90), [0, 1, 0])
                mesh.apply_transform(rot)

        # Flatten base to Z=0
        z_min = mesh.bounds[0][2]
        if abs(z_min) > 0.001:
            mesh.apply_translation([0, 0, -z_min])

        # Center on bed
        centroid = mesh.centroid
        mesh.apply_translation([-centroid[0], -centroid[1], 0])

        return mesh

    def check_fits_printer(self, mesh: trimesh.Trimesh, printer: str) -> tuple[bool, dict]:
        vol = BAMBU_PRINTERS[printer]
        dims = mesh.bounds[1] - mesh.bounds[0]
        fits = all(dims[i] <= [vol['x'], vol['y'], vol['z']][i] for i in range(3))
        overflow = {}
        for i, axis in enumerate(['x', 'y', 'z']):
            if dims[i] > vol[axis]:
                overflow[axis] = {'model': float(dims[i]), 'limit': vol[axis]}
        return fits, overflow

    def estimate_print(self, mesh: trimesh.Trimesh, profile_name: str) -> PrintEstimate:
        profile = PRINT_PROFILES[profile_name]
        dims = mesh.bounds[1] - mesh.bounds[0]
        volume_mm3 = abs(mesh.volume)
        if volume_mm3 < 1:
            volume_mm3 = dims[0] * dims[1] * dims[2] * (profile['infill'] / 100)

        num_layers = int(dims[2] / profile['layer_height'])
        filament_density = 1.24
        weight_g = (volume_mm3 / 1000) * filament_density * (1 + profile['infill'] / 100)
        filament_m = (volume_mm3 * (1 + profile['infill'] / 100)) / (np.pi * (1.75 / 2) ** 2) / 1000
        time_h = (num_layers * (dims[0] + dims[1]) * 2) / (profile['speed'] * 3600) * num_layers * 0.15

        return PrintEstimate(
            layers=num_layers,
            layer_height=profile['layer_height'],
            weight_g=round(float(weight_g), 1),
            filament_m=round(float(filament_m), 2),
            time_h=round(max(0.5, float(time_h)), 1),
            material=profile['material'],
            infill=f"{profile['infill']}%",
            profile=profile_name,
        )

    def generate_config(self, mesh: trimesh.Trimesh, printer: str, profile_name: str) -> dict:
        profile = PRINT_PROFILES[profile_name]
        dims = mesh.bounds[1] - mesh.bounds[0]
        return {
            'impresora': BAMBU_PRINTERS[printer]['name'],
            'perfil': profile_name,
            'configuracion': profile,
            'modelo': {
                'dimensiones_mm': {'x': round(float(dims[0]), 2), 'y': round(float(dims[1]), 2), 'z': round(float(dims[2]), 2)},
                'caras': len(mesh.faces),
                'solido': mesh.is_watertight,
            },
        }

    def export_stl(self, mesh: trimesh.Trimesh, output_path: str) -> float:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        mesh.export(output_path, file_type='stl')
        return Path(output_path).stat().st_size / (1024 * 1024)

    def run_pipeline(
        self,
        input_path: str,
        output_dir: str,
        scale: str = None,
        scale_factor: float = None,
        units: str = 'mm',
        printer: str = 'X1C',
        profile: str = 'maqueta_detalle',
        auto_fix: bool = True,
        orient: bool = True,
    ) -> PipelineResult:
        result = PipelineResult()

        try:
            mesh = self.load(input_path)
            mesh = self.convert_units(mesh, units)
            mesh = self.apply_scale(mesh, scale, scale_factor)

            result.validation = self.validate(mesh)

            if auto_fix and not result.validation.is_valid:
                result.repair = self.repair(mesh)
                result.validation = self.validate(mesh)

            mesh = self.optimize(mesh, orient=orient)

            fits, overflow = self.check_fits_printer(mesh, printer)
            result.fits_printer = fits
            result.pieces_count = 1

            stem = Path(input_path).stem
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = str(Path(output_dir) / f'{stem}_bambulab_{timestamp}.stl')

            result.output_size_mb = self.export_stl(mesh, output_path)
            result.output_path = output_path
            result.mesh_info = self.get_info(mesh)
            result.estimate = self.estimate_print(mesh, profile)
            result.config = self.generate_config(mesh, printer, profile)
            result.success = True

        except Exception as e:
            logger.error(f"Pipeline error: {e}")
            result.error = str(e)

        return result
