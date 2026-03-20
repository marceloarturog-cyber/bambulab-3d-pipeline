"""
Ejecutor seguro de modificaciones 3D generadas por AI.
Ejecuta código Python (trimesh) en un contexto controlado.
"""

import logging
import copy
from typing import Optional
from dataclasses import dataclass

import trimesh
import numpy as np

logger = logging.getLogger(__name__)

FORBIDDEN_KEYWORDS = [
    'import os', 'import sys', 'import subprocess', 'import shutil',
    '__import__', 'eval(', 'exec(', 'compile(',
    'open(', 'file(', 'input(',
    'os.system', 'os.popen', 'os.exec',
    'subprocess', 'shutil',
    'globals(', 'locals(',
    'delattr', 'setattr',
    '__builtins__',
]


@dataclass
class ModificationResult:
    success: bool
    description: str
    mesh: Optional[trimesh.Trimesh] = None
    error: Optional[str] = None
    vertices_before: int = 0
    vertices_after: int = 0
    faces_before: int = 0
    faces_after: int = 0


class MeshModifier:

    def validate_code(self, code: str) -> tuple[bool, str]:
        for keyword in FORBIDDEN_KEYWORDS:
            if keyword in code:
                return False, f"Código bloqueado: contiene '{keyword}'"

        if len(code) > 5000:
            return False, "Código demasiado largo (>5000 chars)"

        return True, "OK"

    def execute_modification(
        self,
        mesh: trimesh.Trimesh,
        code: str,
        description: str = "",
    ) -> ModificationResult:
        is_safe, reason = self.validate_code(code)
        if not is_safe:
            return ModificationResult(
                success=False,
                description=description,
                error=f"Código rechazado: {reason}",
            )

        backup = copy.deepcopy(mesh)
        verts_before = len(mesh.vertices)
        faces_before = len(mesh.faces)

        safe_globals = {
            '__builtins__': {
                'range': range,
                'len': len,
                'int': int,
                'float': float,
                'str': str,
                'list': list,
                'tuple': tuple,
                'dict': dict,
                'bool': bool,
                'abs': abs,
                'min': min,
                'max': max,
                'sum': sum,
                'round': round,
                'enumerate': enumerate,
                'zip': zip,
                'map': map,
                'filter': filter,
                'sorted': sorted,
                'print': lambda *a, **k: None,
                'True': True,
                'False': False,
                'None': None,
            },
            'np': np,
            'trimesh': trimesh,
            'mesh': mesh,
            'THREE': trimesh.transformations,
        }

        try:
            exec(code, safe_globals)

            result_mesh = safe_globals.get('mesh', mesh)
            if not isinstance(result_mesh, trimesh.Trimesh):
                return ModificationResult(
                    success=False,
                    description=description,
                    mesh=backup,
                    error="El código no produjo un mesh válido",
                )

            return ModificationResult(
                success=True,
                description=description,
                mesh=result_mesh,
                vertices_before=verts_before,
                vertices_after=len(result_mesh.vertices),
                faces_before=faces_before,
                faces_after=len(result_mesh.faces),
            )

        except Exception as e:
            logger.error(f"Modification execution error: {e}")
            return ModificationResult(
                success=False,
                description=description,
                mesh=backup,
                error=f"Error al ejecutar modificación: {str(e)}",
            )
