import React from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-header">
        <strong>{isUser ? 'You' : 'AI Assistant'}</strong>
        <span className="message-time">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
      <div className="message-content">
        {message.content.split('```').map((part, i) => {
          if (i % 2 === 1) {
            // Code block
            const lines = part.split('\n');
            const lang = lines[0].trim(); // sql, json, etc.
            const code = lines.slice(1).join('\n');
            return (
              <pre key={i} className="code-block">
                <code className={`language-${lang}`}>{code}</code>
              </pre>
            );
          } else {
            // Regular text
            return <p key={i}>{part}</p>;
          }
        })}
      </div>
    </div>
  );
}
