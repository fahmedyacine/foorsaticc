const API_URL = 'http://localhost:8080';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const api = {
  login: async (email, password) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Login failed');
    }
    return res.json();
  },

  register: async (name, email, password) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Registration failed');
    }
    return res.json();
  },

  getHistory: async () => {
    // Go backend doesn't support history yet, return empty array
    return [];
  },

  saveMessage: async (message) => {
    // Go backend doesn't support saving messages yet
    // Return success to prevent errors
    return { success: true };
  },

  sendMessage: async (payload) => {
    // Map to Go backend's /query endpoint
    const res = await fetch(`${API_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: payload.question,
        top_k: payload.top_k || 3
      }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Backend error: ${errorText}`);
    }
    return res.json();
  },

  // New method for batch questions (hackathon format)
  sendBatchQuestions: async (payload) => {
    const res = await fetch(`${API_URL}/batch-questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Backend error: ${errorText}`);
    }
    return res.json();
  },

  // Upload file document by sending file path to backend
  uploadFileDocument: async (filePath, id, metadata = {}) => {
    const res = await fetch(`${API_URL}/documents/file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || `doc-${Date.now()}`,
        file_path: filePath,
        metadata: metadata
      }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Backend error: ${errorText}`);
    }
    return res.json();
  },

  // Upload file document by actually uploading the file
  uploadFile: async (file, id, metadata = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('id', id || `doc-${Date.now()}`);
    if (Object.keys(metadata).length > 0) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    const res = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'Unknown error');
      throw new Error(`Backend error: ${errorText}`);
    }
    return res.json();
  }
};
