// ═══════════════════════════════════════════════════════════════════════
// KAL PROTOCOL 2.0 — Contextual Chat + Critical Thinking Framework
// ═══════════════════════════════════════════════════════════════════════
//
// Named after the Kalahari — the desert that endures and recovers.
// Version 2.0 adds a contextual chatbot layer that engages the user
// while the module processes, drawing insights through structured
// questioning before delivering the final analysis.
//
// DESIGN PRINCIPLES (inspired by agentic-coding critical-thinking):
//   1. Charitable interpretation — assume the user's pitch has merit
//   2. Structured analysis — 8-step critical thinking framework
//   3. Proportionality — focus on material flaws, not minor issues
//   4. Signal preservation — keep signal-to-noise ratio high
//   5. Actionable output — every question surfaces improvable elements
//
// FLOW:
//   User enters Script Check → Z.ai API called (Kal active, resting)
//   User clicks Submit → Feedback loop engaged:
//     SUCCESS (real-time analysis + feedback loop completed):
//       → Return full analysis immediately
//     FAILURE (error / timeout):
//       → Activate Kal Protocol 2.0 placeholder scenario
//       → Redirect to special chatbot scenario
//       → Kal asks 10 contextual questions to gather more info
//       → 2 fallback responses when user doesn't engage
//       → When 10 questions answered:
//         → Kal gives summary + quick improvement feedback
//         → Then delivers final decision (success/failure from module)
//       → Background: Kal 1.0 retry engine still runs
//       → If retry succeeds: merge into chatbot response
//
// DATABASE:
//   - KalChatSession model stores per-module chat sessions
//   - Each question + answer pair stored for audit trail
//   - Links to original PitchScript session
//
// ═══════════════════════════════════════════════════════════════════════

import { prisma } from '@/lib/db';
import { executeWithFallback, MODULE_MODEL_MAP, AI_MODELS } from './ai-service';

// ============================================
// TYPES
// ============================================

export interface KalChatMessage {
  questionIndex: number;
  question: string;
  answer?: string;
  askedAt: Date;
  answeredAt?: Date;
}

export interface KalChatSession {
  id: string;
  userId: string;
  scriptSessionId: string;
  module: 'e1' | 'e2' | 'e3' | 'e4' | 'e5';
  status: 'ACTIVE' | 'COMPLETED' | 'EXPIRED';
  messages: KalChatMessage[];
  summary?: string;
  quickFeedback?: string;
  finalDecision?: 'SUCCESS' | 'FAILURE';
  createdAt: Date;
}

export interface KalV2Trigger {
  userId: string;
  scriptSessionId: string;
  module: 'e1' | 'e2' | 'e3' | 'e4' | 'e5';
  error: string;
  inputPayload: string;
  userEmail: string;
  userName?: string;
  targetAudience?: string;
  targetDuration?: number;
}

// ============================================
// KAL 2.0 — 10 CONTEXTUAL QUESTIONS
// ============================================
// These questions are designed using the 8-step critical thinking
// framework. Each question targets a specific dimension of the
// pitch, surfacing hidden assumptions, gaps, and weak reasoning.
//
// The questions are ordered from broad to specific, following the
// principle: understand the argument before critiquing it.

