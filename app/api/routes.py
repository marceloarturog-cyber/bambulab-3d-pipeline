import os
import shutil
import io
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.project import Project, Model3D, Conversion
from app.api.schemas import (
    ProjectCreate, ProjectResponse, Model3DResponse,
    ConversionRequest, ConversionResponse, PipelineStatusResponse,
    ChatRequest, ChatResponse, MeasureRequest, ColorRequest, Export3MFRequest,
)
from app.services.mesh_processor import (
    MeshProcessor, SUPPORTED_FORMATS, SCALE_PRESETS,
    BAMBU_PRINTERS, PRINT_PROFILES,
)
from app.services.ai_engine import AIEngine
from app.services.mesh_modifier import MeshModifier
from app.services.measurement_service import MeasurementService
from app.services.color_manager import ColorManager
from app.core.config import settings

router = APIRouter()
processor = MeshProcessor()
ai_engine = AIEngine()
mesh_modifier = MeshModifier()
measurement_service = MeasurementService()
color_manager = ColorManager()

_mesh_cache: dict[int, "import('trimesh').Trimesh"] = {}


# ─── Pipeline Info ───

@router.get("/status", response_model=PipelineStatusResponse)
def get_pipeline_status():
    return PipelineStatusResponse(
        supported_formats=sorted(list(SUPPORTED_FORMATS)),
        available_scales=list(SCALE_PRESETS.keys()),
        available_printers=list(BAMBU_PRINTERS.keys()),
        available_profiles={k: v['description'] for k, v in PRINT_PROFILES.items()},
    )


# ─── Projects ───

@router.post("/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = Project(**project.model_dump())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return ProjectResponse(
        **{c.name: getattr(db_project, c.name) for c in db_project.__table__.columns},
        model_count=0,
    )


