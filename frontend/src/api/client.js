const API_BASE = import.meta.env.VITE_API_BASE || '/api';
const BASE_URL = import.meta.env.BASE_URL || '/';

// === Session Management ===
// Uses sessionStorage: closes with browser. Inactivity timeout: 30 min.

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let inactivityTimer = null;

function resetInactivityTimer(isClient = false) {
  if (inactivityTimer) clearTimeout(inactivityTimer);
  const hasSession = isClient ? sessionStorage.getItem('clientToken') : sessionStorage.getItem('token');
  if (!hasSession) return;
  inactivityTimer = setTimeout(() => {
    // Logout both admin and client on inactivity
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('clientToken');
    sessionStorage.removeItem('clientUser');
    window.location.href = sessionStorage.getItem('clientToken') ? `${BASE_URL}client/login` : `${BASE_URL}login`;
  }, INACTIVITY_TIMEOUT);
}

// Track user activity
if (typeof window !== 'undefined') {
  ['click', 'keydown', 'scroll', 'mousemove'].forEach(evt => {
    document.addEventListener(evt, () => {
      const isClient = !!sessionStorage.getItem('clientToken');
      resetInactivityTimer(isClient);
    }, { passive: true });
  });
}

// === Admin Auth ===

function getToken() {
  return sessionStorage.getItem('token');
}

