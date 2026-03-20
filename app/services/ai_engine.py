"""
Motor AI con Claude API para interpretar instrucciones de modificación
de modelos 3D arquitectónicos y generar código Python ejecutable.
"""

import os
import json
import logging
from typing import Optional
from dataclasses import dataclass

import anthropic

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Eres un ingeniero industrial especializado en modelos 3D arquitectónicos para impresión en Bambu Lab.

Tu trabajo es interpretar instrucciones del usuario sobre modificaciones a modelos 3D y generar código Python que use la librería trimesh para aplicar esos cambios.

CONTEXTO DEL MODELO:
El usuario trabaja con modelos arquitectónicos (plantas, fachadas, conjuntos habitacionales) exportados desde SketchUp. Los modelos están en formato mesh (triángulos).

CAPACIDADES DISPONIBLES:
1. Escalar componentes (cambiar grosor de columnas, muros, etc.)
2. Trasladar geometría (mover elementos)
3. Aplicar colores a caras (vertex colors)
4. Medir distancias y grosores
5. Subdividir o simplificar meshes
6. Modificar dimensiones de elementos específicos
7. Rotar componentes

FORMATO DE RESPUESTA:
Cuando el usuario pida una modificación, responde con:
1. Una explicación breve de lo que vas a hacer
2. Un bloque de código Python entre ```python y ``` que:
   - Use la variable `mesh` (trimesh.Trimesh) que ya está cargada
   - Realice la modificación solicitada
   - Asigne el resultado a `mesh` (la misma variable)
   - NO importe trimesh (ya está importado)
   - NO cargue ni guarde archivos
   - Use numpy como `np` (ya importado)

Si el usuario pregunta algo informativo (dimensiones, estado del modelo, etc.), responde con la información sin código.

EJEMPLO:
Usuario: "Haz el modelo un 20% más grande"
Respuesta: "Voy a escalar todo el modelo un 20% en todos los ejes.

```python
mesh.apply_scale(1.2)
```

El modelo ahora es 20% más grande en todas sus dimensiones."

EJEMPLO 2:
Usuario: "¿Cuáles son las dimensiones?"
Respuesta: "Las dimensiones del modelo son:
- X (ancho): {dims_x:.2f} mm
- Y (largo): {dims_y:.2f} mm  
- Z (alto): {dims_z:.2f} mm
Volumen total: {volume:.2f} mm³"

REGLAS:
- Siempre responde en español
- Sé conciso pero claro
- Si no puedes hacer algo, explica por qué y sugiere alternativas
- Para cambios de color, usa mesh.visual.face_colors
- Para escalar un eje específico, usa transformaciones matriciales
- Siempre verifica que el código sea seguro y no destructivo
"""


@dataclass
class AIResponse:
    response: str
    code: Optional[str] = None
    modification_description: Optional[str] = None
    success: bool = True


class AIEngine:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if api_key:
            self.client = anthropic.Anthropic(api_key=api_key)
        else:
            self.client = None
            logger.warning("ANTHROPIC_API_KEY not set — AI features disabled")

    def process_instruction(
        self,
        message: str,
        model_context: dict,
        conversation_history: list[dict] = None,
    ) -> AIResponse:
        if not self.client:
            return AIResponse(
                response="AI no disponible. Configura ANTHROPIC_API_KEY.",
                success=False,
            )

        context_str = json.dumps(model_context, indent=2, ensure_ascii=False)
        system = SYSTEM_PROMPT + f"\n\nINFORMACIÓN DEL MODELO ACTUAL:\n{context_str}"

        messages = []
        if conversation_history:
            for h in conversation_history[-10:]:
                messages.append({
                    "role": h["role"],
                    "content": h["content"],
                })

        messages.append({"role": "user", "content": message})

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2048,
                system=system,
                messages=messages,
            )

            text = response.content[0].text
            code = self._extract_code(text)
            description = self._extract_description(text, code)

            return AIResponse(
                response=text,
                code=code,
                modification_description=description,
                success=True,
            )

        except Exception as e:
            logger.error(f"AI error: {e}")
            return AIResponse(
                response=f"Error al comunicarse con AI: {str(e)}",
                success=False,
            )

    def _extract_code(self, text: str) -> Optional[str]:
        if "```python" not in text:
            return None
        try:
            start = text.index("```python") + len("```python")
            end_marker = text.index("```", start)
            code = text[start:end_marker].strip()
            return code if code else None
        except ValueError:
            return None

    def _extract_description(self, text: str, code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        lines = text.split("```python")[0].strip().split("\n")
        desc = " ".join(line.strip() for line in lines if line.strip())
        return desc[:200] if desc else "Modificación aplicada"
