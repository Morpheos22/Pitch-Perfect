# Athena Public-Page Cap — Operator Runbook

**What code already does:**
- Anonymous visitors: 5 messages / 6 hours per IP+device fingerprint.
- Signed-in users: 40 messages / 6 hours per user.
- Anon concurrency cap: max 3 in-flight anon Athena requests per Vercel edge instance → 503 with `Retry-After` for excess anon traffic; auth requests always bypass.
- When the anon cap is hit, the widget returns **HTTP 402** with `requiresSignIn: true` and renders a sign-up / sign-in CTA. The input is disabled until the user signs in.
- Soft nudge at ≤2 messages remaining: "Sign up free for unlimited access."
- The widget calls `GET /api/athena/quota` on open to render remaining count before the user types.
- `/api/athena/chat` and `/api/athena/quota` are in the public-routes matcher so anon users can reach them; they're excluded from the middleware's generic 120/min `/api/` cap so the tiered quota owns the limit.

**What only the operator can do (this runbook):**

---

## 1. Cloudflare WAF — hard IP-based cap (defense-in-depth)

The app-level cap is per-edge-instance. A determined attacker rotating across Vercel edge instances could get ~2–3× the cap before the in-memory windows sync. A Cloudflare WAF rule makes the cap global.

**Steps:**

1. Cloudflare dashboard → **Security → WAF → Rate limiting rules → Create rule**.
2. Name: `Athena anon cap — 10 req / 10 min / per IP`.
3. **If incoming requests match:**
   - Field: `URI Path`
   - Operator: `equals`
   - Value: `/api/athena/chat`
   - **AND**
   - Field: `Cf-Jwt-Claims` (or `Cookie: __session`) → *does not exist* (i.e., anon)
     - If you can't key on auth state, skip this AND — the rule will hit auth too, but auth users have their own higher cap so a 10/10min WAF cap is still well above their usage.
4. **Characteristics:** `IP Address`.
5. **Period:** 10 minutes.
6. **Threshold:** 10 requests (gives a small buffer above the app's 5/6h cap so legitimate double-clicks don't trip).
7. **Action:** `Block` for 10 minutes.
8. Save → deploy.

