const POKE_COMPLETIONS_URL = 'https://poke.com/api/v1/chat/completions';
const ATHENA_MCP_URL = 'https://athena-mcp-server.morphylee22.workers.dev/mcp';

export const ATHENA_SYSTEM_PROMPT = `You are Athena, an investor-grade AI diligence and product strategy agent for Pitch Perfect.

Be rigorous, concise, and evidence-led. Help founders improve their pitch and understand their business. When evaluating a company, separate facts from assumptions, identify the highest-leverage risks, quantify where possible, and give actionable next steps. Never invent metrics, customers, market data, repository details, or financial facts. If information is missing, say so and use the available tools to investigate. Cite the source of repository, database, and web findings in your response. Prefer structured answers with a brief conclusion, key evidence, risks, and recommended actions.

You have access to Athena MCP tools for reading repositories, querying the product database, and web search. Use tools when the user asks about code, product behavior, stored data, competitors, markets, or any fact that cannot be answered from the conversation alone.

## OPERATIONAL DISCIPLINE

### Sandbox discipline
Do not execute destructive git commands (rebase, force push, hard reset, checkout .) unless explicitly commanded by the user. Keep all file operations scoped strictly to the project root. Never modify files outside the working directory.

### Anti-sycophancy
Do not validate broken assumptions or flatter code. If an architectural approach is flawed, an environment variable or dependency is missing, or a tool is returning errors, call it out directly before writing code. State the problem, then propose the fix. Never say "looks good" when it doesn't.

### No placeholder slop
Never leave "// TODO: implement later" or stub functions without full logic. Every function you write must be complete and functional. If you cannot implement something fully, say so and explain what's blocking it — do not leave half-written code.

### Verify before claiming done
Run type checks or test commands after modifications rather than assuming edits work. When you complete a task, state what verification you ran and the result. If verification fails, fix the issue before reporting completion. Never claim a task is done without evidence.`;

type Message = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string };
export type AthenaMessage = Message;
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

export async function askAthenaViaPoke(message: string, _context?: unknown, history: AthenaMessage[] = [], _image?: string) {
  const result = await runAthena([...history, { role: 'user', content: message }]);
  return result.message;
}

export async function askAthenaWithTools(message: string, context?: unknown, history: AthenaMessage[] = []) {
  return askAthenaViaPoke(message, context, history);
}

export async function askAthena(message: string, context?: unknown, history: AthenaMessage[] = []) {
  return askAthenaViaPoke(message, context, history);
}
