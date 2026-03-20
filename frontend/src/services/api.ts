const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getStatus: () => request<import('../types').PipelineStatus>('/status'),

  createProject: (data: { name: string; description?: string; client?: string; location?: string; project_type?: string }) =>
    request<import('../types').Project>('/projects', { method: 'POST', body: JSON.stringify(data) }),

  listProjects: () => request<import('../types').Project[]>('/projects'),

  getProject: (id: number) => request<import('../types').Project>(`/projects/${id}`),

  deleteProject: (id: number) => request<{ message: string }>(`/projects/${id}`, { method: 'DELETE' }),

  uploadModel: (projectId: number, file: File, sourceUnits = 'mm') => {
    const form = new FormData();
    form.append('file', file);
    form.append('source_units', sourceUnits);
    return request<import('../types').Model3D>(`/projects/${projectId}/models`, { method: 'POST', body: form });
  },

  listModels: (projectId: number) =>
    request<import('../types').Model3D[]>(`/projects/${projectId}/models`),

  convertModel: (modelId: number, params: {
    scale?: string;
    printer?: string;
    profile?: string;
    auto_fix?: boolean;
    orient?: boolean;
    units?: string;
  }) => request<import('../types').Conversion>(`/models/${modelId}/convert`, {
    method: 'POST',
    body: JSON.stringify(params),
  }),

  listConversions: (modelId: number) =>
    request<import('../types').Conversion[]>(`/models/${modelId}/conversions`),

  getDownloadUrl: (conversionId: number) =>
    `${API_BASE}/api/conversions/${conversionId}/download`,

  getMeshData: (modelId: number) =>
    `${API_BASE}/api/models/${modelId}/mesh-data`,

  chatAI: (modelId: number, message: string, conversationHistory: { role: string; content: string }[]) =>
    request<{ response: string; modification?: { success: boolean; description: string }; mesh_updated: boolean }>(
      '/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ model_id: modelId, message, history: conversationHistory }),
      }
    ),

  measureModel: (modelId: number, pointA: number[], pointB: number[]) =>
    request<{ distance: number; unit: string }>(`/models/${modelId}/measure`, {
      method: 'POST',
      body: JSON.stringify({ point_a: pointA, point_b: pointB }),
    }),

  setColor: (modelId: number, componentName: string, color: string) =>
    request<{ success: boolean }>(`/models/${modelId}/color`, {
      method: 'POST',
      body: JSON.stringify({ component_name: componentName, color }),
    }),

  getComponents: (modelId: number) =>
    request<{ name: string; vertices: number; faces: number; color?: string }[]>(`/models/${modelId}/components`),

  export3MF: (modelId: number, config: Record<string, unknown>) =>
    request<{ download_url: string }>(`/models/${modelId}/export/3mf`, {
      method: 'POST',
      body: JSON.stringify(config),
    }),
};
