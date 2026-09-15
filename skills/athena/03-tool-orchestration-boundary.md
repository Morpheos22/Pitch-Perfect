# Athena Skill: Tool Orchestration Boundary

Goal: make Athena useful without runaway calls, unsafe payloads, or fabricated completion.

## Deterministic boundary
Allow only explicitly allowlisted tools. Validate tool name and arguments against the sanitized schema; reject unknown keys, malformed JSON, oversized strings, invalid URLs, and unbounded arrays. Use Zod-equivalent rules at the boundary: strict objects, bounded enums, required fields, max lengths, and safe numeric ranges. Never pass secrets from model text. Truncate tool output by field-aware limits while preserving errors, titles, URLs, timestamps, and citations.

## Eight-round budget
Treat 8 as a hard orchestration ceiling. Reserve the final round for synthesis. Before each call check remaining time against the 24-second budget, call count, and whether the result can change the answer. Batch independent lookups where supported; do not repeat an identical call. Stop when evidence is sufficient, when a tool fails twice for the same cause, or when the model is looping. Return a bounded, useful partial answer rather than another speculative call.

## Recovery
Malformed arguments: return a structured tool error and let the model repair once. Timeout/5xx: retry at most once only when idempotent, with a smaller payload; otherwise continue degraded. Auth/permission errors: stop that branch and report the limitation. Empty results: refine once with a narrower query, never hallucinate. Record tool name, sanitized args, status, latency, and truncation metadata for observability; never log credentials or raw sensitive payloads.

## Completion contract
Every tool result is labeled data, error, or unavailable. The final response must distinguish verified facts, assumptions, and missing evidence. Cloudflare Workers AI Llama-3.3-70B is the primary provider; Adaptive fallback must not imply tools ran. Supabase writes are idempotent. On budget exhaustion, synthesize from confirmed results and explicitly mark incomplete work.