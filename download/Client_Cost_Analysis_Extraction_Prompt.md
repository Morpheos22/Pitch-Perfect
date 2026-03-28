# Cost Analysis Information Extraction Prompt

**Instructions:** Copy and paste the prompt below into your Claude or Gemini chat to extract all relevant cost analysis information from your previous conversations.

---

## PROMPT TO PASTE:

```
I need you to compile and summarize ALL information related to cost implication analysis from our entire conversation history. This is for a pitch coaching platform called PitchCoach AI that I'm building. Please extract and organize the following:

## 1. INFRASTRUCTURE COSTS
- Hosting/deployment costs discussed (Vercel, alternatives)
- Database costs (Supabase, PostgreSQL pricing tiers)
- Storage costs (Cloudflare R2, file storage estimates)
- Video hosting/streaming costs (Cloudflare Stream, alternatives)
- CDN and bandwidth costs
- Any cost comparisons between providers

## 2. AI/ML COSTS
- Claude API costs (per token pricing, estimated usage)
- Gemini API costs (video processing, per-token pricing)
- Expected AI costs per user session
- Estimated monthly AI costs at different user scales
- Any cost optimization strategies discussed

## 3. AUTHENTICATION & SECURITY
- Clerk authentication pricing
- Any security-related costs discussed

## 4. PAYMENT PROCESSING
- Stripe fees and pricing
- Paystack fees for African markets
- Transaction costs at different price points
- Any payment processing recommendations

## 5. PRICING STRATEGY
- Recommended subscription pricing ($/month)
- Tiered pricing suggestions
- Freemium vs paid model discussions
- Target market pricing considerations
- Price point analysis for sustainability

## 6. USER SCALE PROJECTIONS
- Cost per user estimates
- Break-even analysis
- Cost projections at different user counts (100, 1000, 10000 users)
- Resource scaling recommendations

## 7. MONTHLY OPERATING COSTS
- Fixed monthly costs identified
- Variable costs based on usage
- Minimum viable budget to run the platform
- Cost breakdown percentages

## 8. SPECIFIC NUMBERS & CALCULATIONS
- Any specific dollar amounts mentioned
- Formula or calculations for cost estimates
- ROI projections
- User acquisition cost discussions

## 9. COST OPTIMIZATION STRATEGIES
- Ways to reduce costs discussed
- Alternative solutions considered
- Trade-offs between cost and quality

## 10. RISK FACTORS
- Cost-related risks identified
- Hidden costs mentioned
- Budget overrun scenarios

---

Please be as specific as possible with numbers, percentages, and calculations. If you mentioned specific pricing tiers, provider names, or cost estimates, include those exactly. Organize the output clearly so I can share it with my development partner for their own cost analysis work.
```

---

## WHAT THIS PROMPT WILL EXTRACT:

This prompt is designed to pull out:
1. **Hard numbers** - Exact dollar amounts, percentages, and pricing tiers discussed
2. **Provider comparisons** - Specific recommendations for hosting, AI, storage
3. **Scaling projections** - How costs change with user growth
4. **Pricing recommendations** - What subscription price points were suggested
5. **Cost formulas** - Any calculations used to derive estimates

## AFTER YOUR CLIENT RESPONDS:

Ask them to share the complete output with you. This will give you:
- Baseline data to validate against your own analysis
- Any cost factors you might have missed
- Provider-specific pricing details
- Real-world cost expectations

---

## TECHNICAL CONTEXT FOR YOUR ANALYSIS:

Based on the current PitchCoach AI architecture, here are the actual specs your client's cost analysis should align with:

| Component | Provider | Pricing Model |
|-----------|----------|---------------|
| Hosting | Vercel Pro | $20/month base |
| Database | Supabase Pro | $25/month base |
| Auth | Clerk | Free tier, then $25/month |
| File Storage | Cloudflare R2 | $0.015/GB storage, $4.50/million requests |
| Video | Cloudflare Stream | $5/1000 min stored, $1/1000 min delivered |
| AI Text | Claude Sonnet | $3/million input, $15/million output tokens |
| AI Video | Gemini Flash | Free tier available, then per-call pricing |
| Payments | Stripe | 2.9% + $0.30 per transaction |
| Payments | Paystack | 1.5% + ₦100 (Nigeria), varies by country |

Your client's conversation data will help refine these estimates with real usage projections.
