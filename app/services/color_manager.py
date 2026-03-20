"""
Gestión de colores y materiales para modelos 3D.
Soporta asignación de colores por componente y exportación con colores.
"""

import logging

import trimesh
import numpy as np

logger = logging.getLogger(__name__)


def hex_to_rgba(hex_color: str) -> list[int]:
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = int(hex_color[:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
        return [r, g, b, 255]
    return [180, 196, 222, 255]


class ColorManager:

    def apply_color_to_mesh(
        self,
        mesh: trimesh.Trimesh,
        color: str,
    ) -> trimesh.Trimesh:
        rgba = hex_to_rgba(color)
        colors = np.tile(rgba, (len(mesh.faces), 1)).astype(np.uint8)
        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=colors)
        logger.info(f"Color {color} applied to all {len(mesh.faces)} faces")
        return mesh

    def apply_color_to_component(
        self,
        mesh: trimesh.Trimesh,
        component_name: str,
        color: str,
    ) -> trimesh.Trimesh:
        rgba = hex_to_rgba(color)

        try:
            components = mesh.split(only_watertight=False)
        except Exception:
            return self.apply_color_to_mesh(mesh, color)

        if not hasattr(mesh.visual, 'face_colors') or mesh.visual.face_colors is None:
            default_colors = np.tile([180, 196, 222, 255], (len(mesh.faces), 1)).astype(np.uint8)
            mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=default_colors)

        face_colors = np.array(mesh.visual.face_colors).copy()

        comp_lower = component_name.lower()
        face_offset = 0
        colored = False

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

            should_color = (
                comp_lower in comp_type or
                comp_type in comp_lower or
                comp_lower in f'{comp_type}_{i + 1}' or
                comp_lower == 'todo' or
                comp_lower == 'all'
            )

            if should_color:
                face_colors[face_offset:face_offset + len(comp.faces)] = rgba
                colored = True

            face_offset += len(comp.faces)

        if not colored:
            return self.apply_color_to_mesh(mesh, color)

        mesh.visual = trimesh.visual.ColorVisuals(mesh=mesh, face_colors=face_colors)
        logger.info(f"Color {color} applied to '{component_name}' components")
        return mesh

    def export_with_colors(
        self,
        mesh: trimesh.Trimesh,
        output_path: str,
        format: str = 'glb',
    ) -> str:
        mesh.export(output_path, file_type=format)
        return output_path
