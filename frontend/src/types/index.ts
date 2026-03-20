export interface Project {
  id: number;
  name: string;
  description?: string;
  client?: string;
  location?: string;
  project_type?: string;
  created_at: string;
  model_count: number;
}

export interface Model3D {
  id: number;
  project_id: number;
  filename: string;
  original_format: string;
  file_size_mb?: number;
  vertices?: number;
  faces?: number;
  dimensions_x?: number;
  dimensions_y?: number;
  dimensions_z?: number;
  is_manifold?: boolean;
  source_units: string;
  uploaded_at: string;
}

export interface Conversion {
  id: number;
  model_id: number;
  scale?: string;
  printer: string;
  profile: string;
  status: string;
  output_size_mb?: number;
  result_vertices?: number;
  result_faces?: number;
  result_dimensions_x?: number;
  result_dimensions_y?: number;
  result_dimensions_z?: number;
  result_is_manifold?: boolean;
  fits_printer?: boolean;
  pieces_count: number;
  estimated_time_h?: number;
  estimated_weight_g?: number;
  estimated_filament_m?: number;
  auto_repaired: boolean;
  repairs_applied?: string[];
  config_json?: Record<string, unknown>;
  validation_report?: {
    is_valid: boolean;
    issues: string[];
    warnings: string[];
  };
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface PipelineStatus {
  supported_formats: string[];
  available_scales: string[];
  available_printers: string[];
  available_profiles: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modification?: {
    success: boolean;
    description: string;
  };
}

export interface MeasurementPoint {
  x: number;
  y: number;
  z: number;
}

export interface Measurement {
  id: string;
  point_a: MeasurementPoint;
  point_b: MeasurementPoint;
  distance: number;
}

export interface ComponentColor {
  component_id: string;
  component_name: string;
  color: string;
}
