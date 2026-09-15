const POKE_COMPLETIONS_URL = 'https://poke.com/api/v1/chat/completions';
const ATHENA_MCP_URL = 'https://athena-mcp-server.morphylee22.workers.dev/mcp';

export const ATHENA_SYSTEM_PROMPT = `You are Athena, an investor-grade AI diligence and product strategy agent for Pitch Perfect.

Be rigorous, concise, and evidence-led. Help founders improve their pitch and understand their business. When evaluating a company, separate facts from assumptions, identify the highest-leverage risks, quantify where possible, and give actionable next steps. Never invent metrics, customers, market data, repository details, or financial facts. If information is missing, say so and use the available tools to investigate. Cite the source of repository, database, and web findings in your response. Prefer structured answers with a brief conclusion, key evidence, risks, and recommended actions.

You have access to Athena MCP tools for reading repositories, querying the product database, and web search. Use tools when the user asks about code, product behavior, stored data, competitors, markets, or any fact that cannot be answered from the conversation alone.`;

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string };
type Tool = { name: string; description?: string; inputSchema?: unknown };

async function mcpRequest(id: number, method: string, params: Record<string, unknown> = {}) {
  const response = await fetch(ATHENA_MCP_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  });
  if (!response.ok) throw new Error(`Athena MCP returned ${response.status}`);
  const text = await response.text();
  const line = text.split('\n').find((entry) => entry.startsWith('data:'))?.replace(/^data:\s*/, '') || text;
  const payload = JSON.parse(line);
  if (payload.error) throw new Error(payload.error.message || 'Athena MCP request failed');
  return payload.result;
}

async function getMcpTools(): Promise<Tool[]> {
  const result = await mcpRequest(1, 'tools/list');
  return result.tools || [];
}

async function callMcpTool(id: number, name: string, args: unknown) {
  return mcpRequest(id, 'tools/call', { name, arguments: args || {} });
}

export async function runAthena(messages: Message[], options: { apiKey?: string; model?: string } = {}) {
  const apiKey = options.apiKey || process.env.POKE_API_KEY || process.env.POKE_API_TOKEN;
  if (!apiKey) throw new Error('POKE_API_KEY is not configured');
  const tools = await getMcpTools();
  const conversation: Message[] = [{ role: 'system', content: ATHENA_SYSTEM_PROMPT }, ...messages];
  const pokeTools = tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description || tool.name, parameters: tool.inputSchema || { type: 'object', properties: {} } } }));

  for (let round = 0; round < 8; round += 1) {
    const response = await fetch(POKE_COMPLETIONS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: options.model || 'gpt-4o-mini', messages: conversation, tools: pokeTools, tool_choice: 'auto' }),
    });
    if (!response.ok) throw new Error(`Poke completions returned ${response.status}`);
    const payload = await response.json();
    const choice = payload.choices?.[0];
    if (!choice?.message) throw new Error('Poke completions returned no message');
    conversation.push(choice.message);
    const calls = choice.message.tool_calls || [];
    if (!calls.length) return { message: choice.message.content || '', usage: payload.usage };
    for (const call of calls) {
      let args: unknown = {};
      try { args = JSON.parse(call.function.arguments || '{}'); } catch { args = {}; }
      try {
        const result = await callMcpTool(round + 2, call.function.name, args);
        conversation.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify(result) });
      } catch (error) {
        conversation.push({ role: 'tool', tool_call_id: call.id, name: call.function.name, content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }) });
      }
    }
  }
  throw new Error('Athena exceeded the maximum tool-calling rounds');
}
