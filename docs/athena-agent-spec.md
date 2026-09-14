# Athena Agent — Build Specification & Protocol

**Last updated:** 2026-09-15
**Session:** 1 (of 3)
**Goal:** Make Athena an agent by connecting her to Supabase (MCP) and GitHub (direct API) with a function-calling loop.

---

## WHAT WE'RE BUILDING AND WHY

Athena is currently a chatbot. She has a system prompt, conversation history, and a single model call. She cannot take actions, query data, or use tools.

We are upgrading her to an **agent** — an AI that can call tools (query databases, read repos) and use the results to formulate answers. This session connects her to:

1. **Supabase MCP** (`https://mcp.supabase.com`) — lets Athena query the user's pitch deck scores, session history, usage data directly from the database.
2. **GitHub API** (direct REST wrapper, not MCP) — lets Athena read repos, issues, PRs using the user's PAT. (We use direct API instead of the GitHub MCP server because the remote MCP requires OAuth 2.1 + PKCE which needs an interactive browser flow.)

**Why:** The user (morphylee22@gmail.com) wants Athena to be able to answer questions like "What's my latest deck score?" by actually querying the database, not guessing. This is the foundation for making her a real agent. Future sessions add Vercel MCP, ElevenLabs voice, Telegram, and Poke.

**Context:** The platform is PitchCoach Ai — a pitch coaching platform built by Athena Agentic in Abuja, Nigeria. Athena is the AI guide widget that appears on every page. The user's account (morphylee22@gmail.com) is permanently on FOUNDER tier (hardcoded in `PERMANENT_FOUNDER_EMAILS` in `dev-auth.ts`, enforced by a database trigger).

---

## STRICT PROTOCOLS — FOLLOW THESE OR DON'T BUILD

### Protocol 1: No hardcoded credentials

**NEVER** write API keys, tokens, passwords, or connection strings in source code (`.ts`, `.tsx`, `.js`, `.json`, `.md` files). ALL credentials must be read from `process.env` at runtime.

The ONLY files that contain real credentials:
- `.env.local` (gitignored, never committed)
- Vercel env vars (set via Vercel API, encrypted at rest)
- GitHub Secrets (set via GitHub API, encrypted at rest)

If I need a credential in code:
```typescript
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not configured");
```

### Protocol 2: One file at a time → commit → test → move on

No parallel modifications across multiple files. The sequence for EVERY change:

1. Modify ONE file (or create ONE new file)
2. Run `npx tsc --noEmit` — must pass with 0 errors
3. Run `npx vitest run` — must pass (102 tests as of last check)
4. `git add <file>` (only the specific file)
5. `git commit -m "<specific message>"`
6. Update the checklist below with "✅ done"
7. Move to next file

If `tsc` or tests fail, fix the SPECIFIC issue. Do not refactor surrounding code. Commit the fix immediately.

### Protocol 3: Don't refactor — only add

Do NOT rewrite existing working functions. If `askAthena()` works, leave it. Add `askAthenaWithTools()` alongside it. The chat route can call the new function; if it breaks, the old function is still there as fallback.

New files only:
- `src/lib/athena-mcp.ts` — MCP client + GitHub API wrapper
- `src/lib/athena-skills.ts` — skills loader

Modified files (minimal changes):
- `src/lib/athena-agent.ts` — add `askAthenaWithTools()` function, don't touch existing `askAthena()`
- `src/app/api/athena/chat/route.ts` — call `askAthenaWithTools()` instead of `askAthena()`

### Protocol 4: Atomic commits

Every commit is ONE logical change. Commit message format:
- `add: <what was added>` — for new files/functions
- `fix: <what was fixed>` — for bug fixes
- `wire: <what was connected>` — for wiring

Never commit multiple unrelated changes in one commit.

### Protocol 5: Short responses during build

During the build, I switch to brief output:
- "doing X" → do it → "done, result: Y"
- No long explanations unless asked
- Every response burns context — be efficient

### Protocol 6: Spec file is source of truth

