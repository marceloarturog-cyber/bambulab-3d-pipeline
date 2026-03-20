import { useEffect } from 'react';
import { FolderOpen, Info, MessageSquare, Download } from 'lucide-react';
import Viewer3D from './components/Viewer3D';
import ProjectManager from './components/ProjectManager';
import ModelInfo from './components/ModelInfo';
import ChatPanel from './components/ChatPanel';
import ExportPanel from './components/ExportPanel';
import Toolbar from './components/Toolbar';
import ColorPickerPanel from './components/ColorPicker';
import { useStore } from './store/useStore';
import { api } from './services/api';
import './App.css';

function App() {
  const sidebarTab = useStore((s) => s.sidebarTab);
  const setSidebarTab = useStore((s) => s.setSidebarTab);
  const setPipelineStatus = useStore((s) => s.setPipelineStatus);
  const activeTool = useStore((s) => s.activeTool);

  useEffect(() => {
    api.getStatus().then(setPipelineStatus).catch(console.error);
  }, [setPipelineStatus]);

  const tabs = [
    { id: 'projects' as const, icon: FolderOpen, label: 'Proyectos' },
    { id: 'info' as const, icon: Info, label: 'Info' },
    { id: 'chat' as const, icon: MessageSquare, label: 'AI' },
    { id: 'export' as const, icon: Download, label: 'Exportar' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          <span>BambuLab 3D Studio</span>
        </div>
        <Toolbar />
      </header>

      <div className="app-body">
        <aside className="sidebar">
          <nav className="sidebar-tabs">
            {tabs.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                className={`tab-btn ${sidebarTab === id ? 'active' : ''}`}
                onClick={() => setSidebarTab(id)}
                title={label}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          <div className="sidebar-content">
            {sidebarTab === 'projects' && <ProjectManager />}
            {sidebarTab === 'info' && <ModelInfo />}
            {sidebarTab === 'chat' && <ChatPanel />}
            {sidebarTab === 'export' && <ExportPanel />}
          </div>
        </aside>

        <main className="viewer-container">
          <Viewer3D />
          {activeTool === 'color' && (
            <div className="floating-panel">
              <ColorPickerPanel />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
