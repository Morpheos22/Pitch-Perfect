// AI Service Layer for PitchCoach AI
// Uses Z-AI SDK with GLM models for all AI operations
// GLM-4 for text analysis (decks, scripts)
// GLM-4V for video analysis (live pitches)
//
// Environment Variables (for Vercel deployment):
// - ZAI_API_KEY: Your Z.ai API key (required)
// - ZAI_BASE_URL: API base URL (optional, defaults to Z-AI's endpoint)

import ZAI from 'z-ai-web-dev-sdk';

// Initialize ZAI instance (singleton pattern)
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

/**
 * Get or create ZAI instance
 * The SDK automatically reads ZAI_API_KEY from environment variables
 */
async function getZai() {
  if (!zaiInstance) {
    // ZAI.create() automatically reads ZAI_API_KEY from process.env
    zaiInstance = await ZAI.create();
  }
  return zaiInstance;
}

// ============================================
// MODEL CONFIGURATION
// ============================================

export const AI_MODELS = {
  // GLM-4 for text analysis (decks, scripts)
  GLM_TEXT: 'glm-4-plus', // High-quality text analysis
  
  // GLM-4V for vision/video analysis
  GLM_VISION: 'glm-4v-flash', // Fast video analysis (E3 - short videos)
  GLM_VISION_PRO: 'glm-4v-plus', // Deep video analysis (E4 - long videos)
} as const;

const AI_MODELS_LIST = Object.values(AI_MODELS);

// ============================================
// PITCH DECK ANALYSIS (E1) - GLM-4
// ============================================

export interface DeckAnalysisResult {
  // Content Scores (0-100)
  problemClarityScore: number;
  solutionClarityScore: number;
  marketOpportunityScore: number;
  businessModelScore: number;
  teamCredibilityScore: number;
  tractionScore: number;
  financialsScore: number;
  askClarityScore: number;
  overallScore: number;
  
  // Visual Audit Scores (0-100)
  designConsistencyScore: number;
  readabilityScore: number;
  visualHierarchyScore: number;
  colorSchemeScore: number;
  typographyScore: number;
  
  // Feedback
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  
  // Token usage for tracking
  tokensUsed?: number;
}

