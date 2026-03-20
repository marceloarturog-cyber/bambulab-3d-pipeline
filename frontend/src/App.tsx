import { useEffect, useState } from 'react';
import { Upload, Loader2, Ruler, Download, Send, Bot, User, Trash2, MousePointer } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Viewer3D from './components/Viewer3D';
import { useStore } from './store/useStore';
import { api } from './services/api';
import type { ChatMessage, Conversion } from './types';
import './App.css';

function App() {
  const currentModel = useStore((s) => s.currentModel);
  const setCurrentModel = useStore((s) => s.setCurrentModel);
  const setPipelineStatus = useStore((s) => s.setPipelineStatus);
  const pipelineStatus = useStore((s) => s.pipelineStatus);
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);
  const measurements = useStore((s) => s.measurements);
  const clearMeasurements = useStore((s) => s.clearMeasurements);
  const bumpMeshVersion = useStore((s) => s.bumpMeshVersion);

  const [uploading, setUploading] = useState(false);
  const [projectId, setProjectId] = useState<number | null>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const messages = useStore((s) => s.chatMessages);
  const addMessage = useStore((s) => s.addChatMessage);
  const clearChat = useStore((s) => s.clearChat);

  const [scale, setScale] = useState('1:100');
  const [printer, setPrinter] = useState('X1C');
  const [profile, setProfile] = useState('maqueta_detalle');
  const [converting, setConverting] = useState(false);
  const [lastConversion, setLastConversion] = useState<Conversion | null>(null);

  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    api.getStatus().then(setPipelineStatus).catch(console.error);
    api.listProjects().then((projects) => {
      if (projects.length > 0) {
        setProjectId(projects[0].id);
      } else {
        api.createProject({ name: 'Mi Proyecto' }).then((p) => setProjectId(p.id));
      }
    }).catch(console.error);
  }, [setPipelineStatus]);

  const onDrop = async (files: File[]) => {
    if (!projectId || files.length === 0) return;
    setUploading(true);
    try {
      const model = await api.uploadModel(projectId, files[0]);
      setCurrentModel(model);
      clearChat();
      clearMeasurements();
      setLastConversion(null);
      setShowExport(false);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/stl': ['.stl'],
      'model/obj': ['.obj'],
      'model/vnd.collada+xml': ['.dae'],
      'application/octet-stream': ['.3ds', '.3mf', '.ply', '.glb', '.gltf'],
    },
    noClick: !!currentModel,
    noKeyboard: !!currentModel,
  });

  const handleSendChat = async () => {
    if (!chatInput.trim() || !currentModel || chatSending) return;
    const text = chatInput.trim();
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date().toISOString() };
    addMessage(userMsg);
    setChatInput('');
    setChatSending(true);
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chatAI(currentModel.id, text, history);
      addMessage({
        id: crypto.randomUUID(), role: 'assistant', content: res.response,
        timestamp: new Date().toISOString(), modification: res.modification,
      });
      if (res.mesh_updated) bumpMeshVersion();
    } catch (err) {
      addMessage({ id: crypto.randomUUID(), role: 'assistant', content: `Error: ${err instanceof Error ? err.message : 'Conexión fallida'}`, timestamp: new Date().toISOString() });
    } finally {
      setChatSending(false);
    }
  };

  const handleExport = async () => {
    if (!currentModel) return;
    setConverting(true);
    try {
      const conv = await api.convertModel(currentModel.id, { scale, printer, profile });
      setLastConversion(conv);
    } catch (err) {
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="app">
      {/* Top Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
          </svg>
          <span className="brand">BambuLab 3D Studio</span>
        </div>

        {currentModel && (
          <div className="topbar-tools">
            <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setActiveTool('select')}>
              <MousePointer size={16} /> Seleccionar
            </button>
            <button className={`tool-btn ${activeTool === 'measure' ? 'active' : ''}`} onClick={() => setActiveTool('measure')}>
              <Ruler size={16} /> Medir
            </button>
            <div className="tool-sep" />
            <button className={`tool-btn export-btn ${showExport ? 'active' : ''}`} onClick={() => setShowExport(!showExport)}>
              <Download size={16} /> Exportar para Bambu Lab
            </button>
          </div>
        )}

        {currentModel && (
          <div className="topbar-right">
            <span className="file-badge">{currentModel.filename}</span>
            <button className="tool-btn" onClick={() => {
              setCurrentModel(null); clearChat(); clearMeasurements(); setLastConversion(null); setShowExport(false);
            }}>
              Nuevo archivo
            </button>
          </div>
        )}
      </header>

      <div className="main-area">
        {/* 3D Viewer / Upload */}
        <div className="viewer-area" {...(currentModel ? {} : getRootProps())}>
          {!currentModel ? (
            <div className={`upload-zone ${isDragActive ? 'drag' : ''}`}>
              <input {...getInputProps()} />
              {uploading ? (
                <><Loader2 size={40} className="spin" /><h2>Subiendo modelo...</h2></>
              ) : (
                <>
                  <Upload size={48} strokeWidth={1.5} />
                  <h2>Sube tu modelo 3D</h2>
                  <p>Arrastra aquí o haz clic para seleccionar</p>
                  <p className="formats">STL · OBJ · DAE · 3MF · PLY · GLB</p>
                  <button className="upload-btn" onClick={(e) => { e.stopPropagation(); const el = document.querySelector('input[type="file"]') as HTMLInputElement; el?.click(); }}>
                    Seleccionar archivo
                  </button>
                </>
              )}
            </div>
          ) : (
            <Viewer3D />
          )}

          {/* Export Panel Overlay */}
          {showExport && currentModel && (
            <div className="export-overlay">
              <h3>Exportar para Bambu Lab</h3>
              <div className="export-row">
                <label>Escala</label>
                <select value={scale} onChange={(e) => setScale(e.target.value)}>
                  {pipelineStatus?.available_scales.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="export-row">
                <label>Impresora</label>
                <select value={printer} onChange={(e) => setPrinter(e.target.value)}>
                  {pipelineStatus?.available_printers.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="export-row">
                <label>Calidad</label>
                <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                  {pipelineStatus && Object.entries(pipelineStatus.available_profiles).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <button className="btn-export" onClick={handleExport} disabled={converting}>
                {converting ? <><Loader2 size={16} className="spin" /> Procesando...</> : <><Download size={16} /> Generar STL</>}
              </button>
              {lastConversion?.status === 'completed' && (
                <a href={api.getDownloadUrl(lastConversion.id)} download className="btn-download">
                  <Download size={16} /> Descargar STL ({lastConversion.result_dimensions_x?.toFixed(0)}x{lastConversion.result_dimensions_y?.toFixed(0)}x{lastConversion.result_dimensions_z?.toFixed(0)}mm)
                </a>
              )}
              {lastConversion?.status === 'failed' && (
                <div className="export-error">{lastConversion.error_message}</div>
              )}
            </div>
          )}

          {/* Measurements Display */}
          {measurements.length > 0 && (
            <div className="measurements-overlay">
              {measurements.map((m, i) => (
                <div key={m.id} className="meas-item">#{i + 1}: <strong>{m.distance.toFixed(2)} mm</strong></div>
              ))}
              <button className="meas-clear" onClick={clearMeasurements}>Limpiar</button>
            </div>
          )}
        </div>

        {/* Chat Panel - only when model loaded */}
        {currentModel && (
          <div className="chat-area">
            <div className="chat-header">
              <Bot size={18} /> Asistente AI
              {messages.length > 0 && <button className="chat-clear" onClick={clearChat}><Trash2 size={14} /></button>}
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="chat-welcome">
                  <Bot size={28} strokeWidth={1.5} />
                  <p>Describe qué cambios quieres hacer al modelo</p>
                  <div className="suggestions">
                    {[
                      'Haz las columnas de 30cm de diámetro',
                      '¿Cuáles son las dimensiones del modelo?',
                      'Escala el modelo un 50% más grande',
                      'Rota el modelo 90 grados en Z',
                    ].map((s) => (
                      <button key={s} onClick={() => setChatInput(s)}>{s}</button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div key={msg.id} className={`msg msg-${msg.role}`}>
                  <div className="msg-icon">{msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}</div>
                  <div className="msg-body">
                    <p>{msg.content}</p>
                    {msg.modification && (
                      <div className={`msg-mod ${msg.modification.success ? 'ok' : 'err'}`}>
                        {msg.modification.success ? '✓' : '✗'} {msg.modification.description}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {chatSending && (
                <div className="msg msg-assistant">
                  <div className="msg-icon"><Bot size={14} /></div>
                  <div className="msg-body"><Loader2 size={14} className="spin" /> Procesando...</div>
                </div>
              )}
            </div>

            <div className="chat-input">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Ej: Haz las columnas más gruesas..."
                disabled={chatSending}
              />
              <button onClick={handleSendChat} disabled={chatSending || !chatInput.trim()} className="send-btn">
                <Send size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
