import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import {
  createConversation,
  getUserConversations,
  getConversation,
  sendMessage
} from '../services/chatApi';
import '../styles/chatbot.css';

export default function ChatbotPanel({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  // Load conversations on mount
  useEffect(() => {
    loadConversations();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation messages when active conversation changes
  useEffect(() => {
    if (activeId) {
      loadConversation(activeId);
    }
  }, [activeId]);

  const loadConversations = async () => {
    try {
      const convs = await getUserConversations();
      setConversations(convs || []);

      // Auto-select first conversation
      if (convs.length > 0 && !activeId) {
        setActiveId(convs[0].id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const loadConversation = async (id) => {
    try {
      const conv = await getConversation(id);
      setMessages(conv.messages || []);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleNewConversation = async () => {
    try {
      const title = `Chat ${new Date().toLocaleString()}`;
      const conv = await createConversation(title);
      setConversations([conv, ...conversations]);
      setActiveId(conv.id);
      setMessages([]);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !activeId) return;

    const userMessage = input;
    setInput('');
    setLoading(true);
    setError('');

    // Optimistically add user message
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    try {
      const response = await sendMessage(activeId, userMessage);

      // Add assistant response
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: response.content,
        sql_query: response.sql,
        created_at: new Date().toISOString()
      }]);

      // Update conversation list (refresh to get new updated_at)
      await loadConversations();
    } catch (err) {
      setError(err.message);
      // Remove optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
      setInput(userMessage); // Restore input
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chatbot-panel">
      {/* Sidebar with conversation list */}
      <div className="chatbot-sidebar">
        <button className="new-chat-btn" onClick={handleNewConversation}>
          + New Chat
        </button>

        <div className="conversation-list">
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${activeId === conv.id ? 'active' : ''}`}
              onClick={() => setActiveId(conv.id)}
            >
              <div className="conv-title">{conv.title}</div>
              <div className="conv-date">
                {new Date(conv.updated_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="chatbot-main">
        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="empty-state">
              <h3>Welcome to AI Assistant!</h3>
              <p>Ask me anything about your business data:</p>
              <ul>
                <li>"What were total sales last month?"</li>
                <li>"Show me top 5 customers by revenue"</li>
                <li>"What's our current bank balance?"</li>
                <li>"Compare sales this year vs last year"</li>
              </ul>
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))}

          {loading && (
            <div className="loading-indicator">
              <div className="spinner"></div>
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input form */}
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your data..."
            disabled={loading || !activeId}
          />
          <button
            type="submit"
            className="send-button"
            disabled={loading || !input.trim() || !activeId}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
