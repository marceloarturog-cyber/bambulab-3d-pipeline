from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client: Optional[str] = None
    location: Optional[str] = None
    project_type: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    client: Optional[str]
    location: Optional[str]
    project_type: Optional[str]
    created_at: datetime
    model_count: int = 0

    class Config:
        from_attributes = True


class Model3DResponse(BaseModel):
    id: int
    project_id: int
    filename: str
    original_format: str
    file_size_mb: Optional[float]
    vertices: Optional[int]
    faces: Optional[int]
    dimensions_x: Optional[float]
    dimensions_y: Optional[float]
    dimensions_z: Optional[float]
    is_manifold: Optional[bool]
    source_units: str
    uploaded_at: datetime

    class Config:
        from_attributes = True


class ConversionRequest(BaseModel):
    scale: Optional[str] = "1:100"
    scale_factor: Optional[float] = None
    units: str = "mm"
    printer: str = "X1C"
    profile: str = "maqueta_detalle"
    auto_fix: bool = True
    orient: bool = True


class ConversionResponse(BaseModel):
    id: int
    model_id: int
    scale: Optional[str]
    printer: str
    profile: str
    status: str
    output_size_mb: Optional[float]
    result_vertices: Optional[int]
    result_faces: Optional[int]
    result_dimensions_x: Optional[float]
    result_dimensions_y: Optional[float]
    result_dimensions_z: Optional[float]
    result_is_manifold: Optional[bool]
    fits_printer: Optional[bool]
    pieces_count: int
    estimated_time_h: Optional[float]
    estimated_weight_g: Optional[float]
    estimated_filament_m: Optional[float]
    auto_repaired: bool
    repairs_applied: Optional[list]
    config_json: Optional[dict]
    validation_report: Optional[dict]
    error_message: Optional[str]
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class PipelineStatusResponse(BaseModel):
    supported_formats: list[str]
    available_scales: list[str]
    available_printers: list[str]
    available_profiles: dict
