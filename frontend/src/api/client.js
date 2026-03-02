const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    throw new Error('Non autenticato');
  }

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Errore del server');
  }

  return data;
}

// Auth
export const auth = {
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
};

// Tickets
export const tickets = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tickets${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/tickets/${id}`),
  create: (data) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  clientList: (clienteId) => request(`/tickets/client/${clienteId}`),
  clientGet: (clienteId, ticketId) => request(`/tickets/client/${clienteId}/${ticketId}`),
  clientReply: (clienteId, ticketId, corpo) =>
    request(`/tickets/client/${clienteId}/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ corpo }) }),
  addNote: (id, testo) =>
    request(`/tickets/${id}/notes`, { method: 'POST', body: JSON.stringify({ testo }) }),
};

// Projects
export const projects = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/projects${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/projects/${id}`),
  create: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  sendChat: (id, testo) =>
    request(`/projects/${id}/chat`, { method: 'POST', body: JSON.stringify({ testo }) }),
  chatUnread: () => request('/projects/chat-unread'),
  clientProjects: (clienteId) => request(`/projects/client/${clienteId}`),
};

// Activities
export const activities = {
  get: (projectId, activityId) => request(`/projects/${projectId}/activities/${activityId}`),
  list: (projectId) => request(`/projects/${projectId}/activities`),
  create: (projectId, data) =>
    request(`/projects/${projectId}/activities`, { method: 'POST', body: JSON.stringify(data) }),
  update: (projectId, activityId, data) =>
    request(`/projects/${projectId}/activities/${activityId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (projectId, activityId) =>
    request(`/projects/${projectId}/activities/${activityId}`, { method: 'DELETE' }),
  addNote: (projectId, activityId, testo) =>
    request(`/projects/${projectId}/activities/${activityId}/notes`, { method: 'POST', body: JSON.stringify({ testo }) }),
};

// Clients
export const clients = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/clients${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/clients/${id}`),
  create: (data) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  uploadLogo: (id, file) => {
    const formData = new FormData();
    formData.append('logo', file);
    const token = getToken();
    return fetch(`${API_BASE}/clients/${id}/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json());
  },
  deleteLogo: (id) => request(`/clients/${id}/logo`, { method: 'DELETE' }),
  getUsers: (clientId) => request(`/clients/${clientId}/users`),
  createUser: (clientId, data) => request(`/clients/${clientId}/users`, { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (clientId, userId, data) => request(`/clients/${clientId}/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (clientId, userId) => request(`/clients/${clientId}/users/${userId}`, { method: 'DELETE' }),
};

// Emails
export const emails = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/emails${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/emails/${id}`),
  create: (data) => request('/emails', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/emails/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Users
export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Notifications
export const notifications = {
  list: () => request('/notifications'),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (id) => request(`/notifications/${id}/read`, { method: 'PUT' }),
  markAllRead: () => request('/notifications/read-all', { method: 'PUT' }),
};

// Dashboard
export const dashboard = {
  get: () => request('/dashboard'),
  sidebarCounts: (since) => {
    const qs = since ? `?since=${encodeURIComponent(since)}` : '';
    return request(`/dashboard/sidebar-counts${qs}`);
  },
};

// Knowledge Base (Schede Cliente)
export const schede = {
  list: (clienteId) => request(`/clients/${clienteId}/schede`),
  create: (clienteId, data) =>
    request(`/clients/${clienteId}/schede`, { method: 'POST', body: JSON.stringify(data) }),
  update: (clienteId, id, data) =>
    request(`/clients/${clienteId}/schede/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (clienteId, id) =>
    request(`/clients/${clienteId}/schede/${id}`, { method: 'DELETE' }),
};

// Repository Documenti
export const repository = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/repository${qs ? `?${qs}` : ''}`);
  },
  categorie: () => request('/repository/categorie'),
  upload: (files, categoria, descrizione) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    if (categoria) formData.append('categoria', categoria);
    if (descrizione) formData.append('descrizione', descrizione);
    const token = getToken();
    return fetch(`${API_BASE}/repository/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => r.json());
  },
  update: (id, data) =>
    request(`/repository/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    request(`/repository/${id}`, { method: 'DELETE' }),
  downloadUrl: (id) => `${API_BASE}/repository/${id}/download`,
};

// AI Assistente
export const ai = {
  ticketAssist: (ticket_id, domanda) =>
    request('/ai/ticket-assist', { method: 'POST', body: JSON.stringify({ ticket_id, domanda }) }),
};

// --- Client Portal Auth & Requests ---

function getClientToken() {
  return localStorage.getItem('clientToken');
}

async function clientRequest(endpoint, options = {}) {
  const token = getClientToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem('clientToken');
    localStorage.removeItem('clientUser');
    // Extract slug from current URL to redirect to the correct client login
    const slugMatch = window.location.pathname.match(/^\/client\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : '';
    window.location.href = slug ? `/client/${slug}/login` : '/login';
    throw new Error('Non autenticato');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Errore del server');
  return data;
}

// Client Auth
export const clientAuth = {
  login: (email, password, slug) =>
    clientRequest('/client-auth/login', { method: 'POST', body: JSON.stringify({ email, password, slug }) }),
  me: () => clientRequest('/client-auth/me'),
  info: (slug) =>
    fetch(`${API_BASE}/client-auth/info/${slug}`).then(r => {
      if (!r.ok) throw new Error('Portale non trovato');
      return r.json();
    }),
  impersonate: (clienteId) =>
    request(`/client-auth/impersonate/${clienteId}`, { method: 'POST' }),
};

// Client Portal Tickets (authed)
export const clientTickets = {
  list: (clienteId) => clientRequest(`/tickets/client/${clienteId}`),
  get: (clienteId, ticketId) => clientRequest(`/tickets/client/${clienteId}/${ticketId}`),
  reply: (clienteId, ticketId, corpo) =>
    clientRequest(`/tickets/client/${clienteId}/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ corpo }) }),
  create: (data) => clientRequest('/tickets', { method: 'POST', body: JSON.stringify(data) }),
};

// Client Portal Projects (authed)
export const clientProjects = {
  list: (clienteId) => clientRequest(`/projects/client/${clienteId}`),
  get: (clienteId, projectId) => clientRequest(`/projects/client/${clienteId}/${projectId}`),
};
