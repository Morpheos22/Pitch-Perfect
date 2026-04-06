// AI Service Layer for PitchCoach AI
// Single provider: Z.ai GLM Models (Latest Flagship)
// GLM-5.1 for text analysis (decks, scripts) - Latest flagship
// GLM-4.1V-Thinking for video/image analysis - Latest vision with reasoning

import { writeFileSync } from 'fs';
import { join } from 'path';

// ============================================
// Z.AI SDK INITIALIZATION
// ============================================

type ZAIInstance = Awaited<ReturnType<typeof import('z-ai-web-dev-sdk').default.create>>;

let zaiInstance: ZAIInstance | null = null;
let configCreated = false;

function createZaiConfig(): boolean {
  if (configCreated) return true;
  
  const apiKey = process.env.ZAI_API_KEY;
  if (!apiKey) {
    console.error('[ZAI] ZAI_API_KEY environment variable not set');
    return false;
  }
  
  const config = {
    baseUrl: process.env.ZAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    apiKey: apiKey,
  };
  
  const configJson = JSON.stringify(config);
  
  // On Vercel/serverless, only /tmp is writable
  if (!process.env.HOME || process.env.HOME === '/') {
    process.env.HOME = '/tmp';
  }
  
  const cwd = process.cwd();
  const homeDir = process.env.HOME;
  
  const locations = [
    join(cwd, '.z-ai-config'),
    join(homeDir, '.z-ai-config'),
  ];
  
  console.log('[ZAI] Current working directory:', cwd);
  console.log('[ZAI] Home directory:', homeDir);
  
  let success = false;
  for (const loc of locations) {
    try {
      writeFileSync(loc, configJson);
      console.log('[ZAI] Config created at:', loc);
      success = true;
    } catch (e) {
      const err = e as Error;
      console.log('[ZAI] Failed to write at', loc, '-', err.message);
    }
  }
  
  if (success) {
    configCreated = true;
  }
  
  return success;
}