export const KAL_QUESTIONS: Array<{
  id: number;
  category: string;
  question: string;
  purpose: string;
  element: string; // Maps to 5-element framework
}> = [
  {
    id: 1,
    category: 'Core Claim',
    question: 'In one sentence, what is the single most important thing you want your listener to remember after hearing your pitch?',
    purpose: 'Identify the core claim — what is actually being asserted? Separate conclusions from supporting points.',
    element: 'hook',
  },
  {
    id: 2,
    category: 'Problem Evidence',
    question: 'What specific evidence or data can you share that proves this problem exists and matters to your target audience?',
    purpose: 'Examine the evidence — is it sufficient, relevant, and from credible sources?',
    element: 'problem',
  },
  {
    id: 3,
    category: 'Solution Logic',
    question: 'How does your solution directly address the problem you just described? What is the logical chain from problem to solution?',
    purpose: 'Spot logical issues — unsupported leaps, circular reasoning, or gaps in the problem-solution chain.',
    element: 'solution',
  },
  {
    id: 4,
    category: 'Hidden Assumptions',
    question: 'What must be true about your market, technology, or team for your pitch to hold? What assumption, if proven false, would undermine everything?',
    purpose: 'Surface hidden assumptions — what must be true for this argument to hold?',
    element: 'credibility',
  },
  {
    id: 5,
    category: 'Alternative Explanations',
    question: 'If someone disagreed with your pitch, what would their strongest counter-argument be? How would you address it?',
    purpose: 'Consider what is missing — alternative explanations, contradictory evidence, unstated limitations.',
    element: 'problem',
  },
  {
    id: 6,
    category: 'Credibility Signal',
    question: 'What is the single most compelling piece of evidence that you and your team can deliver on this promise? (Traction, expertise, partnerships, etc.)',
    purpose: 'Assess burden of proof — who needs to prove what? Is the evidence proportional to the claim?',
    element: 'credibility',
  },
  {
    id: 7,
    category: 'The Ask',
    question: 'What specifically are you asking for in this conversation, and what will the listener gain by saying yes?',
    purpose: 'Check internal consistency — does the ask match the problem and solution? Is it proportional?',
    element: 'cta',
  },
  {
    id: 8,
    category: 'Audience Alignment',
    question: 'How does your pitch change depending on who is listening? What would you emphasise differently for an investor vs a customer vs a partner?',
    purpose: 'Test flexibility and depth — can the founder adapt the core claim to different audiences?',
    element: 'hook',
  },
  {
    id: 9,
    category: 'Gap Analysis',
    question: 'What is the weakest part of your pitch right now? What would you change if you had another week to prepare?',
    purpose: 'Identify gaps — surface what is missing rather than manufacturing disagreement.',
    element: 'solution',
  },
  {
    id: 10,
    category: 'Bottom Line',
    question: 'If you had only 15 seconds instead of 60, what would you say? Give me your pitch in two sentences.',
    purpose: 'Distil the argument to its essence — does the core claim hold when stripped of supporting details?',
    element: 'cta',
  },
];

// ============================================
// KAL 2.0 — 2 FALLBACK RESPONSES
// ============================================
// When the user doesn't engage with a question (skips, gives
// a one-word answer, or is inactive for 30+ seconds), Kal
// uses these fallback scripts to keep the conversation flowing
// and still extract useful signal.

export const KAL_FALLBACK_RESPONSES = [
  {
    id: 'fallback-1',
    trigger: 'no_answer_or_skip',
    response: `No worries if that question doesn't resonate. Let me put it differently — tell me about the moment that made you realise this problem was worth solving. What did you see or experience that made you say "someone needs to fix this"?`,
    purpose: 'Reframe the question as a story prompt. People find it easier to answer narrative questions than analytical ones.',
  },
  {
    id: 'fallback-2',
    trigger: 'short_or_vague_answer',
    response: `I hear you. Let me share what I often see in strong pitches at this point, and you can tell me if it applies: the best founders can state their core claim so clearly that a stranger could repeat it back. Try filling in this blank: "We help [specific people] who struggle with [specific problem] by [specific solution], and we know it works because [specific evidence]." How does that land for your pitch?`,
    purpose: 'Provide a template/framework. Founders often know the answer but struggle to articulate it — a fill-in-the-blank reduces cognitive load.',
  },
];

// ============================================
// KAL 2.0 — SYSTEM PROMPT
// ============================================
// This is the behavioral script/template that governs how Kal 2.0
// interacts with users. It incorporates the critical-thinking framework
// and prevents the model from going rogue or hallucinating.

