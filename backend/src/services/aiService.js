const OpenAI = require('openai');
const logger = require('../utils/logger');
const config = require('../config');
const businessContext = require('./businessContext');

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
 * @param {string} question - Current user question
 * @param {string} sqlQuery - SQL query executed
 * @param {number} results - Number of result rows
 * @param {Array} rowData - Query result data
 * @param {Array} conversationHistory - Previous messages for context
 */
async function generateNLResponse(question, sqlQuery, results, rowData = [], conversationHistory = []) {
  // Get business context (budget, YoY, trends, alerts)
  // Wrapped in try-catch to prevent context failures from breaking the response
  let context = { budget_comparison: null, yoy_comparison: null, trend: null, alerts: [] };
  try {
    context = await businessContext.getBusinessContext(question, rowData);
  } catch (contextErr) {
    logger.warn('Failed to get business context, continuing with basic response', {
      error: contextErr.message
    });
  }

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

  // Build context section for AI
  let contextSection = '';

  if (context.budget_comparison && context.budget_comparison.length > 0) {
    contextSection += '\n\n📊 BUDGET COMPARISON (Last Month):\n';
    context.budget_comparison.forEach(group => {
      const variance = group.variance_pct ? `${group.variance_pct.toFixed(1)}%` : 'N/A';
      const status = group.variance_pct > 0 ? '✅' : group.variance_pct < -10 ? '⚠️' : '➡️';
      contextSection += `${status} ${group.customer_group}: ₹${(group.actual / 10000000).toFixed(2)}Cr vs Budget ₹${(group.budget / 10000000).toFixed(2)}Cr (${variance})\n`;
    });
  }

  if (context.yoy_comparison && context.yoy_comparison.yoy_growth_pct !== null) {
    const yoyGrowth = context.yoy_comparison.yoy_growth_pct.toFixed(1);
    const yoyIcon = context.yoy_comparison.yoy_growth_pct > 0 ? '📈' : '📉';
    contextSection += `\n${yoyIcon} YEAR-OVER-YEAR: ${yoyGrowth}% growth (FY ${new Date().getMonth() >= 3 ? new Date().getFullYear() : new Date().getFullYear() - 1} vs previous FY)\n`;
  }

  if (context.trend && context.trend.trend) {
    contextSection += `\n${context.trend.trend}: Last 3 months showing ${context.trend.change_pct}% change\n`;
  }

  if (context.alerts && context.alerts.length > 0) {
    contextSection += '\n🚨 ALERTS:\n';
    context.alerts.forEach(alert => {
      const icon = alert.severity === 'critical' ? '🔴' : '🟡';
      contextSection += `${icon} ${alert.message}\n`;
    });
  }

  // Build conversation context (exclude current message which was just added)
  const recentHistory = conversationHistory
    .slice(-8, -1) // Last 7 messages (excluding the current one)
    .filter(msg => msg.role !== 'system')
    .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
    .join('\n');

  const prompt = `You are a C-level business advisor for Bizware Analytics.

${recentHistory ? `CONVERSATION HISTORY (for context):\n${recentHistory}\n\n` : ''}Current user question: "${question}"

Query Results (${results.length} total rows):
${JSON.stringify(formattedResults, null, 2)}
${results.length > 10 ? `\n... and ${results.length - 10} more rows` : ''}
${contextSection}

EXECUTIVE RESPONSE FORMAT:
Your response MUST follow this structure:

**[KEY NUMBER/METRIC]**
Present the main finding with proper formatting (₹ symbol, crores/billions)

**Analysis**
- Provide context: Compare to budget, YoY growth, or trend
- Highlight what drives the number (which divisions, products, or time periods)
- Identify if this is good (✅), concerning (⚠️), or critical (🔴)

**Recommendation**
What action should leadership take? Be specific and actionable.

CRITICAL RULES:
1. Use conversation history to understand context - if user says "what should be the action plan then", understand what "then" refers to
2. Start with the KEY NUMBER in bold - this is what executives see first
3. Use business context from above (budget variance, YoY, trends, alerts)
4. Format large amounts: ₹XX.XX Cr (crores) or ₹XX.XX Bn (billions)
5. Be decisive: Don't say "consider" - say "should focus on" or "need to address"
6. Be proactive: Don't ask follow-up questions like "Would you like to know more?" - just provide complete analysis
7. Keep concise but complete: 3-5 sentences with actionable recommendations
8. NEVER mention "query", "database", or technical details
9. Write for C-executives who need to make decisions quickly

Example:
**₹13.68 Cr total sales in March 2026**

Analysis: This represents 8.5% below budget (₹14.95 Cr target) and shows a 3.2% decline YoY. The shortfall is concentrated in Waymade PLC division (₹2.1 Cr, -15% vs budget). APPL division performed well at ₹8.2 Cr (+4% above target).

Recommendation: Leadership should investigate Waymade PLC's pipeline and consider reallocating sales resources. Schedule review with Waymade account team to understand declining trend.`;

  try {
    const completion = await openai.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    return {
      response: completion.choices[0].message.content,
      tokens: completion.usage.total_tokens
    };
  } catch (err) {
    logger.error('Failed to generate NL response', { error: err.message });
    // Fallback: Simple summary with context if available
    let fallbackResponse = '';

    const firstRowValues = rowData[0] ? Object.values(rowData[0]) : [];
    if (results === 1 && firstRowValues.length === 1) {
      const value = firstRowValues[0];
      if (typeof value === 'number' && value > 1000000) {
        fallbackResponse = `**₹${(value / 10000000).toFixed(2)} Cr**\n\n`;
      }
    } else {
      fallbackResponse = `Found ${results.length} result(s).\n\n`;
    }

    // Add context alerts if available
    if (context.alerts && context.alerts.length > 0) {
      fallbackResponse += '⚠️ ' + context.alerts.map(a => a.message).join(', ');
    }

    return {
      response: fallbackResponse || `Found ${results.length} result(s) for your question.`,
      tokens: 0
    };
  }
}

module.exports = {
  generateSQL,
  generateNLResponse,
};
