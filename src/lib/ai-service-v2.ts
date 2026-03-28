// Multi-Model AI Service for Pitch Perfect
// Supports: Claude (Anthropic), Gemini (Google), GLM (Z-AI)
// Model selection based on task type and cost optimization

// ============================================
// TYPE DEFINITIONS
// ============================================

export type AIProvider = 'claude' | 'gemini' | 'glm';
export type AITask = 'deck-analysis' | 'script-analysis' | 'video-analysis' | 'full-session';

export interface AIConfig {
  provider: AIProvider;
  model: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIModelMapping {
  'deck-analysis': AIConfig;
  'script-analysis': AIConfig;
  'video-analysis': AIConfig;
  'full-session': AIConfig;
}

// ============================================
// MODEL CONFIGURATION
// ============================================

export const AI_MODELS = {
  // Claude models via Anthropic
  CLAUDE_SONNET: 'claude-sonnet-4-20250514',
  CLAUDE_OPUS: 'claude-opus-4-20250514',
  
  // Gemini models via Google
  GEMINI_PRO: 'gemini-1.5-pro',
  GEMINI_FLASH: 'gemini-2.0-flash',
  GEMINI_PRO_VISION: 'gemini-1.5-pro-vision',
  
  // GLM models via Z-AI
  GLM_4_PLUS: 'glm-4-plus',
  GLM_4V_FLASH: 'glm-4v-flash',
  GLM_4V_PLUS: 'glm-4v-plus',
} as const;

// Task-to-model mapping for optimal performance/cost
export const TASK_MODEL_MAPPING: AIModelMapping = {
  'deck-analysis': {
    provider: 'claude',
    model: AI_MODELS.CLAUDE_SONNET,
    maxTokens: 4096,
    temperature: 0.3,
  },
  'script-analysis': {
    provider: 'claude',
    model: AI_MODELS.CLAUDE_SONNET,
    maxTokens: 4096,
    temperature: 0.4,
  },
  'video-analysis': {
    provider: 'gemini',
    model: AI_MODELS.GEMINI_PRO_VISION,
    maxTokens: 8192,
    temperature: 0.3,
  },
  'full-session': {
    provider: 'gemini',
    model: AI_MODELS.GEMINI_PRO,
    maxTokens: 16384,
    temperature: 0.3,
  },
};

// ============================================
// PROVIDER CLIENTS
// ============================================

// Claude (Anthropic) Client
async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY!,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.3,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.content[0]?.text || '';
  
  return {
    content,
    tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
  };
}

// Gemini (Google) Client
async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig,
  videoUrl?: string
): Promise<{ content: string; tokensUsed: number }> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  // Build contents array
  const contents: Array<{ role: string; parts: Array<{ text?: string; videoMetadata?: { videoUri: string } }> }> = [];
  
  const parts: Array<{ text?: string; videoMetadata?: { videoUri: string } }> = [];
  
  if (videoUrl) {
    // Video analysis - Gemini supports video via file URI
    parts.push({ videoMetadata: { videoUri: videoUrl } });
  }
  
  parts.push({ text: `${systemPrompt}\n\n${userPrompt}` });
  contents.push({ role: 'user', parts });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          maxOutputTokens: config.maxTokens || 8192,
          temperature: config.temperature || 0.3,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
  return {
    content,
    tokensUsed: data.usageMetadata?.totalTokenCount || 0,
  };
}