export async function analyzePitchDeck(deckContent: string): Promise<DeckAnalysisResult> {
  const zai = await getZai();
  
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

  const response = await zai.chat.completions.create({
    model: AI_MODELS.GLM_TEXT, // E1: glm-4-plus for pitch deck analysis
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    // Extract JSON from potential markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as DeckAnalysisResult;
    result.tokensUsed = response.usage?.totalTokens;
    return result;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse AI analysis response');
  }
}

// ============================================
// SCRIPT ANALYSIS (E2) - GLM-4
// ============================================

export interface ScriptAnalysisResult {
  // 5-Element Scoring (0-100)
  hookScore: number;
  problemScore: number;
  solutionScore: number;
  credibilityScore: number;
  ctaScore: number;
  overallScore: number;
  
  // Script Metrics
  wordCount: number;
  estimatedDuration: number; // in seconds
  
  // Feedback
  improvements: {
    hook: string[];
    problem: string[];
    solution: string[];
    credibility: string[];
    cta: string[];
  };
  rewrittenScript: string;
  alternativeHooks: string[];
  
  // Token usage for tracking
  tokensUsed?: number;
}

export async function analyzePitchScript(
  scriptText: string,
  targetAudience?: string,
  targetDuration?: number
): Promise<ScriptAnalysisResult> {
  const zai = await getZai();
  
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

  const response = await zai.chat.completions.create({
    model: AI_MODELS.GLM_TEXT, // E2: glm-4-plus for script analysis
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.4,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as ScriptAnalysisResult;
    result.tokensUsed = response.usage?.totalTokens;
    return result;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse AI analysis response');
  }
}

// ============================================
// VIDEO ANALYSIS (E3) - GLM-4V FLASH
// ============================================

export interface VideoAnalysisResult {
  // Delivery Scores (0-100)
  paceScore: number;
  clarityScore: number;
  fillerWordScore: number;
  energyScore: number;
  confidenceScore: number;
  overallDeliveryScore: number;
  
  // Body Language Scores (0-100)
  eyeContactScore: number;
  facialExpressionScore: number;
  gestureScore: number;
  postureScore: number;
  overallBodyLanguageScore: number;
  
  // Metrics
  wordsPerMinute: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  
  // Feedback
  deliveryFeedback: string;
  bodyLanguageFeedback: string;
  keyMoments: Array<{
    timestamp: string;
    description: string;
    type: 'positive' | 'improvement';
  }>;
  
  // Transcript
  transcript: string;
  
  // Token usage for tracking
  tokensUsed?: number;
}

export async function analyzePitchVideo(
  videoUrl: string,
  duration: number
): Promise<VideoAnalysisResult> {
  const zai = await getZai();
  
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

  // E3: Use glm-4v-flash for fast video analysis (short videos up to 3 minutes)
  const response = await zai.chat.completions.createVision({
    model: AI_MODELS.GLM_VISION,
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
    thinking: { type: 'disabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as VideoAnalysisResult;
    result.tokensUsed = response.usage?.totalTokens;
    return result;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse video analysis response');
  }
}

// ============================================
// FULL PITCH SESSION ANALYSIS (E4) - GLM-4V PLUS
// ============================================

export interface FullPitchAnalysisResult {
  // 6-Dimension Investor Readiness Scores (0-100)
  problemSolutionFit: number;
  marketOpportunity: number;
  businessModelViability: number;
  teamCredibility: number;
  tractionMilestones: number;
  deliveryPresence: number;
  overallReadinessScore: number;
  
  // Investor Readiness Level
  investorReadinessLevel: 'NOT_READY' | 'NEEDS_WORK' | 'INVESTOR_READY' | 'HIGHLY_PREPARED';
  
  // Detailed Scores
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
  
  // Feedback
  strengths: string[];
  weaknesses: string[];
  investorConcerns: string[];
  recommendedActions: string[];
  
  // Q&A Preparation
  anticipatedQuestions: Array<{
    question: string;
    suggestedAnswer: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  
  // Competitive Context
  competitiveAnalysis: {
    percentileVsPeers: number;
    standoutElements: string[];
    commonMistakes: string[];
  };
  
  // Transcript
  transcript: string;
  
  // Token usage for tracking
  tokensUsed?: number;
}

export async function analyzeFullPitchSession(
  videoUrl: string,
  duration: number,
  deckAnalysis?: DeckAnalysisResult
): Promise<FullPitchAnalysisResult> {
  const zai = await getZai();
  
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

  // E4: Use glm-4v-plus for deep video analysis (long videos up to 30 minutes)
  const response = await zai.chat.completions.createVision({
    model: AI_MODELS.GLM_VISION_PRO,
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
    thinking: { type: 'disabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as FullPitchAnalysisResult;
    result.tokensUsed = response.usage?.totalTokens;
    return result;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse full pitch analysis response');
  }
}

// ============================================
// IMAGE ANALYSIS - GLM-4V (for deck screenshots)
// ============================================

export interface ImageAnalysisResult {
  description: string;
  visualElements: string[];
  designQuality: number;
  readability: number;
  suggestions: string[];
  tokensUsed?: number;
}

export async function analyzeImage(imageUrl: string): Promise<ImageAnalysisResult> {
  const zai = await getZai();
  
  // Use glm-4v-flash for fast image analysis
  const response = await zai.chat.completions.createVision({
    model: AI_MODELS.GLM_VISION,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze this pitch deck slide image. Provide feedback on:
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
}`
          },
          {
            type: 'image_url',
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    thinking: { type: 'disabled' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('No response from AI');
  }

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const result = JSON.parse(jsonMatch[0]) as ImageAnalysisResult;
    result.tokensUsed = response.usage?.totalTokens;
    return result;
  } catch (e) {
    console.error('Failed to parse AI response:', content);
    throw new Error('Failed to parse image analysis response');
  }
}

// ============================================
// TOKEN TRACKING & COST ESTIMATION
// ============================================

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// GLM pricing (approximate, check Z-AI docs for current pricing)
const GLM_COSTS = {
  GLM_4_PLUS: {
    input: 0.00005,  // per token
    output: 0.00005,
  },
  GLM_4V_FLASH: {
    input: 0.00001,
    output: 0.00001,
  },
  GLM_4V_PLUS: {
    input: 0.0001,
    output: 0.0001,
  },
};

export function estimateGLMCost(
  model: keyof typeof GLM_COSTS,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = GLM_COSTS[model];
  return (inputTokens * costs.input) + (outputTokens * costs.output);
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAIServiceHealth(): Promise<{ 
  status: string; 
  models: string[]; 
  message?: string; 
  configFound?: boolean 
}> {
  try {
    const zai = await getZai();
    
    // Test with glm-4-plus (same as E1/E2)
    const response = await zai.chat.completions.create({
      model: AI_MODELS.GLM_TEXT,
      messages: [{ role: 'user', content: 'Say "ok"' }],
    });

    // Debug: log full response structure
    console.log('[ZAI] Full response:', JSON.stringify(response, null, 2));
    
    // Handle both direct response and nested response formats
    let content: string | undefined;
    let errorMessage: string | undefined;
    
    if (response && typeof response === 'object') {
      // Check for error response
      if ('error' in response) {
        const errorObj = response.error as { message?: string; code?: string };
        errorMessage = errorObj.message || errorObj.code || JSON.stringify(errorObj);
      }
      // Check if response has choices directly
      else if ('choices' in response && Array.isArray(response.choices)) {
        content = response.choices[0]?.message?.content;
      }
    }
    
    if (errorMessage) {
      return {
        status: 'unhealthy',
        models: AI_MODELS_LIST,
        message: `API Error: ${errorMessage}`,
        configFound: true,
      };
    }
    
    return {
      status: content?.toLowerCase().includes('ok') ? 'healthy' : 'degraded',
      models: AI_MODELS_LIST,
      message: content ? `Response: ${content}` : `Unexpected response format`,
      configFound: true,
    };
  } catch (error) {
    console.error('AI service health check failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 'unhealthy',
      models: AI_MODELS_LIST,
      message: errorMessage,
      configFound: !errorMessage.includes('configuration not found'),
    };
  }
}
