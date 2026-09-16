export type AthenaResponseCategory = "diligence" | "coaching" | "objection" | "navigation";
export type AthenaResponse = { id: string; category: AthenaResponseCategory; intent: string; response: string };

const variants = [
  ["company-overview", "diligence", "company overview", "Start with the problem, the customer, and the evidence that this team can win. I’ll separate what the company has proved from what it still needs to validate."],
  ["market-size", "diligence", "market sizing", "A credible market case needs a clear customer, bottom-up assumptions, and a path from today’s wedge to a larger opportunity. Let’s test each step rather than rely on a headline number."],
  ["competition", "diligence", "competition", "Competition is not automatically a weakness. The useful question is why customers choose this solution now, and what becomes harder for others to copy as the company grows."],
  ["traction", "diligence", "traction", "I’ll look beyond a single growth figure: retention, conversion, revenue quality, customer concentration, and the operating drivers behind the result matter just as much."],
  ["unit-economics", "diligence", "unit economics", "Let’s connect acquisition cost, payback, gross margin, retention, and pricing. If one input is missing, I’ll mark it as an open diligence question instead of guessing."],
  ["team", "diligence", "team", "A strong team case explains why these founders understand the problem, what they have learned, and which capabilities they still need to add."],
  ["moat", "diligence", "defensibility", "A moat should be concrete: proprietary data, workflow depth, distribution, switching costs, network effects, or execution advantages that strengthen with use."],
  ["risks", "diligence", "risk review", "The goal is not to eliminate risk; it is to name the material risks, show what evidence would change the view, and identify the next practical mitigation."],
  ["e1", "coaching", "E1 pitch deck", "For E1, make every slide earn its place. I’ll focus on narrative flow, problem clarity, proof, economics, design hierarchy, and whether an investor can follow the argument quickly."],
  ["e2", "coaching", "E2 script check", "For E2, we’ll tighten the spoken story: who has the problem, why now, what you built, why you can win, and what you want the listener to do next."],
  ["e3", "coaching", "E3 live pitch", "For E3, clarity is only half the job. We’ll work on pace, emphasis, eye line, confidence, and the moments where delivery either builds or loses trust."],
  ["e4", "coaching", "E4 full session", "E4 is the deeper rehearsal. I’ll connect your deck, script, delivery, and investor-readiness signals so the feedback becomes a prioritized improvement plan."],
  ["e5", "coaching", "E5 founder coaching", "E5 is about the founder behind the pitch: your decision, pathway, investor questions, and the next milestone that will create the most leverage."],
  ["pricing", "coaching", "pricing", "Pricing should reflect the value created and the buyer’s ability to adopt. I’ll help you explain the model simply, then pressure-test willingness to pay and expansion."],
  ["traction-story", "coaching", "traction story", "Turn traction into a story, not a scoreboard: what changed, why it changed, what you learned, and how the next milestone follows from the evidence."],
  ["too-expensive", "objection", "price objection", "That objection is useful information. Clarify what the buyer compares you with, quantify the cost of the current problem, and make the value of switching concrete."],
  ["not-now", "objection", "timing objection", "When someone says ‘not now,’ learn whether the issue is urgency, budget, trust, or priority. Each cause needs a different response and a different follow-up."],
  ["crowded-market", "objection", "crowded market", "A crowded market can validate demand. Your answer should narrow to the customer you serve best and the insight or distribution advantage that makes your entry credible."],
  ["no-revenue", "objection", "pre-revenue", "Pre-revenue is not disqualifying, but the proof must change: show customer discovery, pilots, usage, commitments, or a measurable path to validation."],
  ["ai-risk", "objection", "AI risk", "Address AI risk directly: reliability, privacy, workflow impact, and human oversight. A thoughtful limitation is more credible than claiming the model is always right."],
  ["open-dashboard", "navigation", "open dashboard", "Open your dashboard to review saved analyses, compare sessions, and continue from your latest coaching work."],
  ["choose-module", "navigation", "choose a module", "Choose E1 for a deck, E2 for a script, E3 for live delivery, E4 for a full rehearsal, or E5 for founder-level strategy and next steps."],
  ["upload-deck", "navigation", "upload a deck", "Use E1 and upload your PDF or PPTX. Athena will review the story, slide structure, visual hierarchy, and investor-readiness signals."],
  ["view-scores", "navigation", "view scores", "Your results are available in the dashboard after processing. Review the score alongside the evidence and recommendations rather than treating the number alone as the verdict."],
  ["upgrade", "navigation", "upgrade plan", "Visit Pricing to compare JJC, Intern, Cofounder, and Founder. Choose based on how many sessions and how much depth you need; plans are one-time payments."],
  ["account-help", "navigation", "account help", "For sign-in, password, passkey, or account deletion help, open Settings or the relevant authentication page. I can explain the next step if you tell me what you see."],
  ["file-format", "navigation", "file formats", "Decks support PDF and PPTX; scripts support PDF, DOCX, and text; live-pitch workflows use video. If a file fails, check its size and format first."],
  ["support", "navigation", "contact support", "If the issue persists, contact Metron@Athenagentic.app with the module, approximate time, and a short description. Please do not include passwords or secret keys."],
  ["privacy", "navigation", "privacy", "Use the account settings and deletion controls for your data. I can explain the product flow, but I won’t invent retention or deletion details beyond the published policy."],
  ["next-step", "navigation", "next step", "The best next step is the smallest action that tests your biggest uncertainty. Tell me whether that is the customer, market, product, traction, or delivery story and we’ll make it concrete."],
] as const;

const suffixes = [" Let’s make the evidence and next action explicit.", " I’ll call out assumptions separately from verified facts.", " If you share the relevant material, I can make this more specific.", " Keep the answer concise enough to say clearly in the room.", " We can turn the result into one prioritized improvement next."];

export const ATHENA_RESPONSES: AthenaResponse[] = variants.flatMap(([id, category, intent, response]) => suffixes.map((suffix, index) => ({ id: `${id}-${index + 1}`, category, intent, response: `${response}${suffix}` })));

export const ATHENA_GREETING_PROMPTS = [
  "Welcome back. What are we sharpening today: the deck, the story, the delivery, or the next founder decision?",
  "Good to see you. Bring me the part of your pitch that feels least convincing and we’ll work from the evidence.",
  "Welcome to Athena. We can start with a fast diagnosis or go deep on one investor question.",
  "You’re in. What changed since your last rehearsal, and what do you want an investor to understand faster?",
  "Let’s make your next pitch more precise. Would you like to work on clarity, proof, delivery, or strategy?",
  "Welcome back, founder. I’m ready to pressure-test an assumption, a slide, or your next milestone.",
  "Start wherever the friction is highest. I’ll help turn it into a clear question and a practical next step.",
] as const;

export function getAthenaGreeting(index = Math.floor(Math.random() * ATHENA_GREETING_PROMPTS.length)) {
  return ATHENA_GREETING_PROMPTS[Math.abs(index) % ATHENA_GREETING_PROMPTS.length];
}

export function getAthenaResponses(category?: AthenaResponseCategory) {
  return category ? ATHENA_RESPONSES.filter((item) => item.category === category) : ATHENA_RESPONSES;
}