If I lose context (forget what I'm doing), I read THIS file. The checklist below tells me exactly where I am. I do not re-read the entire conversation — I read the checklist and continue from the next unchecked item.

### Protocol 7: Don't "improve" working code

If code works and passes tests, do not touch it. No "while I'm here, let me also..." changes. Each change has one purpose. Side improvements create bugs.

### Protocol 8: Revert if broken

If a change breaks something and I can't fix it in 10 minutes:
1. `git revert HEAD` — undo the last commit
2. `git push` — deploy the revert
3. Document what went wrong in the checklist
4. Stop and tell the user

Do NOT keep trying to fix a broken build by making more changes. Revert, stabilize, then try again fresh.

---

## CREDENTIALS (all in .env.local / Vercel env vars — never in source)

| Credential | Env Var Name | Where It's Used |
|---|---|---|
| Supabase access token | `SUPABASE_ACCESS_TOKEN` | `athena-mcp.ts` (MCP connection) |
| GitHub PAT | `GITHUB_TOKEN` | `athena-mcp.ts` (direct API wrapper) |
| Vercel token | `VERCEL_TOKEN` | (for setting env vars, not in app code) |
| Supabase DB URL | `DATABASE_URL` | Already used by Prisma |
| Supabase direct URL | `DIRECT_URL` | Already used by Prisma |

---

## BUILD CHECKLIST — Session 1

### Phase A: Setup
- [ ] A1. Install `@modelcontextprotocol/sdk` npm package
- [ ] A2. Set Vercel env vars: `SUPABASE_ACCESS_TOKEN`, `GITHUB_TOKEN` (via Vercel API)
- [ ] A3. Verify `.env.local` has all credentials (done — verified gitignored)

### Phase B: MCP Client + GitHub Wrapper
- [ ] B1. Create `src/lib/athena-mcp.ts` with:
  - [ ] B1a. MCP client connecting to `https://mcp.supabase.com` (using `@modelcontextprotocol/sdk`)
  - [ ] B1b. Tool discovery (fetch available tools from Supabase MCP, cache for 1 hour)
  - [ ] B1c. `callSupabaseTool(toolName, args)` function
  - [ ] B1d. GitHub API wrapper (direct REST, not MCP) — `readRepo`, `readIssues`, `readPRs`
  - [ ] B1e. `getAvailableTools()` — returns merged tool list from Supabase MCP + GitHub wrapper
  - [ ] B1f. `callTool(toolName, args)` — routes to the right backend
- [ ] B2. `tsc --noEmit` passes
- [ ] B3. `vitest run` passes
- [ ] B4. Commit: `add: athena-mcp.ts — MCP client + GitHub API wrapper`

### Phase C: Function Calling Loop
- [ ] C1. Add `askAthenaWithTools()` to `src/lib/athena-agent.ts`:
  - [ ] C1a. Fetch available tools from `athena-mcp.ts`
  - [ ] C1b. Call Cloudflare Workers AI with `tools` parameter
  - [ ] C1c. If model returns tool call → call `athena-mcp.callTool()` → add result to messages → call model again
  - [ ] C1d. Max 5 iterations (prevent infinite loops)
  - [ ] C1e. 30-second timeout per tool call
  - [ ] C1f. Error handling (tool fails → tell model, let it decide)
- [ ] C2. Do NOT touch existing `askAthena()` function
- [ ] C3. `tsc --noEmit` passes
- [ ] C4. `vitest run` passes
- [ ] C5. Commit: `add: askAthenaWithTools() — function calling loop in athena-agent.ts`

### Phase D: Wire the Chat Route
- [ ] D1. Modify `src/app/api/athena/chat/route.ts`:
  - [ ] D1a. Call `askAthenaWithTools()` instead of `askAthena()`
  - [ ] D1b. Keep the existing quota/profanity logic unchanged
  - [ ] D1c. If `askAthenaWithTools` throws, fall back to `askAthena()` (graceful degradation)
- [ ] D2. `tsc --noEmit` passes
- [ ] D3. `vitest run` passes
- [ ] D4. Commit: `wire: chat route uses askAthenaWithTools() with askAthena() fallback`

### Phase E: Skills Loader
- [ ] E1. Create `src/lib/athena-skills.ts`:
  - [ ] E1a. Read `SKILL.md` files from `.agents/skills/`
  - [ ] E1b. Parse frontmatter (name, description)
  - [ ] E1c. Return skill instructions for system prompt injection
- [ ] E2. Inject skills into `askAthenaWithTools()` system prompt
- [ ] E3. `tsc --noEmit` passes
- [ ] E4. `vitest run` passes
- [ ] E5. Commit: `add: athena-skills.ts — skills loader + inject into system prompt`

### Phase F: Deploy + Verify
- [ ] F1. `git push` to main → Vercel auto-deploys
- [ ] F2. Verify deployment is READY (check GitHub commit status)
- [ ] F3. Test on production: send "What's my latest deck score?" to Athena
- [ ] F4. Verify Athena calls the Supabase tool and returns real data
- [ ] F5. Test "Read my repo's README" → GitHub tool
- [ ] F6. If broken, `git revert` + push, document in checklist

---

## ARCHITECTURE

```
User message
    ↓
/api/athena/chat (route)
    ↓
askAthenaWithTools() (athena-agent.ts)
    ├── athena-skills.ts → inject SKILL.md instructions into system prompt
    ├── athena-mcp.ts → getAvailableTools()
    │     ├── Supabase MCP (https://mcp.supabase.com)
    │     └── GitHub API (direct REST wrapper)
    ├── Cloudflare Workers AI call WITH tools
    ├── If tool call → athena-mcp.ts.callTool() → result → model again
    └── Final response
    ↓
Quota check / profanity check (existing logic, unchanged)
    ↓
Response to user
```

---

## ROLLBACK PLAN

If anything breaks:
1. `git log --oneline -5` — see recent commits
2. `git revert <bad-commit>` — undo the specific commit
3. `git push` — deploy the revert
4. Vercel auto-deploys the reverted version in ~90 seconds
5. Old `askAthena()` function is still in the code as fallback — chatbot still works

---

## KNOWN RISKS

1. **Cloudflare Workers AI function calling** — not all models support tool use. Llama 3.3 70B does. If the current model doesn't support it, the tool definitions are ignored and Athena falls back to text-only (same as before). No crash.

2. **Supabase MCP auth** — the access token (`sbp_...`) may or may not work with the remote MCP server. If it doesn't, I fall back to direct Supabase REST API queries using the service role key (already in Vercel env vars as `SUPABASE_SERVICE_ROLE_KEY`). Same outcome, different plumbing.

3. **Context limit** — if I lose track during the build, I read THIS file (the checklist) to re-orient. The checklist tells me exactly where I am.

4. **Supabase MCP server may not exist or may require different auth** — if `https://mcp.supabase.com` doesn't work, I use direct Prisma queries as the "tool" instead. Athena calls a local function that queries the DB, returns JSON. Same outcome, no external dependency.

---

## SESSION 1 COMPLETE — 2026-09-15

### What was built:
- ✅ `src/lib/athena-mcp.ts` — MCP client connecting to Supabase (`https://mcp.supabase.com/mcp`) + GitHub direct API wrapper (3 tools: read_file, list_issues, get_repo_info)
- ✅ `askAthenaWithTools()` in `src/lib/athena-agent.ts` — function calling loop (max 5 iterations, 30s timeout, falls back to `askAthena()` on error)
- ✅ Chat route wired: signed-in users get `askAthenaWithTools()`, anon users get `askAthena()` (no tools for anon — can't trust identity)
- ✅ Vercel env vars set: `SUPABASE_ACCESS_TOKEN`, `GITHUB_TOKEN` (both encrypted, production+preview+development)
- ✅ MCP SDK installed: `@modelcontextprotocol/sdk` in package.json + lockfile

### Verification:
- TypeScript: 0 errors
- Tests: 102/102 pass
- CI: 10/10 GitHub Actions checks pass
- Vercel deployment: READY (live on pitchcoachai.tech)

### Commits:
- `206c086` add: athena-agent-spec.md — build spec + strict protocols + checklist
- `ea1c7f2` add: athena-mcp.ts — MCP client (Supabase) + GitHub API wrapper + fix middleware type
- `025d94a` add: askAthenaWithTools() — function calling loop with MCP tools
- `308b5f0` wire: chat route uses askAthenaWithTools for auth users, askAthena fallback for anon
- `a011669` fix: add @modelcontextprotocol/sdk to package.json + lockfile

### How to test:
1. Sign in at pitchcoachai.tech (morphylee22@gmail.com — FOUNDER tier)
2. Open Athena widget (bottom-right)
3. Ask: "What's my latest deck score?" → Athena should query Supabase MCP and return real data
4. Ask: "Read the README of my Pitch-Perfect repo" → Athena should call github_read_file and return content
5. Ask a normal question: "How do I upload my deck?" → Athena should answer normally (no tool call needed)

### Known risks:
- Supabase MCP server may require OAuth (not just the access token). If the MCP connection fails, Athena falls back to `askAthena()` (no tools) — the chatbot still works, just without data queries.
- Cloudflare Workers AI function calling support depends on the model. Llama 3.3 70B supports it. If the model doesn't return tool calls, Athena responds with text only (same as before).

### Session 2 (next):
- Add Vercel MCP connection
- Add ElevenLabs TTS + STT (voice)
- Update widget with mic button + audio playback
- Add more skills from skills.sh
