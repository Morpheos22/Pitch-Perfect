---
Task ID: 1
Agent: Main
Task: Security fix footer bypass + wire up placeholder script uploader

Work Log:
- Analyzed two user screenshots showing security and functionality issues
- Deep audit of entire codebase: footer, homepage, all upload pages, all API routes
- Found 3 bugs across 3 files

Stage Summary:
- **Bug 1 (SECURITY)**: `src/components/layout/footer.tsx` — Product links had zero auth gating. Any visitor could click "Pitch Deck Analyser" etc. and hit a sign-in wall on protected routes. Fixed by wrapping product links in `<SignedIn>` (→ product page) / `<SignedOut>` (→ pricing page anchor).
- **Bug 2 (CRITICAL)**: `src/app/(dashboard)/elevator-pitch-live/script/new/page.tsx` — The `handleSubmit` was a placeholder: `setTimeout(() => router.push(...), 1500)` with NO API call, NO data sent, NO sessionId passed. User's script was silently discarded. Fixed by replacing with real `fetch("/api/coach/script", { method: "POST", body: JSON })` call matching the working standalone pattern from `elevator-script/new/page.tsx`.
- **Bug 3**: `src/app/(dashboard)/elevator-pitch-live/script/analysing/page.tsx` — Polled wrong API endpoint (`/api/coach/live` instead of `/api/coach/script`) and checked wrong response shape (`json.session` vs direct `json.status`). Fixed both.

Commit: 5c7eef7 pushed to main
Deployment: dpl_3XH5kGTjdeaFEHLTzD8rJSWRu5iW triggered on Vercel
Build: Clean — 0 errors, 0 warnings
