"""
Servicio de mediciones de modelos 3D.
Calcula distancias, grosores y analiza componentes.
"""

import logging
from typing import Optional

import trimesh
import numpy as np

logger = logging.getLogger(__name__)


class MeasurementService:

    def measure_distance(
        self,
        mesh: trimesh.Trimesh,
        point_a: list[float],
        point_b: list[float],
    ) -> dict:
        a = np.array(point_a)
        b = np.array(point_b)
        distance = float(np.linalg.norm(b - a))
        return {
            'distance': round(distance, 4),
            'unit': 'mm',
            'point_a': point_a,
            'point_b': point_b,
        }

    def get_model_dimensions(self, mesh: trimesh.Trimesh) -> dict:
        bounds = mesh.bounds
        dims = bounds[1] - bounds[0]
        return {
            'x': round(float(dims[0]), 2),
            'y': round(float(dims[1]), 2),
            'z': round(float(dims[2]), 2),
            'volume': round(float(abs(mesh.volume)), 2),
            'surface_area': round(float(mesh.area), 2),
            'center': mesh.centroid.tolist(),
        }

    def analyze_thickness(self, mesh: trimesh.Trimesh, num_samples: int = 100) -> dict:
        try:
            points, face_idx = trimesh.sample.sample_surface(mesh, num_samples)
            normals = mesh.face_normals[face_idx]

            ray_origins = points + normals * 0.01
            ray_directions = -normals

            locations, index_ray, _ = mesh.ray.intersects_location(
                ray_origins=ray_origins,
                ray_directions=ray_directions,
            )

            thicknesses = []
            for i in range(num_samples):
                hits = locations[index_ray == i]
                if len(hits) >= 2:
                    dists = np.linalg.norm(hits - points[i], axis=1)
                    dists = dists[dists > 0.01]
                    if len(dists) > 0:
                        thicknesses.append(float(np.min(dists)))

            if not thicknesses:
                return {'min': 0, 'max': 0, 'avg': 0, 'samples': 0}

            return {
                'min': round(min(thicknesses), 2),
                'max': round(max(thicknesses), 2),
                'avg': round(sum(thicknesses) / len(thicknesses), 2),
                'samples': len(thicknesses),
            }
        except Exception as e:
            logger.warning(f"Thickness analysis failed: {e}")
            return {'min': 0, 'max': 0, 'avg': 0, 'samples': 0, 'error': str(e)}

    def detect_components(self, mesh: trimesh.Trimesh) -> list[dict]:
        try:
            components = mesh.split(only_watertight=False)
        except Exception:
            return [{
                'name': 'modelo_completo',
                'vertices': len(mesh.vertices),
                'faces': len(mesh.faces),
                'volume': round(float(abs(mesh.volume)), 2),
            }]

        result = []
        for i, comp in enumerate(components):
            bounds = comp.bounds
            dims = bounds[1] - bounds[0]

            aspect = sorted([dims[0], dims[1], dims[2]])
            if aspect[2] > 0 and aspect[0] / aspect[2] < 0.3:
                comp_type = 'columna'
            elif aspect[2] > 0 and aspect[1] / aspect[2] < 0.15:
                comp_type = 'muro'
            elif dims[2] < dims[0] * 0.1 and dims[2] < dims[1] * 0.1:
                comp_type = 'losa'
            else:
                comp_type = 'elemento'

            result.append({
                'name': f'{comp_type}_{i + 1}',
                'type': comp_type,
                'vertices': len(comp.vertices),
                'faces': len(comp.faces),
                'dimensions': {
                    'x': round(float(dims[0]), 2),
                    'y': round(float(dims[1]), 2),
                    'z': round(float(dims[2]), 2),
                },
                'volume': round(float(abs(comp.volume)), 2) if comp.is_watertight else None,
            })

        return result