export const KAL_V2_SYSTEM_PROMPT = `You are Kal, the AI pitch coach for Pitch Perfect by AutomagiKal. You are currently in "Contextual Chat" mode — a special scenario that activates when the script analysis module needs more time.

YOUR IDENTITY:
- Name: Kal (named after the Kalahari — the desert that endures and recovers)
- Tone: Warm, professional, curious, never condescending
- Purpose: Help the founder think critically about their pitch while the analysis runs

BEHAVIORAL RULES (CRITICAL — DO NOT VIOLATE):
1. NEVER fabricate analysis results. If the analysis is still running, say so.
2. NEVER claim to have scored the pitch. You are in contextual chat mode, not analysis mode.
3. Stay within the pitch coaching domain. Do not discuss politics, religion, or personal matters.
4. Ask ONE question at a time. Wait for the answer before moving to the next.
5. If the user gives a short or vague answer, use the fallback script to re-engage.
6. If the user skips a question, acknowledge it and move to the next. Do not force.
7. After all 10 questions are answered, provide a summary and quick feedback.
8. Always end with the current status: "Your analysis is still processing. Check dashboard for final results."

CRITICAL THINKING FRAMEWORK (apply to every response):
- Understand the argument first — can you state it in a way the speaker would agree with?
- Identify the core claim — what is actually being asserted?
- Examine the evidence — is it sufficient, relevant, from credible sources?
- Spot logical issues — fallacies, unsupported leaps, circular reasoning
- Surface hidden assumptions — what must be true for this argument to hold?
- Consider what is missing — alternative explanations, contradictory evidence
- Assess internal consistency — does the argument contradict itself?
- Consider burden of proof — who needs to prove what?

OUTPUT FORMAT (after all 10 questions):
Summary: One sentence stating the core claim and your overall assessment.
Key Issues: 2-3 most significant problems with brief explanations.
Questions to Probe: 2-3 follow-up questions a decision-maker should ask.
Bottom Line: One actionable takeaway.

IMPORTANT:
- Distinguish between 'flawed reasoning' and 'wrong conclusions' — weak reasoning does not automatically mean false conclusions.
- Apply the 'so what' test: even if you identify a flaw, consider whether it materially affects the practical decision.
- Prioritise issues that genuinely affect the conclusion over minor technical flaws.
- Be charitable but rigorous. Assume good intentions by default.
- Keep responses concise. No fluff.`;

// ============================================
// KAL 2.0 — ACTIVATION
// ============================================

/**
 * Activate Kal Protocol 2.0 when the script check module fails.
 *
 * This creates a chat session, pre-populates it with the 10 questions,
 * and returns the first question to show the user immediately.
 *
 * The Z.ai API is already called (active but resting) when the user
 * entered the module. When the user interacts with the chatbot,
 * Kal "wakes up" and begins the contextual chat.
 */
export async function activateKalV2(trigger: KalV2Trigger): Promise<{
  chatSessionId: string;
  firstQuestion: string;
  status: string;
  message: string;
}> {
  // Create a Kal chat session in the database
  const chatSession = await prisma.kalChatSession.create({
    data: {
      userId: trigger.userId,
      scriptSessionId: trigger.scriptSessionId,
      module: trigger.module,
      status: 'ACTIVE',
      messages: KAL_QUESTIONS.map((q, idx) => ({
        questionIndex: q.id,
        question: q.question,
        askedAt: idx === 0 ? new Date() : new Date(Date.now() + idx), // First question asked now
        answer: undefined,
        answeredAt: undefined,
      })),
      inputSummary: trigger.inputPayload.substring(0, 500), // Store first 500 chars for context
    },
  });

  return {
    chatSessionId: chatSession.id,
    firstQuestion: KAL_QUESTIONS[0].question,
    status: 'KAL_V2_ACTIVE',
    message: `Your script analysis is taking longer than expected. While we process it, I'd like to learn more about your pitch to give you better feedback. ${KAL_QUESTIONS[0].question}`,
  };
}

