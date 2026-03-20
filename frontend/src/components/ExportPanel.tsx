import { useState } from 'react';
import { Download, Printer, Clock, Weight, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { Conversion } from '../types';

export default function ExportPanel() {
  const currentModel = useStore((s) => s.currentModel);
  const pipelineStatus = useStore((s) => s.pipelineStatus);
  const conversions = useStore((s) => s.conversions);
  const setConversions = useStore((s) => s.setConversions);

  const [scale, setScale] = useState('1:100');
  const [printer, setPrinter] = useState('X1C');
  const [profile, setProfile] = useState('maqueta_detalle');
  const [converting, setConverting] = useState(false);

  const handleConvert = async () => {
    if (!currentModel) return;
    setConverting(true);
    try {
      const conv = await api.convertModel(currentModel.id, { scale, printer, profile });
      setConversions([conv, ...conversions]);
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  if (!currentModel) {
    return (
      <div className="export-panel">
        <div className="empty-msg" style={{ padding: 24 }}>
          <Printer size={32} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
          <p>Selecciona un modelo para exportar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="export-panel">
      <h3>Exportar para Bambu Lab</h3>

      <div className="export-config">
        <div className="form-group">
          <label>Escala arquitectónica</label>
          <select value={scale} onChange={(e) => setScale(e.target.value)}>
            {pipelineStatus?.available_scales.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Impresora</label>
          <select value={printer} onChange={(e) => setPrinter(e.target.value)}>
            {pipelineStatus?.available_printers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Perfil de impresión</label>
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {pipelineStatus && Object.entries(pipelineStatus.available_profiles).map(([k, v]) => (
              <option key={k} value={k}>{k} — {v}</option>
            ))}
          </select>
        </div>

        <button
          className="btn-primary btn-full"
          onClick={handleConvert}
          disabled={converting}
        >
          {converting ? (
            <><Loader2 size={16} className="spin" /> Procesando...</>
          ) : (
            <><Printer size={16} /> Convertir para Bambu Lab</>
          )}
        </button>
      </div>

      {conversions.length > 0 && (
        <div className="conversion-list">
          <h4>Conversiones</h4>
          {conversions.map((c) => (
            <ConversionCard key={c.id} conversion={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversionCard({ conversion: c }: { conversion: Conversion }) {
  return (
    <div className={`conversion-card status-${c.status}`}>
      <div className="conv-header">
        <span className={`conv-status ${c.status}`}>{c.status === 'completed' ? 'Listo' : c.status === 'failed' ? 'Error' : 'Procesando'}</span>
        <span className="conv-scale">{c.scale} · {c.printer}</span>
      </div>

      {c.status === 'completed' && (
        <>
          <div className="conv-details">
            <div className="conv-detail">
              <Clock size={12} />
              <span>~{c.estimated_time_h}h</span>
            </div>
            <div className="conv-detail">
              <Weight size={12} />
              <span>~{c.estimated_weight_g}g</span>
            </div>
            <div className="conv-detail">
              <span>{c.result_dimensions_x?.toFixed(1)}x{c.result_dimensions_y?.toFixed(1)}x{c.result_dimensions_z?.toFixed(1)} mm</span>
            </div>
          </div>

          {c.fits_printer === false && (
            <div className="conv-warn">El modelo excede el volumen de impresión</div>
          )}
          {c.auto_repaired && (
            <div className="conv-info">Reparaciones automáticas aplicadas</div>
          )}

          <a
            href={api.getDownloadUrl(c.id)}
            download
            className="btn-primary btn-full btn-download"
          >
            <Download size={16} /> Descargar STL
          </a>
        </>
      )}

      {c.status === 'failed' && c.error_message && (
        <div className="conv-error">{c.error_message}</div>
      )}
    </div>
  );
}