async function getZai() {
  if (!zaiInstance) {
    const configOk = createZaiConfig();
    
    if (!configOk) {
      throw new Error('Failed to create ZAI config file. Ensure ZAI_API_KEY is set.');
    }
    
    const { default: ZAI } = await import('z-ai-web-dev-sdk');
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============================================
// MODEL CONFIGURATION
// ============================================

export const AI_MODELS = {
  // Z.ai GLM Models - Text Analysis (Latest Flagship)
  GLM_TEXT: 'glm-5.1',              // Latest flagship text model
  
  // Z.ai GLM Models - Vision Analysis (Latest Flagship)
  GLM_VISION: 'glm-4.1v-thinking',  // Latest vision model with thinking
  GLM_VISION_PRO: 'glm-4.1v-thinking', // Deep video analysis with thinking
} as const;

const AI_MODELS_LIST = Object.values(AI_MODELS);

// ============================================
// MODULE → MODEL MAPPING
// ============================================

export const MODULE_MODEL_MAP = {
  // E1: Pitch Deck Analyser
  // - Text content analysis: GLM-5.1 (structured scoring, 8-dimension framework)
  // - Visual/slide audit: GLM-4.1V-Thinking (design, typography, layout)
  E1_DECK_CONTENT: {
    model: AI_MODELS.GLM_TEXT,
    temperature: 0.3,
    description: 'Pitch deck text content analysis (problem, solution, market, team, financials, ask)',
  },
  E1_DECK_VISUAL: {
    model: AI_MODELS.GLM_VISION,
    temperature: 0.2,
    thinkingEnabled: true,
    description: 'Pitch deck visual audit (design consistency, readability, typography, color scheme)',
  },

  // E2: Elevator Pitch Script Coach
  // - Script analysis: GLM-5.1 (5-element framework: hook, problem, solution, credibility, CTA)
  // - Script rewrites: GLM-5.1 (higher temperature for creative alternatives)
  E2_SCRIPT_ANALYSIS: {
    model: AI_MODELS.GLM_TEXT,
    temperature: 0.4,
    description: 'Elevator pitch script analysis (5-element scoring, tone, duration)',
  },
  E2_SCRIPT_REWRITE: {
    model: AI_MODELS.GLM_TEXT,
    temperature: 0.6,
    description: 'Elevator pitch script rewriting (creative alternatives, hook variants)',
  },

  // E3: Live Elevator Pitch Coach (video ≤3 min)
  // - Delivery analysis: GLM-4.1V-Thinking (pace, clarity, filler words, energy, confidence)
  // - Body language: GLM-4.1V-Thinking (eye contact, posture, gestures, facial expressions)
  E3_LIVE_PITCH: {
    model: AI_MODELS.GLM_VISION,
    temperature: 0.3,
    thinkingEnabled: true,
    description: 'Short-form video pitch analysis (delivery, body language, coaching drills)',
  },

  // E4: Full Pitch Session (video ≤30 min + deck)
  // - Comprehensive analysis: GLM-4.1V-Thinking (6-dimension investor readiness)
  // - Q&A prep, competitive analysis, investor readiness level
  E4_FULL_SESSION: {
    model: AI_MODELS.GLM_VISION_PRO,
    temperature: 0.3,
    thinkingEnabled: true,
    description: 'Full investor pitch analysis (6-dimension readiness, Q&A prep, competitive positioning)',
  },

  // Utility: General image analysis (deck slide screenshots)
  IMAGE_ANALYSIS: {
    model: AI_MODELS.GLM_VISION,
    temperature: 0.2,
    thinkingEnabled: true,
    description: 'Individual slide image analysis for visual audit',
  },
} as const;

// Type for module model config values
export type ModuleModelConfig = typeof MODULE_MODEL_MAP[keyof typeof MODULE_MODEL_MAP];

// ============================================
// PITCH DECK ANALYSIS (E1)
// ============================================

export interface DeckAnalysisResult {
  problemClarityScore: number;
  solutionClarityScore: number;
  marketOpportunityScore: number;
  businessModelScore: number;
  teamCredibilityScore: number;
  tractionScore: number;
  financialsScore: number;
  askClarityScore: number;
  overallScore: number;
  
  designConsistencyScore: number;
  readabilityScore: number;
  visualHierarchyScore: number;
  colorSchemeScore: number;
  typographyScore: number;
  
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchDeck(deckContent: string): Promise<DeckAnalysisResult> {
  const systemPrompt = `You are an expert pitch deck consultant with 15+ years of experience helping startups raise funding. You have reviewed over 500 pitch decks and helped startups raise a combined $500M+.

Analyze pitch decks against the 10-slide framework and provide detailed scoring and feedback.

CONTENT SCORING CRITERIA (0-100):
1. Problem Clarity: Is the problem clearly defined, compelling, and relatable? Does it create urgency?
2. Solution Clarity: Is the solution clear, differentiated, and easy to understand? Does it directly address the problem?
3. Market Opportunity: Is TAM/SAM/SOM realistic and attractive? Is there clear market research?
4. Business Model: Is revenue model clear and scalable? Are unit economics favorable?
5. Team Credibility: Does team have relevant domain expertise, experience, and track record?
6. Traction: Is there evidence of product-market fit? Revenue, users, partnerships, growth metrics?
7. Financials: Are projections realistic and well-presented? Is the ask justified?
8. Ask Clarity: Is the funding amount clear? Use of funds specific? Terms reasonable?

VISUAL AUDIT CRITERIA (0-100):
1. Design Consistency: Consistent styling, colors, fonts throughout all slides
2. Readability: Text is easy to read, appropriate font sizes, not too dense
3. Visual Hierarchy: Clear information hierarchy, key points stand out
4. Color Scheme: Professional, on-brand, not distracting, good contrast
5. Typography: Professional font choices, consistent formatting, readable

Provide actionable, specific feedback. Be direct but constructive.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const userPrompt = `Analyze this pitch deck content thoroughly:

${deckContent}

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "problemClarityScore": <number 0-100>,
  "solutionClarityScore": <number 0-100>,
  "marketOpportunityScore": <number 0-100>,
  "businessModelScore": <number 0-100>,
  "teamCredibilityScore": <number 0-100>,
  "tractionScore": <number 0-100>,
  "financialsScore": <number 0-100>,
  "askClarityScore": <number 0-100>,
  "overallScore": <number 0-100, weighted average>,
  "designConsistencyScore": <number 0-100>,
  "readabilityScore": <number 0-100>,
  "visualHierarchyScore": <number 0-100>,
  "colorSchemeScore": <number 0-100>,
  "typographyScore": <number 0-100>,
  "strengths": ["<specific strength 1>", "<specific strength 2>", "<specific strength 3>"],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", "<specific weakness 3>"],
  "recommendations": ["<specific actionable recommendation 1>", "<specific actionable recommendation 2>", "<specific actionable recommendation 3>", "<specific actionable recommendation 4>", "<specific actionable recommendation 5>"]
}`;

  const config = MODULE_MODEL_MAP.E1_DECK_CONTENT;
  const zai = await getZai();
  const response = await zai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse AI response:', content);
    throw new Error('No JSON found in response');
  }
  
  const result = JSON.parse(jsonMatch[0]) as DeckAnalysisResult;
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = config.model;
  return result;
}

// ============================================
// SCRIPT ANALYSIS (E2)
// ============================================

export interface ScriptAnalysisResult {
  hookScore: number;
  problemScore: number;
  solutionScore: number;
  credibilityScore: number;
  ctaScore: number;
  overallScore: number;
  
  wordCount: number;
  estimatedDuration: number;
  
  improvements: {
    hook: string[];
    problem: string[];
    solution: string[];
    credibility: string[];
    cta: string[];
  };
  rewrittenScript: string;
  alternativeHooks: string[];
  
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchScript(
  scriptText: string,
  targetAudience?: string,
  targetDuration?: number
): Promise<ScriptAnalysisResult> {
  const systemPrompt = `You are an expert pitch coach specializing in elevator pitches with 20+ years of experience. You have coached founders from Y Combinator, Techstars, and 500 Startups.

Analyze scripts using the 5-Element Elevator Pitch Framework:

1. HOOK (0-100): 
   - Opens with something that grabs attention immediately (first 5 seconds)
   - Could be a surprising stat, provocative question, or bold statement
   - Creates curiosity and makes listener want to hear more

2. PROBLEM (0-100):
   - Clear, specific, and relatable problem statement
   - Uses concrete examples or statistics
   - Creates emotional connection with the pain point

3. SOLUTION (0-100):
   - Concise description of what you do
   - Clearly differentiates from alternatives
   - Explains the "how" without getting technical

4. CREDIBILITY (0-100):
   - Demonstrates relevant expertise or traction
   - Could include: team experience, customer count, revenue, partnerships
   - Builds trust in ability to execute

5. CALL-TO-ACTION (0-100):
   - Clear, specific ask
   - Appropriate for the audience and context
   - Creates urgency or next step

Provide specific, actionable feedback. Give concrete examples.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const audienceContext = targetAudience 
    ? `Target audience: ${targetAudience}` 
    : 'Target audience: investors (seed stage)';
  
  const durationContext = targetDuration 
    ? `Target duration: ${targetDuration} seconds` 
    : 'Target duration: 60 seconds (typical elevator pitch)';

  const userPrompt = `Analyze this elevator pitch script:

"""
${scriptText}
"""

${audienceContext}
${durationContext}

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "hookScore": <number 0-100>,
  "problemScore": <number 0-100>,
  "solutionScore": <number 0-100>,
  "credibilityScore": <number 0-100>,
  "ctaScore": <number 0-100>,
  "overallScore": <number 0-100, weighted average>,
  "wordCount": <number>,
  "estimatedDuration": <number in seconds>,
  "improvements": {
    "hook": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "problem": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "solution": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "credibility": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"],
    "cta": ["<specific improvement suggestion 1>", "<specific improvement suggestion 2>"]
  },
  "rewrittenScript": "<your improved version of the script, incorporating all improvements>",
  "alternativeHooks": ["<alternative opening hook 1>", "<alternative opening hook 2>", "<alternative opening hook 3>"]
}`;

  const config = MODULE_MODEL_MAP.E2_SCRIPT_ANALYSIS;
  const zai = await getZai();
  const response = await zai.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: config.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse AI response:', content);
    throw new Error('No JSON found in response');
  }
  
  const result = JSON.parse(jsonMatch[0]) as ScriptAnalysisResult;
  result.wordCount = scriptText.split(/\s+/).filter(Boolean).length;
  result.estimatedDuration = Math.round(result.wordCount / 2.5);
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = config.model;
  return result;
}

// ============================================
// VIDEO ANALYSIS (E3) - Short videos <3 min
// ============================================

export interface VideoAnalysisResult {
  paceScore: number;
  clarityScore: number;
  fillerWordScore: number;
  energyScore: number;
  confidenceScore: number;
  overallDeliveryScore: number;
  
  eyeContactScore: number;
  facialExpressionScore: number;
  gestureScore: number;
  postureScore: number;
  overallBodyLanguageScore: number;
  
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    type: 'positive' | 'improvement';
  }>;
  
  transcript: string;
  
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzePitchVideo(
  videoUrl: string,
  duration: number
): Promise<VideoAnalysisResult> {
  const systemPrompt = `You are an expert public speaking and presentation coach with expertise in analyzing video recordings of pitches. You have trained executives at Fortune 500 companies and coached TED speakers.

Analyze the video for DELIVERY and BODY LANGUAGE:

DELIVERY CRITERIA (0-100):
1. Pace: Is speaking pace appropriate? Not too fast (rushed) or slow (boring)? Ideal: 150-180 WPM
2. Clarity: Is speech clear and articulate? Good enunciation?
3. Filler Words: Minimized use of "um", "uh", "like", "you know", "so", "basically"
4. Energy: Appropriate enthusiasm and passion? Engaging delivery?
5. Confidence: Does speaker sound confident and authoritative?

BODY LANGUAGE CRITERIA (0-100):
1. Eye Contact: Looking at camera/audience, not reading notes, not looking away
2. Facial Expressions: Engaging, appropriate emotions, smiling when appropriate
3. Gestures: Natural, purposeful hand movements, not fidgeting
4. Posture: Open, upright, confident stance, not slouching or crossing arms

Identify KEY MOMENTS with timestamps:
- Strong moments (effective phrases, good gestures, engaging segments)
- Moments needing improvement (filler words, loss of eye contact, unclear statements)

Provide the full transcript of what was said.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const userPrompt = `Analyze this elevator pitch video recording.

Video URL: ${videoUrl}
Duration: ${duration} seconds

Provide your analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "paceScore": <number 0-100>,
  "clarityScore": <number 0-100>,
  "fillerWordScore": <number 0-100, higher = fewer filler words>,
  "energyScore": <number 0-100>,
  "confidenceScore": <number 0-100>,
  "overallDeliveryScore": <number 0-100>,
  "eyeContactScore": <number 0-100>,
  "facialExpressionScore": <number 0-100>,
  "gestureScore": <number 0-100>,
  "postureScore": <number 0-100>,
  "overallBodyLanguageScore": <number 0-100>,
  "wordsPerMinute": <number>,
  "fillerWordCount": <total number of filler words>,
  "fillerWords": {"um": <count>, "uh": <count>, "like": <count>, "you know": <count>},
  "deliveryFeedback": "<detailed paragraph about delivery strengths and improvements>",
  "bodyLanguageFeedback": "<detailed paragraph about body language strengths and improvements>",
  "keyMoments": [
    {"timestamp": "0:15", "description": "<what happened>", "type": "positive"},
    {"timestamp": "0:32", "description": "<what happened>", "type": "improvement"}
  ],
  "transcript": "<full transcript of what was said>"
}`;

  const config = MODULE_MODEL_MAP.E3_LIVE_PITCH;
  const zai = await getZai();
  const response = await zai.chat.completions.createVision({
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          { type: 'text', text: userPrompt },
          { type: 'video_url', video_url: { url: videoUrl } }
        ]
      }
    ],
    thinking: { type: 'enabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse AI response:', content);
    throw new Error('No JSON found in response');
  }
  
  const result = JSON.parse(jsonMatch[0]) as VideoAnalysisResult;
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = config.model;
  return result;
}

// ============================================
// FULL PITCH SESSION ANALYSIS (E4) - Long videos
// ============================================

export interface FullPitchAnalysisResult {
  problemSolutionFit: number;
  marketOpportunity: number;
  businessModelViability: number;
  teamCredibility: number;
  tractionMilestones: number;
  deliveryPresence: number;
  overallReadinessScore: number;
  
  investorReadinessLevel: 'NOT_READY' | 'NEEDS_WORK' | 'INVESTOR_READY' | 'HIGHLY_PREPARED';
  
  contentScores: {
    problemClarity: number;
    solutionDifferentiation: number;
    marketSizing: number;
    competitivePositioning: number;
    businessModel: number;
    financialProjections: number;
    teamPresentation: number;
    tractionEvidence: number;
    askClarity: number;
  };
  deliveryScores: {
    pace: number;
    clarity: number;
    confidence: number;
    engagement: number;
    handlingQuestions: number;
  };
  
  strengths: string[];
  weaknesses: string[];
  investorConcerns: string[];
  recommendedActions: string[];
  
  anticipatedQuestions: Array<{
    question: string;
    suggestedAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  
  competitiveAnalysis: {
    percentileVsPeers: number;
    standoutElements: string[];
    commonMistakes: string[];
  };
  
  transcript: string;
  
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzeFullPitchSession(
  videoUrl: string,
  duration: number,
  deckAnalysis?: DeckAnalysisResult
): Promise<FullPitchAnalysisResult> {
  const systemPrompt = `You are a senior investment analyst and pitch consultant with 20+ years of experience at top VC firms (Sequoia, Andreessen Horowitz, Greylock). You have evaluated over 10,000 pitches and sat on numerous investment committees.

Analyze this full investor pitch presentation (up to 30 minutes) for INVESTOR READINESS:

6-DIMENSION INVESTOR READINESS FRAMEWORK (0-100):

1. PROBLEM-SOLUTION FIT:
   - Is the problem real, urgent, and expensive?
   - Does the solution directly address the problem?
   - Is there evidence of product-market fit?

2. MARKET OPPORTUNITY:
   - Is TAM/SAM/SOM realistic and well-researched?
   - Is the market growing or disrupted?
   - Is there a clear beachhead strategy?

3. BUSINESS MODEL VIABILITY:
   - Is the revenue model clear and scalable?
   - Are unit economics favorable?
   - Is path to profitability realistic?

4. TEAM CREDIBILITY:
   - Does team have relevant domain expertise?
   - Track record of execution?
   - Coverage of key roles?

5. TRACTION & MILESTONES:
   - Revenue/users/growth metrics?
   - Key partnerships or customer wins?
   - Product development progress?

6. DELIVERY & PRESENCE:
   - Is the presentation engaging?
   - Does founder demonstrate confidence?
   - Are visuals supporting the narrative?

INVESTOR READINESS LEVELS:
- NOT_READY (0-40): Major gaps, would not pass initial screening
- NEEDS_WORK (41-60): Promising but needs refinement before investor meetings
- INVESTOR_READY (61-80): Ready for investor conversations, competitive pitch
- HIGHLY_PREPARED (81-100): Exceptional pitch, stands out from the crowd

Also anticipate investor Q&A questions with suggested answers.
Provide comprehensive, actionable feedback.
Respond ONLY in valid JSON format without any markdown formatting.`;

  const deckContext = deckAnalysis 
    ? `\n\nPITCH DECK ANALYSIS (already analyzed):
    - Overall Score: ${deckAnalysis.overallScore}/100
    - Strengths: ${deckAnalysis.strengths.join(', ')}
    - Weaknesses: ${deckAnalysis.weaknesses.join(', ')}`
    : '';

  const userPrompt = `Analyze this full investor pitch presentation.

Video URL: ${videoUrl}
Duration: ${Math.floor(duration / 60)} minutes ${duration % 60} seconds
${deckContext}

Provide your comprehensive analysis as a JSON object with this EXACT structure (no markdown, just pure JSON):
{
  "problemSolutionFit": <number 0-100>,
  "marketOpportunity": <number 0-100>,
  "businessModelViability": <number 0-100>,
  "teamCredibility": <number 0-100>,
  "tractionMilestones": <number 0-100>,
  "deliveryPresence": <number 0-100>,
  "overallReadinessScore": <number 0-100>,
  "investorReadinessLevel": "<NOT_READY|NEEDS_WORK|INVESTOR_READY|HIGHLY_PREPARED>",
  "contentScores": {
    "problemClarity": <number 0-100>,
    "solutionDifferentiation": <number 0-100>,
    "marketSizing": <number 0-100>,
    "competitivePositioning": <number 0-100>,
    "businessModel": <number 0-100>,
    "financialProjections": <number 0-100>,
    "teamPresentation": <number 0-100>,
    "tractionEvidence": <number 0-100>,
    "askClarity": <number 0-100>
  },
  "deliveryScores": {
    "pace": <number 0-100>,
    "clarity": <number 0-100>,
    "confidence": <number 0-100>,
    "engagement": <number 0-100>,
    "handlingQuestions": <number 0-100>
  },
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>", "<strength 4>", "<strength 5>"],
  "weaknesses": ["<weakness 1>", "<weakness 2>", "<weakness 3>"],
  "investorConcerns": ["<concern investors will raise 1>", "<concern 2>", "<concern 3>"],
  "recommendedActions": ["<specific action 1>", "<specific action 2>", "<specific action 3>", "<specific action 4>", "<specific action 5>"],
  "anticipatedQuestions": [
    {"question": "<likely investor question>", "suggestedAnswer": "<how to answer>", "difficulty": "easy|medium|hard"}
  ],
  "competitiveAnalysis": {
    "percentileVsPeers": <number 0-100>,
    "standoutElements": ["<element that stands out positively>"],
    "commonMistakes": ["<mistakes to avoid>"]
  },
  "transcript": "<full transcript of the presentation>"
}`;

  const config = MODULE_MODEL_MAP.E4_FULL_SESSION;
  const zai = await getZai();
  const response = await zai.chat.completions.createVision({
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: systemPrompt },
          { type: 'text', text: userPrompt },
          { type: 'video_url', video_url: { url: videoUrl } }
        ]
      }
    ],
    thinking: { type: 'enabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('Failed to parse AI response:', content);
    throw new Error('No JSON found in response');
  }
  
  const result = JSON.parse(jsonMatch[0]) as FullPitchAnalysisResult;
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = config.model;
  return result;
}

// ============================================
// IMAGE ANALYSIS (for deck screenshots)
// ============================================

export interface ImageAnalysisResult {
  description: string;
  visualElements: string[];
  designQuality: number;
  readability: number;
  suggestions: string[];
  tokensUsed?: number;
  modelUsed?: string;
}

export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  const prompt = `Analyze this pitch deck slide image. Provide feedback on:
1. Design quality (0-100)
2. Readability (0-100)
3. Key visual elements present
4. Specific improvement suggestions

Respond as JSON: {
  "description": "<brief description>",
  "visualElements": ["<element 1>", "<element 2>"],
  "designQuality": <0-100>,
  "readability": <0-100>,
  "suggestions": ["<suggestion 1>", "<suggestion 2>"]
}`;

  const config = MODULE_MODEL_MAP.IMAGE_ANALYSIS;
  const zai = await getZai();
  const response = await zai.chat.completions.createVision({
    model: config.model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    thinking: { type: 'enabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in response');
  }
  
  const result = JSON.parse(jsonMatch[0]) as ImageAnalysisResult;
  result.tokensUsed = response.usage?.totalTokens;
  result.modelUsed = config.model;
  return result;
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAIServiceHealth(): Promise<{ 
  status: string; 
  models: string[]; 
  message?: string; 
  configFound?: boolean;
  glm?: { status: string; message?: string };
}> {
  const results = {
    glm: { status: 'unknown', message: '' },
  };
  
  try {
    const zai = await getZai();
    const response = await zai.chat.completions.create({
      model: AI_MODELS.GLM_TEXT,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    });
    
    const content = response.choices[0]?.message?.content;
    if (content?.toLowerCase().includes('ok')) {
      results.glm = { status: 'healthy', message: `GLM-5.1 responding` };
    } else {
      results.glm = { status: 'degraded', message: `Unexpected response: ${content}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    results.glm = { status: 'unhealthy', message: errorMessage };
  }
  
  return {
    status: results.glm.status === 'healthy' ? 'healthy' : 'unhealthy',
    models: AI_MODELS_LIST,
    moduleMapping: Object.entries(MODULE_MODEL_MAP).map(([key, val]) => ({
      module: key,
      model: val.model,
      temperature: val.temperature,
      thinkingEnabled: 'thinkingEnabled' in val ? val.thinkingEnabled : false,
    })),
    configFound: true,
    glm: results.glm,
  };
}