function adminLogout() {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
  window.location.href = `${BASE_URL}login`;
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

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Risposta non valida dal server' : 'Errore del server');
  }

  if (res.status === 401) {
    // Only logout if we had a token (session expired), not on login attempts
    if (token) {
      adminLogout();
      throw new Error('Non autenticato');
    }
    throw new Error(data.error || 'Credenziali non valide');
  }

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
  changePassword: (password) =>
    request('/auth/change-password', { method: 'PUT', body: JSON.stringify({ password }) }),
  verify2fa: (temp_token, code) => {
    const base = import.meta.env.VITE_API_BASE || '/api';
    return fetch(`${base}/auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token, code }),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw { message: data.error, locked: data.locked, remaining: data.remaining };
      return data;
    });
  },
};

// Tickets
export const tickets = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/tickets${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/tickets/${id}`),
  create: (data) => request('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  createFromEmail: (emailId, data) => request(`/tickets/from-email/${emailId}`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/tickets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  clientList: (clienteId) => request(`/tickets/client/${clienteId}`),
  clientGet: (clienteId, ticketId) => request(`/tickets/client/${clienteId}/${ticketId}`),
  clientReply: (clienteId, ticketId, corpo) =>
    request(`/tickets/client/${clienteId}/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ corpo }) }),
  addNote: (id, testo, salva_in_kb = false) =>
    request(`/tickets/${id}/notes`, { method: 'POST', body: JSON.stringify({ testo, salva_in_kb }) }),
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
  delete: (id) => request(`/projects/${id}`, { method: 'DELETE' }),
  addNote: (id, testo, salva_in_kb = false, is_bloccante = false, sblocca = false) =>
    request(`/projects/${id}/notes`, { method: 'POST', body: JSON.stringify({ testo, salva_in_kb, is_bloccante, sblocca }) }),
  sendChat: (id, testo) =>
    request(`/projects/${id}/chat`, { method: 'POST', body: JSON.stringify({ testo }) }),
  deleteChat: (id, messageId) =>
    request(`/projects/${id}/chat/${messageId}`, { method: 'DELETE' }),
  chatUnread: () => request('/projects/chat-unread'),
  clientProjects: (clienteId) => request(`/projects/client/${clienteId}`),
  allegati: (id) => request(`/projects/${id}/allegati`),
  uploadAllegati: (id, files) => {
    const formData = new FormData();
    files.forEach(f => formData.append('files', f));
    const token = getToken();
    return fetch(`${API_BASE}/projects/${id}/allegati`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => {
      if (r.status === 401) { adminLogout(); throw new Error('Non autenticato'); }
      return r.json();
    });
  },
  deleteAllegato: (id, allegatoId) => request(`/projects/${id}/allegati/${allegatoId}`, { method: 'DELETE' }),
  downloadAllegatoUrl: (id, allegatoId) => `${API_BASE}/projects/${id}/allegati/${allegatoId}/download`,
  updateReferenti: (id, data) => request(`/projects/${id}/referenti`, { method: 'PUT', body: JSON.stringify(data) }),
};

// Activities
export const activities = {
  get: (projectId, activityId) => request(`/projects/${projectId}/activities/${activityId}`),
  list: (projectId) => request(`/projects/${projectId}/activities`),
  listAll: () => request('/activities/all'),
  create: (projectId, data) =>
    request(`/projects/${projectId}/activities`, { method: 'POST', body: JSON.stringify(data) }),
  update: (projectId, activityId, data) =>
    request(`/projects/${projectId}/activities/${activityId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (projectId, activityId) =>
    request(`/projects/${projectId}/activities/${activityId}`, { method: 'DELETE' }),
  addNote: (projectId, activityId, testo, salva_in_kb = false, is_bloccante = false, sblocca = false) =>
    request(`/projects/${projectId}/activities/${activityId}/notes`, { method: 'POST', body: JSON.stringify({ testo, salva_in_kb, is_bloccante, sblocca }) }),
  getScheduled: (projectId, activityId) =>
    request(`/projects/${projectId}/activities/${activityId}/scheduled`),
  createScheduled: (projectId, activityId, data) =>
    request(`/projects/${projectId}/activities/${activityId}/scheduled`, { method: 'POST', body: JSON.stringify(data) }),
  deleteScheduled: (projectId, activityId, scheduledId) =>
    request(`/projects/${projectId}/activities/${activityId}/scheduled/${scheduledId}`, { method: 'DELETE' }),
  uploadAllegati: (projectId, activityId, files) => {
    const formData = new FormData();
    for (const f of files) formData.append('files', f);
    const token = getToken();
    return fetch(`${API_BASE}/projects/${projectId}/activities/${activityId}/allegati`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      if (r.status === 401) { adminLogout(); throw new Error('Non autenticato'); }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Errore upload');
      return d;
    });
  },
  deleteAllegato: (projectId, activityId, allegatoId) =>
    request(`/projects/${projectId}/activities/${activityId}/allegati/${allegatoId}`, { method: 'DELETE' }),
  updateReferenti: (projectId, activityId, data) =>
    request(`/projects/${projectId}/activities/${activityId}/referenti`, { method: 'PUT', body: JSON.stringify(data) }),
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
  delete: (id) => request(`/clients/${id}`, { method: 'DELETE' }),
  uploadLogo: (id, file) => {
    const formData = new FormData();
    formData.append('logo', file);
    const token = getToken();
    return fetch(`${API_BASE}/clients/${id}/logo`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(r => {
      if (r.status === 401) { adminLogout(); throw new Error('Non autenticato'); }
      return r.json();
    });
  },
  deleteLogo: (id) => request(`/clients/${id}/logo`, { method: 'DELETE' }),
  getUsers: (clientId) => request(`/clients/${clientId}/users`),
  createUser: (clientId, data) => request(`/clients/${clientId}/users`, { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (clientId, userId, data) => request(`/clients/${clientId}/users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (clientId, userId) => request(`/clients/${clientId}/users/${userId}`, { method: 'DELETE' }),
  // Referenti progetto
  getReferenti: (clientId) => request(`/clients/${clientId}/referenti`),
  createReferente: (clientId, data) => request(`/clients/${clientId}/referenti`, { method: 'POST', body: JSON.stringify(data) }),
  updateReferente: (clientId, refId, data) => request(`/clients/${clientId}/referenti/${refId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReferente: (clientId, refId) => request(`/clients/${clientId}/referenti/${refId}`, { method: 'DELETE' }),
};

// Emails
export const emails = {
  poll: () => request('/emails/poll', { method: 'POST' }).catch(() => {}),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/emails${qs ? `?${qs}` : ''}`);
  },
  get: (id) => request(`/emails/${id}`),
  create: (data, files) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v != null) formData.append(k, v); });
    if (files && files.length > 0) {
      files.forEach(f => formData.append('allegati', f));
    }
    const token = getToken();
    return fetch(`${API_BASE}/emails`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      if (r.status === 401) { adminLogout(); throw new Error('Non autenticato'); }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Errore del server');
      return d;
    });
  },
  update: (id, data) => request(`/emails/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/emails/${id}`, { method: 'DELETE' }),
};

// Users
export const users = {
  list: () => request('/users'),
  create: (data) => request('/users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/users/${id}`, { method: 'DELETE' }),
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
  client: (clienteId) => request(`/dashboard/client/${clienteId}`),
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
    }).then(r => {
      if (r.status === 401) { adminLogout(); throw new Error('Non autenticato'); }
      return r.json();
    });
  },
  update: (id, data) =>
    request(`/repository/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) =>
    request(`/repository/${id}`, { method: 'DELETE' }),
  downloadUrl: (id) => `${API_BASE}/repository/${id}/download`,
};

// Comunicazioni (admin)
export const comunicazioni = {
  list: () => request('/comunicazioni'),
  create: (data) => request('/comunicazioni', { method: 'POST', body: JSON.stringify(data) }),
  remove: (id) => request(`/comunicazioni/${id}`, { method: 'DELETE' }),
};

// Referenti Esterni (contatti esterni legati a progetto o attività)
export const referentiEsterni = {
  listForProject: (projectId) => request(`/projects/${projectId}/referenti-esterni`),
  createForProject: (projectId, data) =>
    request(`/projects/${projectId}/referenti-esterni`, { method: 'POST', body: JSON.stringify(data) }),
  createForActivity: (projectId, activityId, data) =>
    request(`/projects/${projectId}/activities/${activityId}/referenti-esterni`, { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    request(`/referenti-esterni/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  remove: (id) => request(`/referenti-esterni/${id}`, { method: 'DELETE' }),
};

// Anagrafica unificata (utenti portale + ref interni + ref esterni)
export const anagrafica = {
  list: () => request('/anagrafica'),
  deleteRefInterno: (id) => request(`/anagrafica/ref-interno/${id}`, { method: 'DELETE' }),
  updateRefInterno: (id, data) =>
    request(`/anagrafica/ref-interno/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRefEsternoByEmail: (email) =>
    request(`/anagrafica/ref-esterno?email=${encodeURIComponent(email)}`, { method: 'DELETE' }),
  updateRefEsternoByEmail: (email, data) =>
    request(`/anagrafica/ref-esterno?email=${encodeURIComponent(email)}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// AI Assistente
export const ai = {
  ticketAssist: (ticket_id, domanda) =>
    request('/ai/ticket-assist', { method: 'POST', body: JSON.stringify({ ticket_id, domanda }) }),
  adminAssist: (domanda) =>
    request('/ai/admin-assist', { method: 'POST', body: JSON.stringify({ domanda }) }),
};

// === Client Portal Auth & Requests ===

function getClientToken() {
  return sessionStorage.getItem('clientToken');
}

function clientLogout() {
  sessionStorage.removeItem('clientToken');
  sessionStorage.removeItem('clientUser');
  window.location.href = `${BASE_URL}client/login`;
}

async function clientRequest(endpoint, options = {}) {
  const token = getClientToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Risposta non valida dal server' : 'Errore del server');
  }

  if (res.status === 401) {
    if (token) {
      clientLogout();
      throw new Error('Non autenticato');
    }
    throw new Error(data.error || 'Credenziali non valide');
  }

  if (!res.ok) throw new Error(data.error || 'Errore del server');
  return data;
}

// Client Auth
export const clientAuth = {
  login: (email, password) =>
    clientRequest('/client-auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => clientRequest('/client-auth/me'),
  dashboard: () => clientRequest('/client-auth/dashboard'),
  impersonate: (clienteId) =>
    request(`/client-auth/impersonate/${clienteId}`, { method: 'POST' }),
  alerts: () => clientRequest('/client-auth/alerts'),
  comunicazioni: () => clientRequest('/client-auth/comunicazioni'),
  comunicazioniReadAll: () => clientRequest('/client-auth/comunicazioni/read-all', { method: 'PUT' }),
  comunicazioneRead: (id) => clientRequest(`/client-auth/comunicazioni/${id}/read`, { method: 'PUT' }),
  changePassword: (newPassword) =>
    clientRequest('/client-auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  verify2fa: (temp_token, code) => {
    const base = import.meta.env.VITE_API_BASE || '/api';
    return fetch(`${base}/client-auth/verify-2fa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temp_token, code }),
    }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw { message: data.error, locked: data.locked, remaining: data.remaining };
      return data;
    });
  },
};

// Client Portal Tickets (authed)
export const clientTickets = {
  list: (clienteId) => clientRequest(`/tickets/client/${clienteId}`),
  get: (clienteId, ticketId) => clientRequest(`/tickets/client/${clienteId}/${ticketId}`),
  reply: (clienteId, ticketId, corpo) =>
    clientRequest(`/tickets/client/${clienteId}/${ticketId}/reply`, { method: 'POST', body: JSON.stringify({ corpo }) }),
  close: (clienteId, ticketId) =>
    clientRequest(`/tickets/client/${clienteId}/${ticketId}/close`, { method: 'PUT' }),
  chatList: (clienteId, ticketId) =>
    clientRequest(`/tickets/client/${clienteId}/${ticketId}/chat`),
  chatSend: (clienteId, ticketId, messaggio) =>
    clientRequest(`/tickets/client/${clienteId}/${ticketId}/chat`, { method: 'POST', body: JSON.stringify({ messaggio }) }),
  create: (data, files) => {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => { if (v != null) formData.append(k, v); });
    if (files && files.length > 0) {
      files.forEach(f => formData.append('allegati', f));
    }
    const token = getClientToken();
    return fetch(`${API_BASE}/tickets`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async r => {
      if (r.status === 401) { clientLogout(); throw new Error('Non autenticato'); }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Errore del server');
      return d;
    });
  },
};

// Client Portal User Management (admin only)
export const clientUsers = {
  list: () => clientRequest('/client-auth/portal-users'),
  create: (data) => clientRequest('/client-auth/portal-users', { method: 'POST', body: JSON.stringify(data) }),
  update: (userId, data) => clientRequest(`/client-auth/portal-users/${userId}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (userId) => clientRequest(`/client-auth/portal-users/${userId}`, { method: 'DELETE' }),
};

// Client AI Chat
export const clientAi = {
  ask: (domanda) => clientRequest('/ai/client-assist', { method: 'POST', body: JSON.stringify({ domanda }) }),
};

// Client Portal Projects (authed)
export const clientProjects = {
  list: (clienteId) => clientRequest(`/projects/client/${clienteId}`),
  get: (clienteId, projectId) => clientRequest(`/projects/client/${clienteId}/${projectId}`),
  allegati: (clienteId, projectId) => clientRequest(`/projects/client/${clienteId}/${projectId}/allegati`),
  downloadUrl: (clienteId, projectId, allegatoId) => `${API_BASE}/projects/client/${clienteId}/${projectId}/allegati/${allegatoId}/download`,
};
