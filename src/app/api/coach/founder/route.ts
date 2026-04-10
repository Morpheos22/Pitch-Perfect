import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { MODULE_MODEL_MAP, type ModuleModelKey, executeWithFallback } from "@/lib/ai-service";
import { webSearch, synthesizeSpeech } from "@/lib/zai-capabilities";
import { requireModuleAccess } from "@/lib/entitlement";

// E5: Pitch Founder API
// Routes to appropriate AI service based on moduleType

const E5_MODULE_KEYS: Record<string, ModuleModelKey> = {
  FOUNDER_READINESS: "E5_FOUNDER_READINESS",
  PATHWAY_RECOMMENDATION: "E5_PATHWAY_RECOMMENDATION",
  INVESTOR_RESEARCH: "E5_INVESTOR_RESEARCH",
  COHORT_MATCHING: "E5_COHORT_MATCHING",
  NETWORK_PROFILE: "E5_NETWORK_PROFILE",
  PATHWAY_NARRATION: "E5_PATHWAY_NARRATION",
};

// ============================================
// PROMPT BUILDERS per module
// ============================================

function buildReadinessPrompt(input: Record<string, unknown>) {
  return {
    system: `You are a senior startup advisor who has helped hundreds of African founders prepare for investor pitches. Evaluate the founder's readiness across 6 dimensions and recommend Path A (Grit to Gear) or Path B (AfriFlow Direct).

SCORING DIMENSIONS (0-100 each):
1. Deck Quality: Is the pitch deck professional, complete, and compelling?
2. Pitch Confidence: Does the founder communicate with clarity and conviction?
3. Market Timing: Is the market ready for this solution? Is the timing right?
4. Team Readiness: Does the team have the skills and capacity to execute?
5. Traction Evidence: Is there proof of product-market fit or customer interest?
6. Financial Understanding: Does the founder understand unit economics and fundraising?

PATHWAY CRITERIA:
- Path A (Grit to Gear): Score 0-65 overall — needs structured support, mentorship, cohort learning
- Path B (AfriFlow Direct): Score 66-100 overall — investor-ready, can go directly to VCs

Respond ONLY in valid JSON format without any markdown formatting.`,
    user: `Evaluate this founder's investor readiness:

Startup Name: ${input.startupName || "Not provided"}
Industry/Sector: ${input.sector || "Not provided"}
Stage: ${input.stage || "Pre-seed"}
Founded: ${input.foundedDate || "Not provided"}
Team Size: ${input.teamSize || "Not provided"}
Country: ${input.country || "Not provided"}

Has Pitch Deck: ${input.hasDeck ? "Yes" : "No"}
Deck Score (if available): ${input.deckScore || "Not yet analyzed"}

Has Practiced Pitch: ${input.hasPracticed ? "Yes" : "No"}
Pitch Confidence (self-rated 1-10): ${input.pitchConfidence || "Not rated"}

Monthly Revenue: ${input.monthlyRevenue || "Pre-revenue"}
Active Users: ${input.activeUsers || "N/A"}
Key Partnerships: ${input.partnerships || "None yet"}

Prior Fundraising: ${input.priorFundraising || "None"}
Target Raise: ${input.targetRaise || "Not specified"}

Describe your biggest strength: ${input.biggestStrength || "Not provided"}
Biggest challenge: ${input.biggestChallenge || "Not provided"}

Provide your assessment as a JSON object:
{
  "scores": {
    "deckQuality": <0-100>,
    "pitchConfidence": <0-100>,
    "marketTiming": <0-100>,
    "teamReadiness": <0-100>,
    "tractionEvidence": <0-100>,
    "financialUnderstanding": <0-100>
  },
  "overallScore": <0-100>,
  "recommendedPathway": "<GRIT_TO_GEAR or AFRIFLOW_DIRECT>",
  "pathwayConfidence": <0-100>,
  "strengths": ["<s1>", "<s2>", "<s3>"],
  "improvements": ["<i1>", "<i2>", "<i3>", "<i4>"],
  "summary": "<2-3 sentence overall assessment>",
  "nextSteps": ["<step1>", "<step2>", "<step3>"]
}`,
  };
}