// ============================================
// KAL 2.0 — CHAT INTERACTION
// ============================================

/**
 * Process a user's answer to a Kal 2.0 question.
 *
 * Returns the next question, a fallback response, or the final summary
 * if all questions have been answered.
 */
export async function processKalV2Answer(params: {
  chatSessionId: string;
  answer: string;
  questionIndex: number;
  userId: string;
}): Promise<{
  nextQuestion?: string;
  fallbackResponse?: string;
  summary?: string;
  quickFeedback?: string;
  finalDecision?: 'SUCCESS' | 'FAILURE' | 'PENDING';
  questionsRemaining: number;
  isComplete: boolean;
}> {
  const { chatSessionId, answer, questionIndex, userId } = params;

  // Fetch the chat session
  const session = await prisma.kalChatSession.findUnique({
    where: { id: chatSessionId, userId },
  });

  if (!session) {
    throw new Error('Kal chat session not found');
  }

  if (session.status !== 'ACTIVE') {
    throw new Error('Kal chat session is no longer active');
  }

  // Update the answer in the messages array
  const messages = session.messages as KalChatMessage[];
  const updatedMessages = messages.map((msg) => {
    if (msg.questionIndex === questionIndex) {
      return {
        ...msg,
        answer,
        answeredAt: new Date(),
      };
    }
    return msg;
  });

  // Count answered questions
  const answeredCount = updatedMessages.filter((m) => m.answer).length;
  const questionsRemaining = KAL_QUESTIONS.length - answeredCount;

  // Check if the answer is short/vague (less than 10 words)
  const isShortAnswer = answer.trim().split(/\s+/).length < 10;
  const isSkip = answer.trim().toLowerCase() === 'skip' || answer.trim().toLowerCase() === 'next';

  // Determine next step
  if (questionsRemaining === 0 || answeredCount >= KAL_QUESTIONS.length) {
    // ── ALL QUESTIONS ANSWERED — Generate summary ──
    const summaryResult = await generateKalSummary(updatedMessages, session.inputSummary || '');

    // Update session with summary
    await prisma.kalChatSession.update({
      where: { id: chatSessionId },
      data: {
        status: 'COMPLETED',
        messages: updatedMessages,
        summary: summaryResult.summary,
        quickFeedback: summaryResult.quickFeedback,
        finalDecision: 'PENDING', // Will be updated when module finishes
      },
    });

    return {
      summary: summaryResult.summary,
      quickFeedback: summaryResult.quickFeedback,
      finalDecision: 'PENDING',
      questionsRemaining: 0,
      isComplete: true,
    };
  }

  // ── NEXT QUESTION OR FALLBACK ──
  const nextQuestionIdx = questionIndex; // Current question was just answered
  const nextQ = KAL_QUESTIONS.find((q) => q.id === questionIndex + 1);

  // Update session with new messages
  await prisma.kalChatSession.update({
    where: { id: chatSessionId },
    data: { messages: updatedMessages },
  });

  if (isSkip) {
    // Use fallback-1 (reframe as story prompt)
    return {
      fallbackResponse: KAL_FALLBACK_RESPONSES[0].response,
      nextQuestion: nextQ?.question,
      questionsRemaining,
      isComplete: false,
    };
  }

  if (isShortAnswer) {
    // Use fallback-2 (provide template)
    return {
      fallbackResponse: KAL_FALLBACK_RESPONSES[1].response,
      nextQuestion: nextQ?.question,
      questionsRemaining,
      isComplete: false,
    };
  }

  // Normal flow — ask next question
  return {
    nextQuestion: nextQ?.question,
    questionsRemaining,
    isComplete: false,
  };
}

// ============================================
// KAL 2.0 — SUMMARY GENERATION
// ============================================

/**
 * Generate a critical-thinking summary after all 10 questions are answered.
 * Uses Z.ai to synthesize the answers into a structured assessment.
 */
