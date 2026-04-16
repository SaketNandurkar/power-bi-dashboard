const OpenAI = require('openai');
const logger = require('../utils/logger');
const config = require('../config');

// Initialize OpenAI client (supports OpenAI, Groq, OpenRouter, etc.)
const openai = new OpenAI({
  apiKey: config.openaiApiKey,
  baseURL: config.openaiBaseUrl, // Allows using alternative providers
  timeout: config.aiRequestTimeout,
});

/**
 * Generate SQL query from natural language question
 * @param {string} question - User's question
 * @param {string} schemaContext - Database schema information
 * @param {Array} conversationHistory - Previous messages for context
 * @returns {Promise<{sql: string, explanation: string, tokens: number}>}
 */
async function generateSQL(question, schemaContext, conversationHistory = []) {
  logger.info('Generating SQL from question', {
    questionLength: question.length,
    historyLength: conversationHistory.length
  });

  const systemPrompt = buildSystemPrompt(schemaContext);
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: question }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages,
      temperature: config.openaiTemperature,
      max_tokens: config.openaiMaxTokens,
    });

    const response = completion.choices[0].message.content;
    const tokens = completion.usage.total_tokens;

    // Parse SQL and explanation from response
    const parsed = parseAIResponse(response);

    logger.info('SQL generated successfully', {
      tokens,
      sqlLength: parsed.sql?.length || 0
    });

    return {
      sql: parsed.sql,
      explanation: parsed.explanation,
      tokens
    };
  } catch (err) {
    logger.error('OpenAI API call failed', {
      error: err.message,
      status: err.status
    });
    throw new Error(`AI service error: ${err.message}`);
  }
}

/**
 * Build system prompt with schema context and safety rules
 */
function buildSystemPrompt(schemaContext) {
  return `You are a SQL expert assistant for the Bizware Analytics Platform.

DATABASE SCHEMA:
${schemaContext}

BUSINESS RULES:
- Fiscal year runs April to March (use fiscal_year column)
- Sales are grouped by: APPL, Waymade PLC, Navinta, CMO sales, scrap
- Accounts Payable classifications: formulation_plant, capex, rm_pm, service, opex
- All monetary values are in INR (Indian Rupees)

STRICT REQUIREMENTS:
1. ONLY generate SELECT queries (no INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE)
2. ONLY query curated.v_* views (never raw.* tables)
3. Always include LIMIT clause (max ${config.sqlMaxRows} rows)
4. Use proper date formatting (YYYY-MM-DD)
5. Handle NULL values gracefully
6. Use meaningful column aliases

RESPONSE FORMAT:
Provide your response in this format:

SQL:
\`\`\`sql
[Your SELECT query here]
\`\`\`

EXPLANATION:
[Brief explanation of what the query does and what insights it provides]

Generate safe, efficient PostgreSQL queries only.`;
}

/**
 * Parse AI response to extract SQL and explanation
 */
function parseAIResponse(response) {
  const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
  const sql = sqlMatch ? sqlMatch[1].trim() : null;

  // Extract explanation (everything after "EXPLANATION:")
  const explanationMatch = response.match(/EXPLANATION:\s*([\s\S]*?)$/i);
  const explanation = explanationMatch ? explanationMatch[1].trim() : response;

  if (!sql) {
    logger.warn('No SQL found in AI response', { response });
  }

  return { sql, explanation };
}

/**
 * Generate natural language response from query results
 */
async function generateNLResponse(question, sqlQuery, results) {
  const prompt = `The user asked: "${question}"

We executed this SQL query:
\`\`\`sql
${sqlQuery}
\`\`\`

Results (${results.length} rows):
${JSON.stringify(results.slice(0, 5), null, 2)}
${results.length > 5 ? `\n... and ${results.length - 5} more rows` : ''}

Provide a concise, business-friendly summary of these results in 2-3 sentences.
Include specific numbers and insights. Use Indian Rupee symbol (₹) for monetary values.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 300,
    });

    return {
      response: completion.choices[0].message.content,
      tokens: completion.usage.total_tokens
    };
  } catch (err) {
    logger.error('Failed to generate NL response', { error: err.message });
    return {
      response: `Query returned ${results.length} rows.`,
      tokens: 0
    };
  }
}

module.exports = {
  generateSQL,
  generateNLResponse,
};