function buildPathwayPrompt(input: Record<string, unknown>) {
  return {
    system: `You are a pathway advisor for the Automagikal Network, specializing in African startup ecosystems. Compare the two pathways and recommend the best fit for this founder.

TWO PATHWAYS:

Path A: Grit to Gear
- Discounted cohort program at Small Axe
- Small Axe education modules (business fundamentals, pitch mastery)
- 1-on-1 mentorship with experienced founders/investors
- Certification upon completion
- Access to AfriFlow investor network after certification
- Timeline: 3-6 months
- Cost: Discounted (subsidized by Automagikal)
- Best for: Early-stage founders needing structured support

Path B: AfriFlow Direct
- Full price access to investor network
- Deck review and polish before VC introductions
- Direct introductions to matching investors
- Immediate access (no educational prerequisites)
- Higher cost but faster route
- Best for: Fundraising-ready founders with strong decks

Respond ONLY in valid JSON format without any markdown formatting.`,
    user: `Recommend the best pathway for this founder:

Startup: ${input.startupName || "Not provided"}
Sector: ${input.sector || "Not provided"}
Stage: ${input.stage || "Pre-seed"}
Country: ${input.country || "Not provided"}

Readiness Scores (if available):
- Overall: ${input.overallScore || "Not assessed"}
- Deck Quality: ${input.deckScore || "Not assessed"}
- Pitch Confidence: ${input.pitchConfidence || "Not assessed"}
- Traction: ${input.tractionScore || "Not assessed"}

Goals: ${input.goals || "Raise funding, grow network"}
Timeline: ${input.timeline || "Flexible"}
Budget for program: ${input.budget || "Limited"}
Previous startup experience: ${input.previousExperience || "First-time founder"}

Provide your recommendation as JSON:
{
  "recommendedPathway": "<GRIT_TO_GEAR or AFRIFLOW_DIRECT>",
  "confidence": <0-100>,
  "pathAAnalysis": {
    "fitScore": <0-100>,
    "pros": ["<p1>", "<p2>"],
    "cons": ["<c1>"],
    "estimatedTimeline": "<e.g. 4 months>"
  },
  "pathBAnalysis": {
    "fitScore": <0-100>,
    "pros": ["<p1>", "<p2>"],
    "cons": ["<c1>"],
    "estimatedTimeline": "<e.g. 2 months>"
  },
  "keyFactors": ["<factor1>", "<factor2>", "<factor3>"],
  "recommendation": "<detailed paragraph explaining the recommendation>",
  "immediateActions": ["<action1>", "<action2>"]
}`,
  };
}

function buildInvestorResearchPrompt(input: Record<string, unknown>) {
  return {
    system: `You are an investor research analyst specializing in the African startup ecosystem. Based on the search results provided, identify the most relevant investors for this startup and provide actionable outreach guidance.

Note: Web search results will be provided separately. Use them to ground your analysis in real, current data.

Respond ONLY in valid JSON format without any markdown formatting.`,
    user: `Research investors for this startup:

Startup: ${input.startupName || "Not provided"}
Sector: ${input.sector || "Technology"}
Stage: ${input.stage || "Pre-seed"}
Country: ${input.country || "South Africa"}
Target Raise: ${input.targetRaise || "Not specified"}
Traction: ${input.traction || "Early stage"}

Web search results for relevant investors:
${input.searchResults || "No search results available. Provide general guidance based on the startup profile."}

Provide your analysis as JSON:
{
  "investors": [
    {
      "name": "<investor/fund name>",
      "type": "<VC/Angel/Accelerator/Fund>",
      "focusAreas": ["<area1>", "<area2>"],
      "stageFit": "<Strong/Good/Moderate>",
      "geography": "<region/country>",
      "dealSize": "<typical deal size>",
      "notablePortfolio": ["<company1>"],
      "outreachTip": "<specific tip for this investor>"
    }
  ],
  "marketInsights": ["<insight1>", "<insight2>", "<insight3>"],
  "outreachStrategy": {
    "recommendedOrder": ["<investor1>", "<investor2>"],
    "warmIntroductionTips": ["<tip1>"],
    "commonMistakes": ["<mistake1>"]
  },
  "overallAssessment": "<paragraph summary>"
}`,
  };
}

