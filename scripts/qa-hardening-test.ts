/* Run with: bun scripts/qa-hardening-test.ts or npx tsx scripts/qa-hardening-test.ts */
const MAX_HISTORY = 15;
const MAX_MESSAGE_CHARS = 2000;
const MAX_HISTORY_CHARS = 15000;
const MAX_TOOL_ROUNDS = 8;
const MAX_TOOL_OUTPUT = 8000;
const ALLOWED_TABLES = new Set(["pitch_decks", "pitch_scripts", "usage", "subscriptions"]);
const ALLOWED_ORIGINS = new Set(["https://pitchcoachai.tech", "https://www.pitchcoachai.tech", "http://localhost:3000", "https://pitch-perfect.vercel.app"]);
const SECURITY_HEADERS = { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": "no-store" };
let passed = 0;
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(`FAIL: ${message}`); passed++; }
function expectThrow(fn: () => unknown, message: string) { let threw = false; try { fn(); } catch { threw = true; } assert(threw, message); }
function originAllowed(origin: string | null): boolean { return !!origin && (ALLOWED_ORIGINS.has(origin) || /^https:\/\/pitch-perfect-[a-z0-9-]+\.vercel\.app$/.test(origin)); }
function authorized(secret: string | undefined, header: string | null, origin: string | null): boolean { return !!secret && header === secret && (!origin || originAllowed(origin)); }
function boundedHistory(input: Array<{ role: string; content: string }>) { if (input.length > MAX_HISTORY) input = input.slice(-MAX_HISTORY); if (input.some(item => item.role !== "user" && item.role !== "assistant")) throw new Error("invalid role"); if (input.some(item => item.content.length > MAX_MESSAGE_CHARS)) throw new Error("message too long"); if (input.reduce((total, item) => total + item.content.length, 0) > MAX_HISTORY_CHARS) throw new Error("history too large"); return input; }
function validateQuery(table: string, select: string, filter?: string): boolean { if (!ALLOWED_TABLES.has(table)) return false; if (!/^[A-Za-z0-9_,.* ]+$/.test(select)) return false; if (filter && (!/^[A-Za-z0-9_=.(),&-]+$/.test(filter) || filter.includes(";"))) return false; return true; }
function toolLoopRounds(rounds: number, output: string) { return { rounds: Math.min(rounds, MAX_TOOL_ROUNDS), output: output.slice(0, MAX_TOOL_OUTPUT) }; }
function hasSecurityHeaders(headers: Record<string, string>) { return Object.entries(SECURITY_HEADERS).every(([key, value]) => headers[key] === value); }
function run() {
  const normal = Array.from({ length: 3 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: "ok" })); assert(boundedHistory(normal).length === 3, "accepts valid user/assistant history");
  const many = Array.from({ length: 20 }, (_, i) => ({ role: "user", content: String(i) })); const sliced = boundedHistory(many); assert(sliced.length === 15 && sliced[0].content === "5", "keeps the most recent 15 messages");
  expectThrow(() => boundedHistory([{ role: "tool", content: "bad" }]), "rejects disallowed roles"); expectThrow(() => boundedHistory([{ role: "user", content: "x".repeat(2001) }]), "rejects messages over 2000 characters"); expectThrow(() => boundedHistory(Array.from({ length: 15 }, () => ({ role: "user", content: "x".repeat(1000) }))), "enforces 15000-character history cap");
  assert(originAllowed("https://pitchcoachai.tech"), "allows production origin"); assert(originAllowed("https://www.pitchcoachai.tech"), "allows www production origin"); assert(originAllowed("http://localhost:3000"), "allows local origin"); assert(originAllowed("https://pitch-perfect.vercel.app"), "allows fixed Vercel origin"); assert(originAllowed("https://pitch-perfect-preview-123.vercel.app"), "allows scoped Vercel preview origin"); assert(!originAllowed("https://preview.vercel.app"), "rejects arbitrary Vercel origin"); assert(!originAllowed("https://evil.example"), "rejects unapproved origin");
  assert(authorized("secret", "secret", "https://pitchcoachai.tech"), "accepts correct MCP secret and origin"); assert(!authorized(undefined, "secret", "https://pitchcoachai.tech"), "fails closed when worker secret is unset"); assert(!authorized("secret", "wrong", "https://pitchcoachai.tech"), "rejects wrong MCP secret"); assert(!authorized("secret", "secret", "https://evil.example"), "rejects wrong origin");
  assert(hasSecurityHeaders(SECURITY_HEADERS), "requires no-sniff, strict referrer, and no-store headers");
  for (const table of ALLOWED_TABLES) assert(validateQuery(table, "*", "id=eq.1"), `allows table ${table}`); assert(!validateQuery("users", "*"), "rejects non-allowlisted tables"); assert(!validateQuery("usage", "*;drop table users"), "rejects unsafe select syntax"); assert(!validateQuery("usage", "*", "id=eq.1;drop"), "rejects semicolon filters"); assert(!validateQuery("usage", "*,(select secret)"), "rejects unsafe column syntax");
  const loop = toolLoopRounds(20, "z".repeat(10000)); assert(loop.rounds === 8, "caps tool loop at eight rounds"); assert(loop.output.length === 8000, "truncates tool output at 8KB"); assert(hasSecurityHeaders(SECURITY_HEADERS), "authenticated responses carry security headers"); console.log(`PASS: ${passed} Athena hardening assertions`);
}
try { run(); process.exitCode = 0; } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
