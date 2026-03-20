import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User, Trash2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { api } from '../services/api';
import type { ChatMessage } from '../types';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messages = useStore((s) => s.chatMessages);
  const addMessage = useStore((s) => s.addChatMessage);
  const clearChat = useStore((s) => s.clearChat);
  const currentModel = useStore((s) => s.currentModel);
  const bumpMeshVersion = useStore((s) => s.bumpMeshVersion);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || !currentModel || sending) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setInput('');
    setSending(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api.chatAI(currentModel.id, userMsg.content, history);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: res.response,
        timestamp: new Date().toISOString(),
        modification: res.modification,
      };
      addMessage(assistantMsg);

      if (res.mesh_updated) {
        bumpMeshVersion();
      }
    } catch (err) {
      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Error de conexión'}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setSending(false);
    }
  };

  if (!currentModel) {
    return (
      <div className="chat-panel">
        <div className="chat-empty">
          <Bot size={32} strokeWidth={1.5} />
          <p>Selecciona un modelo para usar el asistente AI</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <Bot size={18} />
        <span>Asistente AI — {currentModel.filename}</span>
        {messages.length > 0 && (
          <button className="btn-icon" onClick={clearChat} title="Limpiar chat">
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-welcome">
            <p>Describe los cambios que quieres hacer al modelo:</p>
            <div className="chat-suggestions">
              <button onClick={() => setInput('Haz las columnas de 30cm de diámetro')}>
                Cambiar grosor de columnas
              </button>
              <button onClick={() => setInput('Pinta la fachada principal de color blanco')}>
                Cambiar color de fachada
              </button>
              <button onClick={() => setInput('Agranda el balcón 1 metro hacia afuera')}>
                Modificar dimensiones
              </button>
              <button onClick={() => setInput('¿Cuáles son las dimensiones del modelo?')}>
                Consultar dimensiones
              </button>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-icon">
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            <div className="chat-msg-content">
              <p>{msg.content}</p>
              {msg.modification && (
                <div className={`chat-mod ${msg.modification.success ? 'chat-mod-ok' : 'chat-mod-err'}`}>
                  {msg.modification.success ? '✓' : '✗'} {msg.modification.description}
                </div>
              )}
            </div>
          </div>
        ))}

        {sending && (
          <div className="chat-msg chat-msg-assistant">
            <div className="chat-msg-icon"><Bot size={16} /></div>
            <div className="chat-msg-content">
              <Loader2 size={16} className="spin" />
              <span style={{ marginLeft: 8 }}>Procesando...</span>
            </div>
          </div>
        )}
      </div>

      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Describe el cambio que quieres hacer..."
          disabled={sending}
        />
        <button onClick={handleSend} disabled={sending || !input.trim()} className="btn-send">
          {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}
