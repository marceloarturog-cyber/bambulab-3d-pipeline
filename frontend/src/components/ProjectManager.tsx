import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { FolderPlus, Upload, Trash2, ChevronRight, FileBox, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';

export default function ProjectManager() {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const projects = useStore((s) => s.projects);
  const setProjects = useStore((s) => s.setProjects);
  const currentProject = useStore((s) => s.currentProject);
  const setCurrentProject = useStore((s) => s.setCurrentProject);
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const currentModel = useStore((s) => s.currentModel);
  const setCurrentModel = useStore((s) => s.setCurrentModel);
  const setSidebarTab = useStore((s) => s.setSidebarTab);

  useEffect(() => {
    api.listProjects().then(setProjects).catch(console.error);
  }, [setProjects]);

  useEffect(() => {
    if (currentProject) {
      api.listModels(currentProject.id).then(setModels).catch(console.error);
    }
  }, [currentProject, setModels]);

  const handleCreateProject = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const proj = await api.createProject({ name: newName.trim() });
      setProjects([proj, ...projects]);
      setCurrentProject(proj);
      setNewName('');
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (id: number) => {
    if (!confirm('¿Eliminar este proyecto?')) return;
    try {
      await api.deleteProject(id);
      setProjects(projects.filter((p) => p.id !== id));
      if (currentProject?.id === id) {
        setCurrentProject(null);
        setCurrentModel(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const onDrop = useCallback(async (files: File[]) => {
    if (!currentProject || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const model = await api.uploadModel(currentProject.id, file);
        const updated = await api.listModels(currentProject.id);
        setModels(updated);
        setCurrentModel(model);
        setSidebarTab('info');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }, [currentProject, setModels, setCurrentModel, setSidebarTab]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'model/stl': ['.stl'],
      'model/obj': ['.obj'],
      'model/vnd.collada+xml': ['.dae'],
      'application/octet-stream': ['.3ds', '.3mf', '.ply', '.glb', '.gltf'],
    },
    disabled: !currentProject,
  });

  return (
    <div className="project-manager">
      <div className="section">
        <h3>Proyectos</h3>
        <div className="input-row">
          <input
            type="text"
            placeholder="Nombre del proyecto..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
          />
          <button onClick={handleCreateProject} disabled={creating || !newName.trim()} className="btn-primary">
            <FolderPlus size={16} />
          </button>
        </div>

        <div className="project-list">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`project-item ${currentProject?.id === p.id ? 'active' : ''}`}
              onClick={() => setCurrentProject(p)}
            >
              <ChevronRight size={14} />
              <span className="project-name">{p.name}</span>
              <span className="project-count">{p.model_count}</span>
              <button className="btn-icon" onClick={(e) => { e.stopPropagation(); handleDeleteProject(p.id); }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
          {projects.length === 0 && <p className="empty-msg">Sin proyectos. Crea uno para empezar.</p>}
        </div>
      </div>

      {currentProject && (
        <div className="section">
          <h3>Modelos — {currentProject.name}</h3>
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            {uploading ? (
              <><Loader2 size={24} className="spin" /><p>Subiendo...</p></>
            ) : isDragActive ? (
              <><Upload size={24} /><p>Suelta aquí</p></>
            ) : (
              <><Upload size={24} /><p>Arrastra archivos o haz clic</p><p className="small">STL, OBJ, DAE, 3MF, PLY, GLB</p></>
            )}
          </div>

          <div className="model-list">
            {models.map((m) => (
              <div
                key={m.id}
                className={`model-item ${currentModel?.id === m.id ? 'active' : ''}`}
                onClick={() => { setCurrentModel(m); setSidebarTab('info'); }}
              >
                <FileBox size={16} />
                <div className="model-info">
                  <span className="model-name">{m.filename}</span>
                  <span className="model-meta">
                    {m.file_size_mb?.toFixed(1)} MB · {m.faces?.toLocaleString()} caras
                    {m.is_manifold === false && <span className="badge-warn"> No manifold</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