// GLM (Z-AI) Client
async function callGLM(
  systemPrompt: string,
  userPrompt: string,
  config: AIConfig,
  videoUrl?: string
): Promise<{ content: string; tokensUsed: number }> {
  // Dynamic import for Z-AI SDK
  const ZAI = (await import('z-ai-web-dev-sdk')).default;
  const zai = await ZAI.create();

  if (videoUrl && config.model.includes('4v')) {
    // Vision model for video
    const response = await zai.chat.completions.createVision({
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

    const content = response.choices[0]?.message?.content || '';
    return {
      content,
      tokensUsed: response.usage?.totalTokens || 0,
    };
  } else {
    // Text model
    const response = await zai.chat.completions.create({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: config.temperature || 0.3,
      maxTokens: config.maxTokens || 4096,
    });

    const content = response.choices[0]?.message?.content || '';
    return {
      content,
      tokensUsed: response.usage?.totalTokens || 0,
    };
  }
}

// ============================================
// UNIFIED AI CALL ROUTER
// ============================================

export async function callAI(
  task: AITask,
  systemPrompt: string,
  userPrompt: string,
  options?: {
    provider?: AIProvider;
    videoUrl?: string;
    overrideConfig?: Partial<AIConfig>;
  }
): Promise<{ content: string; tokensUsed: number; provider: AIProvider; model: string }> {
  // Get default config for task
  const defaultConfig = TASK_MODEL_MAPPING[task];
  
  // Apply overrides
  const config: AIConfig = {
    ...defaultConfig,
    ...options?.overrideConfig,
    provider: options?.provider || defaultConfig.provider,
  };

  let result: { content: string; tokensUsed: number };

  // Route to appropriate provider
  switch (config.provider) {
    case 'claude':
      result = await callClaude(systemPrompt, userPrompt, config);
      break;
    case 'gemini':
      result = await callGemini(systemPrompt, userPrompt, config, options?.videoUrl);
      break;
    case 'glm':
      result = await callGLM(systemPrompt, userPrompt, config, options?.videoUrl);
      break;
    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }

  return {
    ...result,
    provider: config.provider,
    model: config.model,
  };
}

// ============================================
// PITCH DECK ANALYSIS (E1) - CLAUDE
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
  
  // Metadata
  tokensUsed?: number;
  provider?: AIProvider;
  model?: string;
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

  const result = await callAI('deck-analysis', systemPrompt, userPrompt);

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]) as DeckAnalysisResult;
    analysis.tokensUsed = result.tokensUsed;
    analysis.provider = result.provider;
    analysis.model = result.model;
    return analysis;
  } catch (e) {
    console.error('Failed to parse AI response:', result.content);
    throw new Error('Failed to parse AI analysis response');
  }
}

// ============================================
// SCRIPT ANALYSIS (E2) - CLAUDE
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
  estimatedDuration: number;
  
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
  
  // Metadata
  tokensUsed?: number;
  provider?: AIProvider;
  model?: string;
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

  const result = await callAI('script-analysis', systemPrompt, userPrompt);

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]) as ScriptAnalysisResult;
    analysis.tokensUsed = result.tokensUsed;
    analysis.provider = result.provider;
    analysis.model = result.model;
    return analysis;
  } catch (e) {
    console.error('Failed to parse AI response:', result.content);
    throw new Error('Failed to parse AI analysis response');
  }
}

// ============================================
// VIDEO ANALYSIS (E3) - GEMINI + CLAUDE
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
  
  // Coaching Drills
  coachingDrills: Array<{
    title: string;
    description: string;
    targetArea: string;
  }>;
  
  // Transcript
  transcript: string;
  
  // Metadata
  tokensUsed?: number;
  provider?: AIProvider;
  model?: string;
}

