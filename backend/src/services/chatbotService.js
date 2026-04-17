const { pool } = require('./dbService');
const aiService = require('./aiService');
const sqlGenerator = require('./sqlGenerator');
const sqlValidator = require('./sqlValidator');
const logger = require('../utils/logger');
const config = require('../config');

/**
 * Create new conversation for user
 */
async function createConversation(userId, title = 'New Conversation') {
  const result = await pool.query(
    `INSERT INTO ai.conversations (user_id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, title]
  );
  return result.rows[0];
}

/**
 * Get conversation by ID (with ownership check)
 */
async function getConversation(conversationId, userId) {
  const result = await pool.query(
    `SELECT c.*,
            json_agg(
              json_build_object(
                'id', m.id,
                'role', m.role,
                'content', m.content,
                'sql_query', m.sql_query,
                'created_at', m.created_at
              ) ORDER BY m.created_at ASC
            ) FILTER (WHERE m.id IS NOT NULL) as messages
     FROM ai.conversations c
     LEFT JOIN ai.messages m ON m.conversation_id = c.id
     WHERE c.id = $1 AND c.user_id = $2
     GROUP BY c.id`,
    [conversationId, userId]
  );

  return result.rows[0] || null;
}

/**
 * Get all conversations for user
 */
async function getUserConversations(userId) {
  const result = await pool.query(
    `SELECT id, title, created_at, updated_at
     FROM ai.conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT 50`,
    [userId]
  );
  return result.rows;
}

/**
 * Process user message and generate AI response
 */
async function sendMessage(conversationId, userId, message, requestId) {
  const startTime = Date.now();

  // 1. Verify conversation ownership
  const convCheck = await pool.query(
    'SELECT user_id FROM ai.conversations WHERE id = $1',
    [conversationId]
  );

  if (!convCheck.rows[0] || convCheck.rows[0].user_id !== userId) {
    throw new Error('Conversation not found or access denied');
  }

  // 2. Save user message
  await pool.query(
    `INSERT INTO ai.messages (conversation_id, role, content)
     VALUES ($1, 'user', $2)`,
    [conversationId, message]
  );

  logger.info('Processing user message', { requestId, conversationId, message });

  try {
    // 3. Get conversation history (last 10 messages for context)
    const historyResult = await pool.query(
      `SELECT role, content
       FROM ai.messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [conversationId]
    );
    const history = historyResult.rows.reverse().map(h => ({
      role: h.role,
      content: h.content
    }));

    // 4. Get schema context
    const schemaContext = await sqlGenerator.getSchemaContext();

    // 5. Generate SQL from question
    const { sql, explanation, tokens } = await aiService.generateSQL(
      message,
      schemaContext,
      history
    );

    if (!sql) {
      throw new Error('AI failed to generate SQL query');
    }

    // 6. Validate SQL
    const validation = sqlValidator.validateSQL(sql);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // 7. Execute SQL
    const queryStartTime = Date.now();
    const queryResult = await pool.query(validation.sanitized);
    const queryDuration = Date.now() - queryStartTime;

    logger.info('SQL query executed', {
      requestId,
      rows: queryResult.rowCount,
      duration: queryDuration
    });

    // 8. Generate conversational business insights
    const nlResponse = await aiService.generateNLResponse(
      message,
      validation.sanitized,
      queryResult.rowCount,
      queryResult.rows
    );

    // 9. Format final response (conversational only, hide SQL)
    const assistantMessage = nlResponse.response;

    // 10. Save assistant message (SQL stored separately for audit)
    await pool.query(
      `INSERT INTO ai.messages (
        conversation_id, role, content, sql_query,
        sql_result_rows, tokens_used, execution_time_ms
      ) VALUES ($1, 'assistant', $2, $3, $4, $5, $6)`,
      [
        conversationId,
        assistantMessage, // Only conversational text shown to user
        validation.sanitized, // SQL saved for audit/debugging
        queryResult.rowCount,
        tokens + nlResponse.tokens,
        Date.now() - startTime
      ]
    );

    return {
      content: assistantMessage,
      sql: validation.sanitized, // Still returned for debugging (not shown in UI)
      results: queryResult.rows,
      rowCount: queryResult.rowCount,
      tokensUsed: tokens + nlResponse.tokens,
      duration: Date.now() - startTime
    };

  } catch (err) {
    logger.error('Message processing failed', {
      requestId,
      conversationId,
      error: err.message
    });

    // Generate helpful error message based on error type
    let errorMessage;
    if (err.message.includes('column') && err.message.includes('does not exist')) {
      errorMessage = `I apologize, but I couldn't find that data in our system. Could you try rephrasing your question or ask about something else?

Try asking about sales, budgets, accounts payable, or bank balances.`;
    } else if (err.message.includes('Query must start with SELECT')) {
      errorMessage = `I can only help you retrieve and analyze data. I cannot modify or delete information.

What insights would you like to see from your business data?`;
    } else if (err.message.includes('AI failed to generate')) {
      errorMessage = `I'm having trouble understanding that question. Could you rephrase it or try asking something more specific?

For example: "What were total sales last month?" or "Show me current bank balance"`;
    } else {
      errorMessage = `I encountered an issue processing your request. Let's try a different question!

You can ask me about sales data, budgets, vendor payments, or account balances.`;
    }

    await pool.query(
      `INSERT INTO ai.messages (conversation_id, role, content, error)
       VALUES ($1, 'assistant', $2, $3)`,
      [conversationId, errorMessage, err.message]
    );

    throw err;
  }
}

module.exports = {
  createConversation,
  getConversation,
  getUserConversations,
  sendMessage,
};
