import { useStore } from '../store/useStore';
import { Box, Layers, Ruler, CheckCircle, AlertTriangle } from 'lucide-react';

export default function ModelInfo() {
  const currentModel = useStore((s) => s.currentModel);
  const measurements = useStore((s) => s.measurements);
  const clearMeasurements = useStore((s) => s.clearMeasurements);

  if (!currentModel) {
    return (
      <div className="model-info-panel">
        <div className="empty-msg" style={{ padding: 24 }}>
          <Box size={32} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
          <p>Selecciona un modelo para ver su información</p>
        </div>
      </div>
    );
  }

  const m = currentModel;

  return (
    <div className="model-info-panel">
      <h3>{m.filename}</h3>

      <div className="info-section">
        <h4><Layers size={14} /> Geometría</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">Vértices</span>
            <span className="value">{m.vertices?.toLocaleString() ?? '—'}</span>
          </div>
          <div className="info-item">
            <span className="label">Caras</span>
            <span className="value">{m.faces?.toLocaleString() ?? '—'}</span>
          </div>
          <div className="info-item">
            <span className="label">Formato</span>
            <span className="value">{m.original_format.toUpperCase()}</span>
          </div>
          <div className="info-item">
            <span className="label">Tamaño</span>
            <span className="value">{m.file_size_mb?.toFixed(2)} MB</span>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h4><Ruler size={14} /> Dimensiones</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">X (ancho)</span>
            <span className="value">{m.dimensions_x?.toFixed(2) ?? '—'} {m.source_units}</span>
          </div>
          <div className="info-item">
            <span className="label">Y (largo)</span>
            <span className="value">{m.dimensions_y?.toFixed(2) ?? '—'} {m.source_units}</span>
          </div>
          <div className="info-item">
            <span className="label">Z (alto)</span>
            <span className="value">{m.dimensions_z?.toFixed(2) ?? '—'} {m.source_units}</span>
          </div>
        </div>
      </div>

      <div className="info-section">
        <h4>
          {m.is_manifold ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
          {' '}Estado
        </h4>
        <div className={`status-badge ${m.is_manifold ? 'ok' : 'warn'}`}>
          {m.is_manifold ? 'Sólido (Manifold)' : 'No Manifold — requiere reparación'}
        </div>
      </div>

      {measurements.length > 0 && (
        <div className="info-section">
          <h4>
            <Ruler size={14} /> Mediciones
            <button className="btn-text" onClick={clearMeasurements}>Limpiar</button>
          </h4>
          <div className="measurements-list">
            {measurements.map((meas, i) => (
              <div key={meas.id} className="measurement-item">
                <span>#{i + 1}</span>
                <span className="value">{meas.distance.toFixed(2)} mm</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
