import { create } from 'zustand';
import type { Project, Model3D, Conversion, ChatMessage, Measurement, PipelineStatus } from '../types';

interface AppState {
  pipelineStatus: PipelineStatus | null;
  setPipelineStatus: (s: PipelineStatus) => void;

  projects: Project[];
  setProjects: (p: Project[]) => void;

  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;

  models: Model3D[];
  setModels: (m: Model3D[]) => void;

  currentModel: Model3D | null;
  setCurrentModel: (m: Model3D | null) => void;

  conversions: Conversion[];
  setConversions: (c: Conversion[]) => void;

  chatMessages: ChatMessage[];
  addChatMessage: (m: ChatMessage) => void;
  clearChat: () => void;

  measurements: Measurement[];
  addMeasurement: (m: Measurement) => void;
  clearMeasurements: () => void;

  meshVersion: number;
  bumpMeshVersion: () => void;

  activeTool: 'select' | 'measure' | 'color' | null;
  setActiveTool: (t: 'select' | 'measure' | 'color' | null) => void;

  sidebarTab: 'projects' | 'info' | 'chat' | 'export';
  setSidebarTab: (t: 'projects' | 'info' | 'chat' | 'export') => void;

  isLoading: boolean;
  setIsLoading: (l: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  pipelineStatus: null,
  setPipelineStatus: (s) => set({ pipelineStatus: s }),

  projects: [],
  setProjects: (p) => set({ projects: p }),

  currentProject: null,
  setCurrentProject: (p) => set({ currentProject: p }),

  models: [],
  setModels: (m) => set({ models: m }),

  currentModel: null,
  setCurrentModel: (m) => set({ currentModel: m }),

  conversions: [],
  setConversions: (c) => set({ conversions: c }),

  chatMessages: [],
  addChatMessage: (m) => set((s) => ({ chatMessages: [...s.chatMessages, m] })),
  clearChat: () => set({ chatMessages: [] }),

  measurements: [],
  addMeasurement: (m) => set((s) => ({ measurements: [...s.measurements, m] })),
  clearMeasurements: () => set({ measurements: [] }),

  meshVersion: 0,
  bumpMeshVersion: () => set((s) => ({ meshVersion: s.meshVersion + 1 })),

  activeTool: 'select',
  setActiveTool: (t) => set({ activeTool: t }),

  sidebarTab: 'projects',
  setSidebarTab: (t) => set({ sidebarTab: t }),

  isLoading: false,
  setIsLoading: (l) => set({ isLoading: l }),
}));