export async function analyzePitchVideo(
  videoUrl: string,
  duration: number
): Promise<VideoAnalysisResult> {
  // Step 1: Use Gemini for video analysis
  const geminiPrompt = `Analyze this elevator pitch video recording.

Video Duration: ${duration} seconds

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

Provide your analysis as a JSON object with this EXACT structure:
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
  "keyMoments": [
    {"timestamp": "0:15", "description": "<what happened>", "type": "positive"},
    {"timestamp": "0:32", "description": "<what happened>", "type": "improvement"}
  ],
  "transcript": "<full transcript of what was said>"
}`;

  const geminiResult = await callAI('video-analysis', '', geminiPrompt, { videoUrl });
  
  let videoData: Partial<VideoAnalysisResult>;
  try {
    const jsonMatch = geminiResult.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }
    videoData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse Gemini response:', geminiResult.content);
    throw new Error('Failed to parse video analysis response');
  }

  // Step 2: Use Claude to synthesize coaching narrative
  const claudePrompt = `You are an expert public speaking coach. Based on this video analysis data, create personalized coaching feedback.

Video Analysis Data:
${JSON.stringify(videoData, null, 2)}

Provide:
1. A detailed delivery feedback paragraph
2. A detailed body language feedback paragraph  
3. THREE personalized coaching drills targeting the weakest areas

Respond as JSON:
{
  "deliveryFeedback": "<detailed paragraph about delivery strengths and improvements>",
  "bodyLanguageFeedback": "<detailed paragraph about body language strengths and improvements>",
  "coachingDrills": [
    {"title": "<drill name>", "description": "<how to do it>", "targetArea": "<pace|eye contact|gestures|etc>"},
    {"title": "<drill name>", "description": "<how to do it>", "targetArea": "<area>"},
    {"title": "<drill name>", "description": "<how to do it>", "targetArea": "<area>"}
  ]
}`;

  const claudeResult = await callAI('script-analysis', '', claudePrompt, { provider: 'claude' });
  
  let coachingData: Pick<VideoAnalysisResult, 'deliveryFeedback' | 'bodyLanguageFeedback' | 'coachingDrills'>;
  try {
    const jsonMatch = claudeResult.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    coachingData = JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error('Failed to parse Claude response:', claudeResult.content);
    // Fallback coaching data
    coachingData = {
      deliveryFeedback: 'Focus on maintaining a steady pace and reducing filler words.',
      bodyLanguageFeedback: 'Work on maintaining consistent eye contact with the camera.',
      coachingDrills: [
        { title: 'Mirror Practice', description: 'Practice your pitch in front of a mirror for 5 minutes daily', targetArea: 'body language' },
        { title: 'Pause and Breathe', description: 'Replace filler words with strategic pauses', targetArea: 'delivery' },
        { title: 'Record and Review', description: 'Record yourself and watch it back to identify patterns', targetArea: 'general' },
      ],
    };
  }

  return {
    ...videoData as VideoAnalysisResult,
    ...coachingData,
    tokensUsed: geminiResult.tokensUsed + claudeResult.tokensUsed,
    provider: 'gemini',
    model: AI_MODELS.GEMINI_PRO_VISION,
  };
}

// ============================================
// FULL PITCH SESSION ANALYSIS (E4) - GEMINI + CLAUDE
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
  
  // Metadata
  tokensUsed?: number;
  provider?: AIProvider;
  model?: string;
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

  const result = await callAI('full-session', systemPrompt, userPrompt, { videoUrl });

  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    const analysis = JSON.parse(jsonMatch[0]) as FullPitchAnalysisResult;
    analysis.tokensUsed = result.tokensUsed;
    analysis.provider = result.provider;
    analysis.model = result.model;
    return analysis;
  } catch (e) {
    console.error('Failed to parse AI response:', result.content);
    throw new Error('Failed to parse full pitch analysis response');
  }
}

// ============================================
// HEALTH CHECK
// ============================================

export async function checkAIServiceHealth(): Promise<{ 
  status: string; 
  providers: Array<{ name: string; status: string }>;
}> {
  const providers: Array<{ name: string; status: string }> = [];
  
  // Check Claude
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push({ name: 'Claude (Anthropic)', status: 'configured' });
    } else {
      providers.push({ name: 'Claude (Anthropic)', status: 'not configured' });
    }
  } catch (e) {
    providers.push({ name: 'Claude (Anthropic)', status: 'error' });
  }
  
  // Check Gemini
  try {
    if (process.env.GOOGLE_AI_API_KEY) {
      providers.push({ name: 'Gemini (Google)', status: 'configured' });
    } else {
      providers.push({ name: 'Gemini (Google)', status: 'not configured' });
    }
  } catch (e) {
    providers.push({ name: 'Gemini (Google)', status: 'error' });
  }
  
  // Check GLM (Z-AI)
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    if (zai) {
      providers.push({ name: 'GLM (Z-AI)', status: 'configured' });
    }
  } catch (e) {
    providers.push({ name: 'GLM (Z-AI)', status: 'not configured' });
  }
  
  const configuredCount = providers.filter(p => p.status === 'configured').length;
  const status = configuredCount >= 2 ? 'healthy' : configuredCount >= 1 ? 'degraded' : 'unhealthy';
  
  return { status, providers };
}
