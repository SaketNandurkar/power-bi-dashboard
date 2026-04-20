import React, { useState, useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import {
  createConversation,
  getUserConversations,
  getConversation,
  sendMessage,
  deleteConversation,
  getSuggestedQuestions,
  searchConversations
} from '../services/chatApi';
import '../styles/chatbot.css';

export default function ChatbotPanel({ user }) {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Load conversations and suggestions on mount
  useEffect(() => {
    loadConversations();
    loadSuggestions();
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

  const loadSuggestions = async () => {
    try {
      const sugg = await getSuggestedQuestions();
      setSuggestions(sugg || []);
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    }
  };

  const handleSuggestionClick = (question) => {
    setInput(question);
    // Auto-focus input field
    document.querySelector('.chat-input')?.focus();
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    // Debounce search
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchConversations(query);
        setSearchResults(results);
      } catch (err) {
        console.error('Search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setIsSearching(false);
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

  const handleDeleteConversation = async (e, convId) => {
    e.stopPropagation(); // Prevent selecting the conversation

    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      await deleteConversation(convId);

      // Remove from local state
      setConversations(prev => prev.filter(c => c.id !== convId));

      // If deleted conversation was active, clear or select another
      if (activeId === convId) {
        const remaining = conversations.filter(c => c.id !== convId);
        if (remaining.length > 0) {
          setActiveId(remaining[0].id);
        } else {
          setActiveId(null);
          setMessages([]);
        }
      }
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

        {/* Search bar */}
        <div className="search-container">
          <input
            type="text"
            className="search-input"
            placeholder="🔍 Search conversations..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button className="clear-search-btn" onClick={clearSearch}>
              ×
            </button>
          )}
        </div>

        <div className="conversation-list">
          {isSearching && <div className="search-loading">Searching...</div>}

          {searchQuery && searchResults.length === 0 && !isSearching && (
            <div className="no-results">No conversations found</div>
          )}

          {(searchQuery ? searchResults : conversations).map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${activeId === conv.id ? 'active' : ''}`}
              onClick={() => setActiveId(conv.id)}
            >
              <div className="conv-content">
                <div className="conv-title">{conv.title}</div>
                <div className="conv-date">
                  {new Date(conv.updated_at).toLocaleDateString()}
                </div>
              </div>
              <button
                className="delete-conv-btn"
                onClick={(e) => handleDeleteConversation(e, conv.id)}
                title="Delete conversation"
              >
                ×
              </button>
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
              <h3>Welcome to AI Assistant! 👋</h3>
              <p>Ask me anything about your business data, or try these suggestions:</p>

              <div className="suggestions-grid">
                {suggestions.map((category, idx) => (
                  <div key={idx} className="suggestion-category">
                    <div className="category-header">
                      <span className="category-icon">{category.icon}</span>
                      <span className="category-name">{category.category}</span>
                    </div>
                    <div className="suggestion-questions">
                      {category.questions.map((question, qIdx) => (
                        <button
                          key={qIdx}
                          className="suggestion-btn"
                          onClick={() => handleSuggestionClick(question)}
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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