@router.get("/projects", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    result = []
    for p in projects:
        count = db.query(Model3D).filter(Model3D.project_id == p.id).count()
        result.append(ProjectResponse(
            **{c.name: getattr(p, c.name) for c in p.__table__.columns},
            model_count=count,
        ))
    return result


@router.get("/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    count = db.query(Model3D).filter(Model3D.project_id == project.id).count()
    return ProjectResponse(
        **{c.name: getattr(project, c.name) for c in project.__table__.columns},
        model_count=count,
    )


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    db.delete(project)
    db.commit()
    return {"message": f"Proyecto '{project.name}' eliminado"}


# ─── Models (Upload) ───

@router.post("/projects/{project_id}/models", response_model=Model3DResponse)
async def upload_model(
    project_id: int,
    file: UploadFile = File(...),
    source_units: str = Form("mm"),
    notes: str = Form(None),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    ext = Path(file.filename).suffix.lower()
    if ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Formato '{ext}' no soportado. Usa: {', '.join(sorted(SUPPORTED_FORMATS))}"
        )

    upload_dir = Path(settings.UPLOAD_DIR) / str(project_id)
    upload_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = f"{timestamp}_{file.filename}"
    file_path = upload_dir / safe_name

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size_mb = file_path.stat().st_size / (1024 * 1024)

    mesh_info = None
    try:
        mesh = processor.load(str(file_path))
        mesh_info = processor.get_info(mesh)
    except Exception:
        pass

    db_model = Model3D(
        project_id=project_id,
        filename=file.filename,
        original_format=ext.lstrip('.'),
        file_path=str(file_path),
        file_size_mb=round(file_size_mb, 2),
        vertices=mesh_info.vertices if mesh_info else None,
        faces=mesh_info.faces if mesh_info else None,
        dimensions_x=mesh_info.dimensions_x if mesh_info else None,
        dimensions_y=mesh_info.dimensions_y if mesh_info else None,
        dimensions_z=mesh_info.dimensions_z if mesh_info else None,
        is_manifold=mesh_info.is_manifold if mesh_info else None,
        source_units=source_units,
        notes=notes,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model


@router.get("/projects/{project_id}/models", response_model=list[Model3DResponse])
def list_models(project_id: int, db: Session = Depends(get_db)):
    models = db.query(Model3D).filter(Model3D.project_id == project_id).order_by(Model3D.uploaded_at.desc()).all()
    return models


# ─── Conversions (Pipeline) ───

@router.post("/models/{model_id}/convert", response_model=ConversionResponse)
def convert_model(model_id: int, req: ConversionRequest, db: Session = Depends(get_db)):
    model = db.query(Model3D).filter(Model3D.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")

    if not Path(model.file_path).exists():
        raise HTTPException(status_code=404, detail="Archivo del modelo no encontrado en disco")

    conversion = Conversion(
        model_id=model_id,
        scale=req.scale,
        scale_factor=req.scale_factor,
        printer=req.printer,
        profile=req.profile,
        status="processing",
    )
    db.add(conversion)
    db.commit()
    db.refresh(conversion)

    output_dir = Path(settings.OUTPUT_DIR) / str(model.project_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    result = processor.run_pipeline(
        input_path=model.file_path,
        output_dir=str(output_dir),
        scale=req.scale,
        scale_factor=req.scale_factor,
        units=model.source_units,
        printer=req.printer,
        profile=req.profile,
        auto_fix=req.auto_fix,
        orient=req.orient,
    )

    if result.success:
        conversion.status = "completed"
        conversion.output_path = result.output_path
        conversion.output_size_mb = round(result.output_size_mb, 2)
        conversion.result_vertices = result.mesh_info.vertices
        conversion.result_faces = result.mesh_info.faces
        conversion.result_dimensions_x = result.mesh_info.dimensions_x
        conversion.result_dimensions_y = result.mesh_info.dimensions_y
        conversion.result_dimensions_z = result.mesh_info.dimensions_z
        conversion.result_is_manifold = result.mesh_info.is_manifold
        conversion.fits_printer = result.fits_printer
        conversion.pieces_count = result.pieces_count
        conversion.estimated_time_h = result.estimate.time_h
        conversion.estimated_weight_g = result.estimate.weight_g
        conversion.estimated_filament_m = result.estimate.filament_m
        conversion.config_json = result.config
        conversion.validation_report = {
            'is_valid': result.validation.is_valid,
            'issues': result.validation.issues,
            'warnings': result.validation.warnings,
        }
        if result.repair:
            conversion.auto_repaired = bool(result.repair.repairs_applied)
            conversion.repairs_applied = result.repair.repairs_applied
        conversion.completed_at = datetime.utcnow()
    else:
        conversion.status = "failed"
        conversion.error_message = result.error

    db.commit()
    db.refresh(conversion)
    return conversion


@router.get("/models/{model_id}/conversions", response_model=list[ConversionResponse])
def list_conversions(model_id: int, db: Session = Depends(get_db)):
    conversions = db.query(Conversion).filter(
        Conversion.model_id == model_id
    ).order_by(Conversion.created_at.desc()).all()
    return conversions


@router.get("/conversions/{conversion_id}/download")
def download_stl(conversion_id: int, db: Session = Depends(get_db)):
    conversion = db.query(Conversion).filter(Conversion.id == conversion_id).first()
    if not conversion:
        raise HTTPException(status_code=404, detail="Conversión no encontrada")
    if conversion.status != "completed" or not conversion.output_path:
        raise HTTPException(status_code=400, detail="Conversión no completada")
    if not Path(conversion.output_path).exists():
        raise HTTPException(status_code=404, detail="Archivo STL no encontrado")

    return FileResponse(
        conversion.output_path,
        media_type="application/octet-stream",
        filename=Path(conversion.output_path).name,
    )


# ─── Mesh Data (for 3D viewer) ───

def _load_mesh(model_id: int, db: Session) -> "import('trimesh').Trimesh":
    if model_id in _mesh_cache:
        return _mesh_cache[model_id]
    model = db.query(Model3D).filter(Model3D.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    if not Path(model.file_path).exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado en disco")
    mesh = processor.load(model.file_path)
    _mesh_cache[model_id] = mesh
    return mesh


@router.get("/models/{model_id}/mesh-data")
def get_mesh_data(model_id: int, db: Session = Depends(get_db)):
    model = db.query(Model3D).filter(Model3D.id == model_id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Modelo no encontrado")
    if not Path(model.file_path).exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    mesh = _load_mesh(model_id, db)

    buffer = io.BytesIO()
    mesh.export(buffer, file_type='glb')
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="model/gltf-binary",
        headers={"Content-Disposition": f"inline; filename={model.filename}.glb"},
    )


# ─── AI Chat ───

@router.post("/ai/chat", response_model=ChatResponse)
def ai_chat(req: ChatRequest, db: Session = Depends(get_db)):
    mesh = _load_mesh(req.model_id, db)
    info = processor.get_info(mesh)

    model_context = {
        "vertices": info.vertices,
        "faces": info.faces,
        "dimensions_mm": {
            "x": info.dimensions_x,
            "y": info.dimensions_y,
            "z": info.dimensions_z,
        },
        "volume_mm3": info.volume,
        "is_manifold": info.is_manifold,
    }

    ai_response = ai_engine.process_instruction(
        message=req.message,
        model_context=model_context,
        conversation_history=req.history,
    )

    mesh_updated = False
    modification = None

    if ai_response.code:
        result = mesh_modifier.execute_modification(
            mesh=mesh,
            code=ai_response.code,
            description=ai_response.modification_description or "",
        )

        if result.success and result.mesh:
            _mesh_cache[req.model_id] = result.mesh

            db_model = db.query(Model3D).filter(Model3D.id == req.model_id).first()
            if db_model:
                new_info = processor.get_info(result.mesh)
                db_model.vertices = new_info.vertices
                db_model.faces = new_info.faces
                db_model.dimensions_x = new_info.dimensions_x
                db_model.dimensions_y = new_info.dimensions_y
                db_model.dimensions_z = new_info.dimensions_z
                db_model.is_manifold = new_info.is_manifold
                db.commit()

            mesh_updated = True
            modification = {
                "success": True,
                "description": result.description,
            }
        else:
            modification = {
                "success": False,
                "description": result.error or "Error desconocido",
            }

    return ChatResponse(
        response=ai_response.response,
        modification=modification,
        mesh_updated=mesh_updated,
    )


# ─── Measurements ───

@router.post("/models/{model_id}/measure")
def measure_model(model_id: int, req: MeasureRequest, db: Session = Depends(get_db)):
    mesh = _load_mesh(model_id, db)
    result = measurement_service.measure_distance(mesh, req.point_a, req.point_b)
    return result


@router.get("/models/{model_id}/components")
def get_components(model_id: int, db: Session = Depends(get_db)):
    mesh = _load_mesh(model_id, db)
    return measurement_service.detect_components(mesh)


@router.get("/models/{model_id}/thickness")
def get_thickness(model_id: int, db: Session = Depends(get_db)):
    mesh = _load_mesh(model_id, db)
    return measurement_service.analyze_thickness(mesh)


# ─── Colors ───

@router.post("/models/{model_id}/color")
def set_model_color(model_id: int, req: ColorRequest, db: Session = Depends(get_db)):
    mesh = _load_mesh(model_id, db)
    updated = color_manager.apply_color_to_component(mesh, req.component_name, req.color)
    _mesh_cache[model_id] = updated
    return {"success": True}


# ─── Export 3MF ───

@router.post("/models/{model_id}/export/3mf")
def export_3mf(model_id: int, req: Export3MFRequest, db: Session = Depends(get_db)):
    mesh = _load_mesh(model_id, db)
    model = db.query(Model3D).filter(Model3D.id == model_id).first()

    output_dir = Path(settings.OUTPUT_DIR) / str(model.project_id)
    output_dir.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"{Path(model.filename).stem}_{timestamp}.3mf"

    mesh.export(str(output_path), file_type='3mf')

    return FileResponse(
        str(output_path),
        media_type="application/octet-stream",
        filename=output_path.name,
    )
