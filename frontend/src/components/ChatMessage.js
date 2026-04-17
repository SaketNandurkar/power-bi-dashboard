import React from 'react';

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  // Format message content with basic markdown support
  const formatContent = (content) => {
    if (!content) return null;

    // Split by code blocks first (for backward compatibility)
    const parts = content.split('```');

    return parts.map((part, i) => {
      if (i % 2 === 1) {
        // Code block (in case SQL queries are still present)
        const lines = part.split('\n');
        const lang = lines[0].trim();
        const code = lines.slice(1).join('\n');
        return (
          <pre key={i} className="code-block">
            <code className={`language-${lang}`}>{code}</code>
          </pre>
        );
      } else {
        // Regular text with markdown formatting
        return formatMarkdown(part, i);
      }
    });
  };

  // Basic markdown formatting for conversational responses
  const formatMarkdown = (text, baseKey) => {
    if (!text.trim()) return null;

    // Split into paragraphs
    const paragraphs = text.split('\n\n');

    return paragraphs.map((para, i) => {
      const key = `${baseKey}-${i}`;

      // Check if it's a list
      if (para.includes('\n•') || para.includes('\n-')) {
        const lines = para.split('\n');
        const items = [];
        const beforeList = [];

        lines.forEach((line, idx) => {
          if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
            items.push(<li key={idx}>{line.trim().substring(1).trim()}</li>);
          } else if (items.length === 0) {
            beforeList.push(line);
          }
        });

        return (
          <div key={key}>
            {beforeList.length > 0 && <p>{formatInlineMarkdown(beforeList.join(' '))}</p>}
            {items.length > 0 && <ul className="chat-list">{items}</ul>}
          </div>
        );
      }

      // Regular paragraph
      return <p key={key}>{formatInlineMarkdown(para)}</p>;
    });
  };

  // Format inline markdown (bold, italic, emojis)
  const formatInlineMarkdown = (text) => {
    // Preserve emojis and rupee symbols
    const parts = [];
    let current = text;
    let keyCounter = 0;

    // Handle **bold** text
    while (current.includes('**')) {
      const start = current.indexOf('**');
      const end = current.indexOf('**', start + 2);

      if (end === -1) break;

      if (start > 0) {
        parts.push(current.substring(0, start));
      }

      parts.push(
        <strong key={keyCounter++}>
          {current.substring(start + 2, end)}
        </strong>
      );

      current = current.substring(end + 2);
    }

    if (current) parts.push(current);

    return parts.length > 0 ? parts : text;
  };

  return (
    <div className={`chat-message ${isUser ? 'user-message' : 'assistant-message'}`}>
      <div className="message-header">
        <strong>{isUser ? 'You' : 'AI Assistant'}</strong>
        <span className="message-time">
          {new Date(message.created_at).toLocaleTimeString()}
        </span>
      </div>
      <div className="message-content">
        {formatContent(message.content)}
      </div>
    </div>
  );
}