function buildCohortMatchingPrompt(input: Record<string, unknown>) {
  return {
    system: `You are a cohort placement advisor for Small Axe, an African startup accelerator. Assess founder fit for upcoming cohorts and recommend the best match.

SMALL AXE COHORT TYPES:
- Discovery: For idea-stage founders (0-3 months)
- Build: For MVP-stage founders (3-6 months)
- Growth: For revenue-generating startups (3 months)
- Scale: For post-revenue scaling (6 months)

Respond ONLY in valid JSON format without any markdown formatting.`,
    user: `Match this founder with the best Small Axe cohort:

Startup: ${input.startupName || "Not provided"}
Sector: ${input.sector || "Technology"}
Stage: ${input.stage || "Idea"}
Team Size: ${input.teamSize || "1"}
Country: ${input.country || "Not provided"}

Has MVP: ${input.hasMVP ? "Yes" : "No"}
Monthly Revenue: ${input.monthlyRevenue || "Pre-revenue"}
Users: ${input.activeUsers || "0"}
Prior Accelerator: ${input.priorAccelerator || "None"}

Key skills needed: ${input.skillsNeeded || "Business strategy, fundraising"}
Learning goals: ${input.learningGoals || "Not specified"}

Preferred cohort format: ${input.cohortFormat || "Flexible"}
Available time commitment: ${input.timeCommitment || "Part-time"}

Provide your matching as JSON:
{
  "recommendedCohort": {
    "name": "<Discovery/Build/Growth/Scale>",
    "fitScore": <0-100>,
    "startDate": "<estimated>",
    "duration": "<e.g. 3 months>",
    "reasons": ["<r1>", "<r2>", "<r3>"]
  },
  "alternativeCohorts": [
    {
      "name": "<cohort name>",
      "fitScore": <0-100>,
      "reason": "<why this is also a fit>"
    }
  ],
  "mentorAlignment": ["<mentor area 1>", "<mentor area 2>"],
  "certificationTrack": "<recommended track>",
  "preparationNeeded": ["<action1>", "<action2>"],
  "summary": "<paragraph about why this match>"
}`,
  };
}

function buildNetworkProfilePrompt(input: Record<string, unknown>) {
  return {
    system: `You are a personal branding expert for African tech founders. Create a compelling investor-facing network profile that highlights the founder's unique value proposition and makes them stand out in the Automagikal Network.

Respond ONLY in valid JSON format without any markdown formatting.`,
    user: `Build an investor network profile for this founder:

Name: ${input.firstName || ""} ${input.lastName || ""}
Startup: ${input.startupName || "Not provided"}
Sector: ${input.sector || "Technology"}
Role: ${input.role || "Founder/CEO"}
Country: ${input.country || "Not provided"}

Brief Bio: ${input.bio || "Not provided"}
Key Achievement: ${input.keyAchievement || "Not provided"}
Unique Value Prop: ${input.uniqueValueProp || "Not provided"}

Prior Experience: ${input.priorExperience || "Not provided"}
Education: ${input.education || "Not provided"}
Skills: ${input.skills || "Not provided"}

Current Metrics: ${input.metrics || "Pre-revenue"}
Traction Highlights: ${input.tractionHighlights || "Not yet available"}

Social Links: LinkedIn ${input.linkedin || "N/A"}, Twitter ${input.twitter || "N/A"}

Create the profile as JSON:
{
  "tagline": "<one-line investor pitch for this founder>",
  "elevatorBio": "<100-word compelling bio>",
  "extendedBio": "<250-word detailed profile>",
  "highlights": ["<highlight1>", "<highlight2>", "<highlight3>", "<highlight4>"],
  "investorHooks": ["<what makes this founder investable - hook 1>", "<hook 2>"],
  "riskFactors": ["<potential concern 1>", "<concern 2>"],
  "networkTags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>", "<tag5>"],
  "afriFlowReadiness": {
    "score": <0-100>,
    "ready": true/false,
    "gaps": ["<gap1>"]
  },
  "recommendedImprovements": ["<improvement1>", "<improvement2>"]
}`,
  };
}

