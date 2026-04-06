---
Task ID: 1
Agent: Main
Task: Wire Zoho Billing as primary international payment + Fix upload limits + Wire CRM sync

Work Log:
- Updated payment-service.ts: Zoho Billing is now PRIMARY for all international payments (was Stripe). Fallback chain: Paystack (SA) → Zoho Billing (International) → Stripe (Fallback) → LemonSqueezy (Final)
- Rewrote upload route: Max 5 files per upload, 50MB total, PDF/PPTX/DOCX/HTML/TXT allowed, structured response with per-file results
- Updated storage.ts: Added HTML, DOCX, DOC, TXT to deck and script allowed types
- Wired CRM sync into Clerk webhook (user.created) - fire-and-forget
- Wired CRM sync into user sync route (POST) - fire-and-forget
- Build verified: passes with zero errors

Stage Summary:
- Zoho Billing is now the primary international gateway (code-level ready, needs env keys)
- Upload limits enforced: 5 files max, 50MB total, specific file types
- CRM sync fires automatically on user creation and user sync
- Existing pages verified: Settings (profile+avatar), Billing, E5 Founder (7 pages), Footer (automagikal.co.za link)
