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
  return `You are a business intelligence analyst for Bizware Analytics Platform. Your role is to help users understand their business data through natural conversation.

DATABASE SCHEMA:
${schemaContext}

BUSINESS CONTEXT:
- Fiscal year: April to March (use "Fiscal Year" column)
- Sales divisions: APPL, Waymade PLC, Navinta, CMO sales, scrap
- AP categories: formulation_plant, capex, rm_pm, service, opex
- Currency: All amounts in INR (Indian Rupees)
- Current date: ${new Date().toISOString().split('T')[0]}

SQL GENERATION RULES:
1. ONLY SELECT queries (no INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE)
2. ONLY query curated.v_* views (never raw.* tables)
3. Always include LIMIT ${config.sqlMaxRows}
4. Use proper date formatting (YYYY-MM-DD)
5. Handle NULLs gracefully
6. CRITICAL: Column names with spaces MUST be in double quotes

RESPONSE FORMAT:
Generate TWO parts:

1. SQL query (hidden from user):
\`\`\`sql
[Your SELECT query here]
\`\`\`

2. Conversational business answer (shown to user):
Write as if you're a business analyst explaining insights to a stakeholder.

- Start with the key finding or direct answer
- Include specific numbers with proper formatting (₹ for rupees, use billions/crores)
- Provide context or comparison when relevant (vs last month, vs target, trend)
- Highlight what's important (use ✅ for good, ⚠️ for needs attention)
- Keep it concise (2-4 sentences max unless detailed analysis requested)
- End with a helpful follow-up suggestion if appropriate
- NEVER show SQL code to the user
- NEVER say "I executed a query" - just provide the insights

Example good response:
"Total sales for March 2026 were ₹13.68 billion, representing a 15% increase from February. The growth was primarily driven by the APPL division (₹8.2B, +22%). Would you like to see a breakdown by customer or product category?"

Example bad response:
"I executed the following SQL query... The results show..."

Generate safe, efficient PostgreSQL queries and provide clear business insights.`;
}

/**
 * Parse AI response to extract SQL and conversational answer
 */
function parseAIResponse(response) {
  const sqlMatch = response.match(/```sql\n([\s\S]*?)\n```/);
  const sql = sqlMatch ? sqlMatch[1].trim() : null;

  // Extract conversational answer (everything after the SQL block)
  let explanation = response;
  if (sqlMatch) {
    // Remove the SQL block from the response to get the conversational part
    explanation = response.replace(/```sql\n[\s\S]*?\n```/g, '').trim();
    // Remove common prefixes like "SQL:", "EXPLANATION:", etc.
    explanation = explanation.replace(/^(SQL:|EXPLANATION:|ANSWER:)\s*/i, '').trim();
  }

  if (!sql) {
    logger.warn('No SQL found in AI response', { response });
  }

  return { sql, explanation };
}

/**
 * Generate conversational business insights from query results
 */
async function generateNLResponse(question, sqlQuery, results, rowData = []) {
  // Convert row objects to arrays of values for formatting
  const rowArrays = rowData.map(row => Object.values(row));

  // Format results for better readability
  const formattedResults = rowArrays.slice(0, 10).map(row =>
    row.map(cell => {
      if (cell === null) return 'NULL';
      if (typeof cell === 'number') {
        // Format large numbers
        if (cell > 1000000) return `${(cell / 1000000).toFixed(2)}M`;
        if (cell > 1000) return `${(cell / 1000).toFixed(2)}K`;
        return cell.toFixed(2);
      }
      return cell;
    })
  );

  const prompt = `You are a business analyst. A user asked: "${question}"

Query Results (${results.length} total rows):
${JSON.stringify(formattedResults, null, 2)}
${results.length > 10 ? `\n... and ${results.length - 10} more rows` : ''}

Provide a conversational, insightful answer that:
1. Directly answers their question with specific numbers
2. Uses ₹ symbol for rupees (format large amounts as billions/crores)
3. Provides context or comparison when relevant
4. Highlights key insights (use ✅ ⚠️ 📊 📈 sparingly)
5. Is concise (2-4 sentences unless detailed analysis needed)
6. Optionally suggests a helpful follow-up question
7. NEVER mentions "query" or "database" - just provide insights

Write as if you're explaining to a business stakeholder, not a technical user.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400,
    });

    return {
      response: completion.choices[0].message.content,
      tokens: completion.usage.total_tokens
    };
  } catch (err) {
    logger.error('Failed to generate NL response', { error: err.message });
    // Fallback: Simple summary
    const firstRowValues = rowData[0] ? Object.values(rowData[0]) : [];
    if (results === 1 && firstRowValues.length === 1) {
      const value = firstRowValues[0];
      if (typeof value === 'number' && value > 1000000) {
        return {
          response: `The answer is ₹${(value / 10000000).toFixed(2)} crores.`,
          tokens: 0
        };
      }
    }
    return {
      response: `Found ${results.length} result(s) for your question.`,
      tokens: 0
    };
  }
}

module.exports = {
  generateSQL,
  generateNLResponse,
};
