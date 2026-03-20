import { MousePointer, Ruler, Palette } from 'lucide-react';
import { useStore } from '../store/useStore';

export default function Toolbar() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);

  const tools = [
    { id: 'select' as const, icon: MousePointer, label: 'Seleccionar' },
    { id: 'measure' as const, icon: Ruler, label: 'Medir' },
    { id: 'color' as const, icon: Palette, label: 'Color' },
  ];

  return (
    <div className="toolbar">
      {tools.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          className={`toolbar-btn ${activeTool === id ? 'active' : ''}`}
          onClick={() => setActiveTool(id)}
          title={label}
        >
          <Icon size={18} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
