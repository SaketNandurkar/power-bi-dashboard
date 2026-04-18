import { getToken, clearAuth } from './auth';

const API_URL = process.env.REACT_APP_API_URL || '';

async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { ...options.headers };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!headers['Content-Type'] && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearAuth();
    window.location.reload();
    throw new Error('Session expired');
  }

  return response;
}

export async function createConversation(title) {
  const response = await authFetch(`${API_URL}/api/chatbot/conversations`, {
    method: 'POST',
    body: JSON.stringify({ title })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to create conversation');
  return data.conversation;
}

export async function getUserConversations() {
  const response = await authFetch(`${API_URL}/api/chatbot/conversations`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch conversations');
  return data.conversations;
}

export async function getConversation(id) {
  const response = await authFetch(`${API_URL}/api/chatbot/conversations/${id}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to fetch conversation');
  return data.conversation;
}

export async function sendMessage(conversationId, message) {
  const response = await authFetch(
    `${API_URL}/api/chatbot/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ message })
    }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to send message');
  return data.message;
}

export async function deleteConversation(conversationId) {
  const response = await authFetch(
    `${API_URL}/api/chatbot/conversations/${conversationId}`,
    { method: 'DELETE' }
  );

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Failed to delete conversation');
  return data;
}
