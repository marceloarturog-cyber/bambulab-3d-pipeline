from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Text, Float, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    client = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)
    project_type = Column(String(100), nullable=True)  # residencial, comercial, mixto
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    models = relationship("Model3D", back_populates="project", cascade="all, delete-orphan")


class Model3D(Base):
    __tablename__ = "models_3d"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    original_format = Column(String(20), nullable=False)  # obj, dae, stl, etc.
    file_path = Column(String(500), nullable=False)
    file_size_mb = Column(Float, nullable=True)
    vertices = Column(Integer, nullable=True)
    faces = Column(Integer, nullable=True)
    dimensions_x = Column(Float, nullable=True)
    dimensions_y = Column(Float, nullable=True)
    dimensions_z = Column(Float, nullable=True)
    is_manifold = Column(Boolean, nullable=True)
    source_units = Column(String(10), default="mm")
    notes = Column(Text, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    project = relationship("Project", back_populates="models")
    conversions = relationship("Conversion", back_populates="model", cascade="all, delete-orphan")


class Conversion(Base):
    __tablename__ = "conversions"

    id = Column(Integer, primary_key=True, index=True)
    model_id = Column(Integer, ForeignKey("models_3d.id"), nullable=False)
    scale = Column(String(20), nullable=True)  # 1:100, 1:200, etc.
    scale_factor = Column(Float, nullable=True)
    printer = Column(String(50), default="X1C")
    profile = Column(String(50), default="maqueta_detalle")
    status = Column(String(20), default="pending")  # pending, processing, completed, failed
    output_path = Column(String(500), nullable=True)
    output_size_mb = Column(Float, nullable=True)

    result_vertices = Column(Integer, nullable=True)
    result_faces = Column(Integer, nullable=True)
    result_dimensions_x = Column(Float, nullable=True)
    result_dimensions_y = Column(Float, nullable=True)
    result_dimensions_z = Column(Float, nullable=True)
    result_is_manifold = Column(Boolean, nullable=True)
    fits_printer = Column(Boolean, nullable=True)
    pieces_count = Column(Integer, default=1)

    estimated_time_h = Column(Float, nullable=True)
    estimated_weight_g = Column(Float, nullable=True)
    estimated_filament_m = Column(Float, nullable=True)

    config_json = Column(JSON, nullable=True)
    validation_report = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)

    auto_repaired = Column(Boolean, default=False)
    repairs_applied = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    model = relationship("Model3D", back_populates="conversions")