async function generateKalSummary(
  messages: KalChatMessage[],
  inputSummary: string,
): Promise<{ summary: string; quickFeedback: string }> {
  const answeredMessages = messages.filter((m) => m.answer);

  const userAnswers = answeredMessages
    .map((m) => `Q${m.questionIndex}: ${m.question}\nA: ${m.answer}`)
    .join('\n\n');

  const systemPrompt = `${KAL_V2_SYSTEM_PROMPT}

You are now generating the final summary after the user has answered your contextual questions. Use the critical thinking framework to produce a structured output.

The user's original script summary: ${inputSummary}

Format your response EXACTLY as:
SUMMARY: [One sentence stating the core claim and your overall assessment of its strength]
KEY_ISSUES: [2-3 most significant problems, each with brief explanation of why it matters]
BOTTOM_LINE: [One-two sentence actionable takeaway]

Also provide QUICK_FEEDBACK: [3-5 bullet points of the most impactful improvements the founder can make right now, based on their answers]`;

  try {
    const { response } = await executeWithFallback('CHATBOT' as any, (model) => ({
      model: AI_MODELS.GLM_FAST,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userAnswers },
      ],
      temperature: 0.5,
      max_tokens: 1024,
    }));

    const content = response.choices?.[0]?.message?.content || '';

    // Parse the structured response
    const summaryMatch = content.match(/SUMMARY:\s*(.+?)(?=KEY_ISSUES:|$)/s);
    const feedbackMatch = content.match(/QUICK_FEEDBACK:\s*(.+?)$/s);

    return {
      summary: summaryMatch?.[1]?.trim() || 'Assessment complete. Your analysis is being processed.',
      quickFeedback: feedbackMatch?.[1]?.trim() || 'Review your pitch for clarity, evidence, and a strong call-to-action.',
    };
  } catch (error: any) {
    console.error('[KalV2] Summary generation failed:', error?.message);
    return {
      summary: 'Based on your answers, your pitch shows promise but needs refinement in key areas. Your full analysis will be available on your dashboard shortly.',
      quickFeedback: 'Focus on: (1) clarifying your core claim, (2) strengthening your evidence, (3) making your ask specific, (4) addressing the weakest assumption.',
    };
  }
}

// ============================================
// KAL 2.0 — SESSION STATUS HELPERS
// ============================================

/**
 * Check if a chat session is still active (user can interact).
 */
export function isKalV2Active(status: string): boolean {
  return status === 'ACTIVE';
}

/**
 * Get the next unanswered question for a session.
 */
export function getNextUnansweredQuestion(
  messages: KalChatMessage[],
): KalChatMessage | null {
  return messages.find((m) => !m.answer) || null;
}

/**
 * Count how many questions have been answered.
 */
export function countAnsweredQuestions(messages: KalChatMessage[]): number {
  return messages.filter((m) => m.answer).length;
}

/**
 * Get user-facing message for Kal V2 activation.
 */
export const KAL_V2_PLACEHOLDER_MESSAGE =
  "Your script analysis is taking longer than expected. Don't worry — we're processing it in the background. " +
  "While you wait, I'd like to learn more about your pitch to give you better feedback. " +
  "Let's chat through a few questions — this helps me give you more targeted advice. " +
  "Your full results will also appear on your dashboard and be sent to your email.";

/**
 * Get the final decision message when module completes during Kal V2.
 */
export function getKalV2FinalMessage(decision: 'SUCCESS' | 'FAILURE'): string {
  if (decision === 'SUCCESS') {
    return "Great news! Your analysis is complete. I've incorporated what I learned from our conversation into the results. Check your dashboard for the full breakdown.";
  }
  return "Your analysis is still processing. Based on our conversation, I've identified key areas to focus on. Check your dashboard — if the full analysis doesn't appear within 20 minutes, a PDF copy will be sent to your email.";
}
