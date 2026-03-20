import { useState } from 'react';
import { HexColorPicker } from 'react-colorful';
import { Paintbrush, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';

const PRESET_COLORS = [
  { name: 'Blanco', hex: '#ffffff' },
  { name: 'Gris claro', hex: '#d4d4d4' },
  { name: 'Gris', hex: '#808080' },
  { name: 'Negro', hex: '#2a2a2a' },
  { name: 'Beige', hex: '#f5f0e1' },
  { name: 'Terracota', hex: '#c4724e' },
  { name: 'Ladrillo', hex: '#9c4a3b' },
  { name: 'Concreto', hex: '#b0b0a8' },
  { name: 'Madera clara', hex: '#c9a96e' },
  { name: 'Madera oscura', hex: '#6b4423' },
  { name: 'Azul acero', hex: '#4682b4' },
  { name: 'Verde', hex: '#5a8a5a' },
];

export default function ColorPickerPanel() {
  const [selectedColor, setSelectedColor] = useState('#b0c4de');
  const [componentName, setComponentName] = useState('');
  const [applying, setApplying] = useState(false);
  const currentModel = useStore((s) => s.currentModel);
  const bumpMeshVersion = useStore((s) => s.bumpMeshVersion);

  const handleApply = async () => {
    if (!currentModel || !componentName.trim()) return;
    setApplying(true);
    try {
      await api.setColor(currentModel.id, componentName, selectedColor);
      bumpMeshVersion();
    } catch (err) {
      console.error(err);
    } finally {
      setApplying(false);
    }
  };

  if (!currentModel) {
    return (
      <div className="color-picker-panel">
        <div className="empty-msg" style={{ padding: 24 }}>
          <Paintbrush size={32} strokeWidth={1.5} style={{ opacity: 0.5, marginBottom: 8 }} />
          <p>Selecciona un modelo para asignar colores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="color-picker-panel">
      <h4>Asignar color</h4>

      <div className="form-group">
        <label>Componente</label>
        <input
          type="text"
          value={componentName}
          onChange={(e) => setComponentName(e.target.value)}
          placeholder="Ej: fachada, columnas, techo..."
        />
      </div>

      <HexColorPicker color={selectedColor} onChange={setSelectedColor} style={{ width: '100%' }} />

      <div className="color-presets">
        {PRESET_COLORS.map((c) => (
          <button
            key={c.hex}
            className={`color-swatch ${selectedColor === c.hex ? 'active' : ''}`}
            style={{ backgroundColor: c.hex }}
            onClick={() => setSelectedColor(c.hex)}
            title={c.name}
          />
        ))}
      </div>

      <div className="selected-color">
        <div className="color-preview" style={{ backgroundColor: selectedColor }} />
        <span>{selectedColor}</span>
      </div>

      <button
        className="btn-primary btn-full"
        onClick={handleApply}
        disabled={applying || !componentName.trim()}
      >
        {applying ? <Loader2 size={16} className="spin" /> : <Paintbrush size={16} />}
        Aplicar color
      </button>
    </div>
  );
}