function buildNarrationPrompt(input: Record<string, unknown>) {
  return {
    system: `You are a warm, encouraging mentor explaining the founder's pathway in the Pitch Perfect × Automagikal program. Write a clear, conversational narration that explains their recommended path, what to expect, and next steps. This will be converted to speech via TTS.

IMPORTANT: Write as if speaking directly to the founder. Use first person ("you", "your"). Keep sentences short and natural for speech synthesis. Avoid complex punctuation or abbreviations that might trip up text-to-speech.

The narration should be 200-400 words (about 2-3 minutes when spoken).`,
    user: `Write a TTS narration for this founder's pathway:

Founder Name: ${input.firstName || "Founder"}
Startup: ${input.startupName || "their startup"}
Recommended Pathway: ${input.recommendedPathway || "Not yet determined"}
Pathway Confidence: ${input.pathwayConfidence || "N/A"}

Key Assessment Results:
- Overall Score: ${input.overallScore || "N/A"}/100
- Strengths: ${input.strengths || "To be determined"}
- Improvements Needed: ${input.improvements || "To be determined"}
- Next Steps: ${input.nextSteps || "To be determined"}

Pathway Details:
Path A - Grit to Gear: ${input.pathADetails || "Cohort → Education → Mentorship → Certification → AfriFlow → Network"}
Path B - AfriFlow Direct: ${input.pathBDetails || "Full price → Deck before VCs → Immediate access → Network"}

Write ONLY the narration text (no JSON, no markdown). Just the speech text to be narrated.`,
  };
}

// ============================================
// AI EXECUTION HELPER — uses shared fallback chain
// ============================================

async function executeAIAnalysis(
  moduleKey: ModuleModelKey,
  systemPrompt: string,
  userPrompt: string,
  parseAsJson = true
) {
  const { response, modelUsed, moduleKey: mk } = await executeWithFallback(moduleKey, (model) => ({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: MODULE_MODEL_MAP[moduleKey].temperature,
  }));

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('No response from AI');

  if (parseAsJson) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No valid JSON in AI response');
    return {
      result: JSON.parse(jsonMatch[0]),
      modelUsed,
      tokensUsed: response.usage?.totalTokens,
    };
  }

  return {
    result: content,
    modelUsed,
    tokensUsed: response.usage?.totalTokens,
  };
}

