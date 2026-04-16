-- ============================================================================
-- AI Service Schema Migration
-- Adds chatbot functionality with conversation and message storage
-- ============================================================================

-- Create AI schema
CREATE SCHEMA IF NOT EXISTS ai;

-- Conversations table
CREATE TABLE IF NOT EXISTS ai.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES audit.users(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS ai.messages (
    id SERIAL PRIMARY KEY,
    conversation_id UUID NOT NULL REFERENCES ai.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    sql_query TEXT,              -- For assistant messages: the SQL that was executed
    sql_result_rows INTEGER,     -- Number of rows returned
    tokens_used INTEGER,         -- LLM token usage tracking
    execution_time_ms INTEGER,   -- Query execution time
    error TEXT,                  -- Error message if query failed
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON ai.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON ai.conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON ai.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON ai.messages(created_at);

-- Trigger to auto-update conversation.updated_at on new message
CREATE OR REPLACE FUNCTION ai.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ai.conversations
    SET updated_at = NOW()
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_message_updates_conversation ON ai.messages;
CREATE TRIGGER trg_message_updates_conversation
    AFTER INSERT ON ai.messages
    FOR EACH ROW EXECUTE FUNCTION ai.update_conversation_timestamp();

-- Grant permissions to existing database user
GRANT USAGE ON SCHEMA ai TO bizware_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ai TO bizware_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ai TO bizware_user;

-- Settings for AI service
INSERT INTO audit.settings (key, value) VALUES
    ('ai_service_enabled', 'true'),
    ('ai_model', 'gpt-4-turbo-preview'),
    ('ai_max_tokens', '1500'),
    ('ai_temperature', '0.1')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'AI schema migration completed successfully';
END $$;