**Companion rule for the quota peek endpoint** (so attackers can't DOS it):

- Path: `/api/athena/quota`
- Threshold: 30 req / 10 min / per IP
- Action: `Block` for 10 minutes

---

## 2. Cloudflare KV — distributed quota store (optional, hardens the cap)

The app's in-memory store is per-edge-instance. KV gives you a globally consistent counter. **Only do this if you observe abuse in the wild** — the in-memory cap is fine for 99% of traffic.

**Steps:**

1. Cloudflare dashboard → **Workers & Pages → KV → Create namespace**.
2. Name: `ATHENA_QUOTA`.
3. Note the namespace ID — you'll need it for any worker that reads/writes.
4. (Optional) Create a small Worker that increments `athena:anon:{ip}:{hour}` on every chat request and returns 429 if the value exceeds 5. Bind it as a `before`-hook via **Workers Routes** for `/api/athena/chat`.
5. Set TTL on each key to 6 hours (21600 seconds).

**Skip this if:** your Vercel analytics show <100 anon Athena requests/day. The in-memory cap is enough.

---

## 3. Cloudflare Analytics — alert on abuse

So you know when to actually tighten the cap.

**Steps:**

1. Cloudflare dashboard → **Analytics & Logs → Workers Analytics** (if using Workers) or **Web Analytics** (if just CDN).
2. Create a filter: `URI Path = /api/athena/chat`.
3. Save as a custom dashboard.
4. Set an alert:
   - **Trigger:** requests to `/api/athena/chat` > 500 in 1 hour.
   - **Channel:** email to `Metron@Athenagentic.app`.
5. Repeat for `/api/athena/quota` with a threshold of 1000/hour.

---

## 4. Vercel logs — verify the cap is firing

After deploying the code, watch Vercel logs to confirm the 402 / 429 responses are being returned as expected.

**Steps:**

1. Vercel dashboard → your project → **Logs**.
2. Filter: `path = /api/athena/chat`.
3. Watch for:
   - `402` responses with header `X-Athena-Requires-SignIn: 1` → anon cap working.
   - `429` responses with `X-Athena-Tier: anon` → concurrency cap or anon rate limit working.
   - `429` responses with `X-Athena-Tier: auth` → an auth user hit 40/6h (rare — investigate if it fires often).
4. If you see **zero** 402/429s in 24 hours and traffic is normal, the cap is probably too loose. If you see thousands, it's too tight or under attack — adjust `ATHENA_QUOTA` in `src/lib/athena-quota.ts`.

---

## 5. Adjust the caps (no redeploy needed if using env vars)

The caps are currently hard-coded in `src/lib/athena-quota.ts`:

```ts
ANON:  { limit: 5,  windowMs: 6 * 60 * 60 * 1000 }
AUTH:  { limit: 40, windowMs: 6 * 60 * 60 * 1000 }
ANON_CONCURRENCY_CAP: 3
```

**To change without code edit (future enhancement):** wire these to `process.env.ATHENA_ANON_LIMIT` etc. and read at module load. Today: editing the file and redeploying takes ~2 minutes via Vercel auto-deploy on `main` push.

**Recommended tuning after first week of real traffic:**

| Metric | Tighten if… | Loosen if… |
|---|---|---|
| Anon limit (5) | >5% of anon users hit the cap and bounce | <1% hit the cap and you want more lead-gen |
| Auth limit (40) | Any auth user hits it in normal use | Never — 40/6h is generous |
| Anon concurrency (3) | 503s appear in logs during normal traffic | You see queueing latency >2s on anon requests |

---

## 6. Clerk — verify the sign-in CTA actually converts

The widget surfaces "Sign up free" → `/sign-up` and "Sign in" → `/sign-in` when the anon cap is hit. Track conversion:

**Steps:**

1. Clerk dashboard → **Users → Sign-up attempts**.
2. Filter by **referrer contains** `athena-cap` (you'll need to add `?ref=athena-cap` to the sign-up link in `athena-widget.tsx` first — minor code change).
3. Compare sign-ups from this referrer vs. total sign-ups over 7 days.
4. If conversion is <2%, consider raising the anon cap to 7 or 8 — the friction is hurting acquisition more than it's saving AI costs.

---

## 7. Cloudflare AI — monitor Workers AI quota burn

Athena calls Cloudflare Workers AI (`@/lib/cloudflare-ai.ts`). Even with the app cap, a coordinated attack could burn your daily Workers AI allowance.

**Steps:**

1. Cloudflare dashboard → **Workers & Pages → your worker → Metrics**.
2. Look at **AI Inference calls** over the last 24 hours.
3. Set a daily budget alert in **Cloudflare → Workers AI → Settings → Usage limits**:
   - **Daily neuron budget:** 1000 neurons (or whatever your plan allows).
   - **Action when exceeded:** `Block further AI calls` (not `Allow and bill`).
4. This is the ultimate kill-switch — even if the app cap fails, Cloudflare will cut off AI inference at the platform level.

---

## 8. Incident response — Athena is being abused

If you see a spike in Athena traffic that the cap isn't containing:

1. **Immediate:** Cloudflare WAF → add a manual block rule for the offending IP(s) or ASN.
2. **Short-term:** Lower `ATHENA_QUOTA.ANON.limit` to `2` and `ANON_CONCURRENCY_CAP` to `1` in `src/lib/athena-quota.ts`. Push to `main` — Vercel auto-deploys in ~90 seconds.
3. **Nuclear:** Set `MAINTENANCE_FORCE_ON = true` in `src/middleware.ts` and push. This takes the whole site offline (including Athena) until you flip it back. Use only if the abuse is also hitting other endpoints.
4. **Post-incident:** Review Vercel logs, identify the IP/UA pattern, add it to `BLOCKED_USER_AGENTS` in `src/lib/security.ts` if it's a new scraper signature.

---

## 9. Rollback

If the tiered cap breaks something (e.g., auth users can't chat):

1. Revert commit on `main` — Vercel auto-deploys the previous version.
2. Or: in `src/app/api/athena/chat/route.ts`, change the quota check to always `allowed: true` for auth users (comment out the `checkAthenaQuota` call for tier `auth`).
3. Verify on the production site that signed-in users can chat.

---

*Last updated: 2026-09-14. Code changes in `feat/athena-public-cap` commit.*