// ============================================
// POST HANDLER
// ============================================

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Entitlement check ──
    const entitlement = await requireModuleAccess(user.id, 'e5');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    const body = await request.json();
    const { moduleType, input } = body;

    // Input validation
    if (typeof input !== 'object' || input === null) {
      return NextResponse.json({ error: 'Invalid input format' }, { status: 400 });
    }
    const inputStr = JSON.stringify(input);
    if (inputStr.length > 50000) {
      return NextResponse.json({ error: 'Input exceeds maximum allowed size' }, { status: 400 });
    }
    if (typeof moduleType !== 'string' || !moduleType) {
      return NextResponse.json({ error: 'Invalid module type' }, { status: 400 });
    }

    const moduleKey = E5_MODULE_KEYS[moduleType];
    if (!moduleKey) {
      return NextResponse.json(
        { error: `Invalid moduleType: ${moduleType}` },
        { status: 400 }
      );
    }

    // Create session record
    const session = await prisma.founderSession.create({
      data: {
        userId: user.id,
        moduleType: moduleType as any,
        status: "PROCESSING",
        inputData: input,
      },
    });

    try {
      let analysisResult: any;
      let modelUsed: string | undefined;
      let tokensUsed: number | undefined;
      let overallScore: number | undefined;
      let recommendedPathway: string | undefined;
      let audioBase64: string | undefined;

      switch (moduleType) {
        case "FOUNDER_READINESS": {
          const prompts = buildReadinessPrompt(input);
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user
          );
          analysisResult = result;
          modelUsed = mu;
          tokensUsed = tu;
          overallScore = result.overallScore;
          recommendedPathway = result.recommendedPathway;
          break;
        }

        case "PATHWAY_RECOMMENDATION": {
          const prompts = buildPathwayPrompt(input);
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user
          );
          analysisResult = result;
          modelUsed = mu;
          tokensUsed = tu;
          recommendedPathway = result.recommendedPathway;
          break;
        }

        case "INVESTOR_RESEARCH": {
          // Run web search first
          let searchResultsText = "No search results available.";
          try {
            const sector = input.sector || "african startups";
            const stage = input.stage || "pre-seed";
            const country = input.country || "africa";
            const searchQuery = `${sector} ${stage} startups investors funding ${country} 2024 2025`;
            const searchResults = await webSearch(searchQuery, { num: 8 });
            searchResultsText = searchResults
              .map(
                (r) =>
                  `- ${r.name}: ${r.snippet} (${r.url})`
              )
              .join("\n");
          } catch (searchErr) {
            console.warn("[E5] Web search failed:", searchErr);
          }

          const prompts = buildInvestorResearchPrompt({
            ...input,
            searchResults: searchResultsText,
          });
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user
          );
          analysisResult = result;
          modelUsed = mu;
          tokensUsed = tu;
          break;
        }

        case "COHORT_MATCHING": {
          const prompts = buildCohortMatchingPrompt(input);
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user
          );
          analysisResult = result;
          modelUsed = mu;
          tokensUsed = tu;
          break;
        }

        case "NETWORK_PROFILE": {
          const prompts = buildNetworkProfilePrompt(input);
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user
          );
          analysisResult = result;
          modelUsed = mu;
          tokensUsed = tu;
          break;
        }

        case "PATHWAY_NARRATION": {
          const prompts = buildNarrationPrompt(input);
          const { result, modelUsed: mu, tokensUsed: tu } = await executeAIAnalysis(
            moduleKey,
            prompts.system,
            prompts.user,
            false // Don't parse as JSON — we need raw text for TTS
          );

          // Generate TTS audio
          try {
            const audioBuffer = await synthesizeSpeech(result as string, {
              voice: "tongtong",
              speed: 1.0,
              responseFormat: "wav",
            });
            audioBase64 = audioBuffer.toString("base64");
          } catch (ttsErr) {
            console.warn("[E5] TTS generation failed:", ttsErr);
            // Continue without audio — text narration is still valuable
          }

          analysisResult = { narrationText: result };
          modelUsed = mu;
          tokensUsed = tu;
          break;
        }

        default: {
          return NextResponse.json(
            { error: `Unknown module: ${moduleType}` },
            { status: 400 }
          );
        }
      }

      // Update session with results
      await prisma.founderSession.update({
        where: { id: session.id },
        data: {
          status: "COMPLETED",
          resultData: analysisResult,
          overallScore,
          recommendedPathway,
          audioBase64,
          modelUsed,
          tokensUsed,
          analyzedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        id: session.id,
        moduleType,
        data: analysisResult,
        overallScore,
        recommendedPathway,
        modelUsed,
        tokensUsed,
        audioBase64: audioBase64 || undefined,
      });
    } catch (aiError) {
      // Mark session as failed
      await prisma.founderSession.update({
        where: { id: session.id },
        data: { status: "FAILED" },
      });

      console.error(`[E5] AI analysis failed for ${moduleType}:`, aiError);
      const msg = (aiError as any)?.message || String(aiError);
      const isAuthError = msg.includes('401') || msg.includes('X-Token') || msg.includes('unauthorized');
      return NextResponse.json(
        { error: isAuthError ? "AI service authentication error. Please contact support." : "AI analysis failed. Please try again." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[E5] Founder API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ============================================
// GET HANDLER
// ============================================

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");
    const moduleType = searchParams.get("moduleType");

    // Single session lookup
    if (sessionId) {
      const session = await prisma.founderSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: session.id,
        moduleType: session.moduleType,
        status: session.status,
        inputData: session.inputData,
        resultData: session.resultData,
        overallScore: session.overallScore,
        recommendedPathway: session.recommendedPathway,
        audioBase64: session.audioBase64,
        modelUsed: session.modelUsed,
        tokensUsed: session.tokensUsed,
        createdAt: session.createdAt,
        analyzedAt: session.analyzedAt,
      });
    }

    // List sessions with optional filter
    const where: Record<string, unknown> = { userId: user.id };
    if (moduleType) {
      where.moduleType = moduleType;
    }

    const sessions = await prisma.founderSession.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        moduleType: true,
        status: true,
        overallScore: true,
        recommendedPathway: true,
        modelUsed: true,
        createdAt: true,
        analyzedAt: true,
      },
    });

    // Group by module type for progress tracking
    const moduleTypes = Object.keys(E5_MODULE_KEYS);
    const grouped = moduleTypes.reduce(
      (acc, type) => {
        const session = sessions.find((s) => s.moduleType === type && s.status === "COMPLETED");
        if (session) {
          acc.push({
            moduleType: type,
            completedAt: session.analyzedAt?.toISOString(),
            overallScore: session.overallScore,
            recommendedPathway: session.recommendedPathway,
          });
        }
        return acc;
      },
      [] as { moduleType: string; completedAt?: string; overallScore?: number | null; recommendedPathway?: string | null }[]
    );

    return NextResponse.json({
      success: true,
      sessions: grouped,
      allSessions: sessions,
    });
  } catch (error) {
    console.error("[E5] GET founder history error:", error);
    return NextResponse.json(
      { error: "Failed to fetch founder history" },
      { status: 500 }
    );
  }
}
