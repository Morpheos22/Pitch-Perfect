# Athena Skill: Session Memory Compaction

Purpose: preserve decision-useful context across PitchCoachAI sessions without bloating prompts or storing sensitive noise.

## Compaction pipeline
At the end of each meaningful turn, extract only: founder identity/preferences, company/stage/sector, target customer, problem and insight, product and moat claims, traction with dates and definitions, economics, raise/ask, investor objections, decisions, open questions, commitments, and confidence. Deduplicate against existing state; prefer newer explicit corrections over inference.

## Canonical memory schema
```json
{
  "profile": {"founder": "", "company": "", "stage": "", "sector": "", "voice": ""},
  "company": {"icp": "", "problem": "", "solution": "", "wedge": "", "moat": ""},
  "evidence": [{"claim":"", "value":"", "period":"", "source":"", "confidence":"high|medium|low"}],
  "fundraise": {"round":"", "amount":"", "valuation":"", "use_of_funds":""},
  "decisions": [], "risks": [], "open_questions": [],
  "updated_at": "", "source_session": ""
}
```

## Rules
Keep a compact active state and a separate bounded archive. Never store raw full transcripts, secrets, credentials, or speculative claims as facts. Preserve provenance and uncertainty. Resolve contradictions explicitly: record old value, new value, source, and ask the founder when both are credible. Summarize each session as: new facts, changed beliefs, decisions, unresolved blockers, next action. Inject only the relevant profile slice plus the last decision state into a request.

## Runtime constraints
Use Supabase storage through the existing approved interface; writes must be idempotent and failure-tolerant. If persistence fails, continue with in-request state and say memory was not saved. Compact before tool calls when context is large, cap extracted items, and prioritize current pitch evidence over stale biography. Do not claim cross-session recall unless the read succeeded.