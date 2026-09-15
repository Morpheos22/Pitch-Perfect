# Athena Skill: Market Intelligence Search

Purpose: give PitchCoachAI current, decision-useful market evidence for pitch coaching and diligence.

## Query design
Translate the question into entity, market, geography, time window, metric, and desired evidence. Generate two to four targeted queries: primary source (company filing, regulator, official pricing), specialist source (industry report or credible research), competitor query, and disconfirming query. Add exact terms such as pricing, customers, funding, retention, launch, regulatory, hiring, or acquisition; avoid vague “best market” searches.

## Signal extraction
For each result capture claim, number, unit, period, geography, source type, publication date, and confidence. Separate fact from analyst interpretation. For competitors compare ICP, wedge, pricing, distribution, funding, product capability, and recent momentum; distinguish announced from shipped and marketing claims from measured adoption. For TAM/SAM/SOM reconcile scope, methodology, currency, and double counting. Prefer trends and changes over isolated headlines.

## Validation and synthesis
Triangulate material claims with two independent sources when possible. Prefer primary sources, then reputable specialist reporting; flag paywalls, stale data, anonymous claims, copied press releases, and methodology gaps. Preserve exact source URLs and access dates. Never infer market share from search rank or funding from valuation headlines.

Return: question, key signals, evidence table, competitor implications, pitch implication, uncertainty, and source list. If evidence conflicts, show both values and explain why. Keep search bounded for the 24-second runtime: search in parallel, extract only the most relevant pages, and stop when the decision threshold is met. Web results are not permission to invent facts or to store unverified claims in Supabase.