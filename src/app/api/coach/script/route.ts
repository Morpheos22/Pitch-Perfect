import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

// E2: Elevator Pitch Script Coach API
// Analyzes and improves elevator pitch scripts
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId

interface ScriptAnalysisResult {
  overallScore: number;
  scores: {
    hook: number;
    problem: number;
    solution: number;
    credibility: number;
    cta: number;
  };
  wordCount: number;
  estimatedDuration: number;
  improvements: Array<{
    element: string;
    suggestion: string;
  }>;
  rewrittenScript: string;
  alternativeHooks: string[];
}

const SCRIPT_ANALYSIS_PROMPT = `You are an expert pitch coach specializing in elevator pitches. Analyze the provided script and provide detailed feedback.

For each element, score 0-100 and provide specific improvement suggestions:

1. HOOK (0-100): Does the opening grab attention immediately?
2. PROBLEM (0-100): Is the problem clearly articulated and relatable?
3. SOLUTION (0-100): Is the solution compelling and differentiated?
4. CREDIBILITY (0-100): Does the pitch establish trust and authority?
5. CALL-TO-ACTION (0-100): Is the ask clear and specific?

Also provide:
- A rewritten, improved version of the script (maintain the same core message)
- 3 alternative opening hooks

Keep feedback actionable and specific. Respond in JSON format.`;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { script, targetAudience } = body;

    if (!script || typeof script !== "string") {
      return NextResponse.json(
        { error: "Script content required" },
        { status: 400 }
      );
    }

    const wordCount = script.split(/\s+/).filter(Boolean).length;

    if (wordCount < 50 || wordCount > 500) {
      return NextResponse.json(
        { error: "Script should be 50-500 words for optimal analysis" },
        { status: 400 }
      );
    }

    const zai = await ZAI.create();

    // In production, call Claude Sonnet for analysis
    // const completion = await zai.chat.completions.create({
    //   messages: [
    //     { role: "system", content: SCRIPT_ANALYSIS_PROMPT },
    //     { role: "user", content: `Analyze this elevator pitch script for ${targetAudience || 'investors'}:\n\n${script}` }
    //   ],
    //   model: "claude-sonnet-4",
    // });

    // Placeholder response
    const mockResult: ScriptAnalysisResult = {
      overallScore: 82,
      scores: {
        hook: 75,
        problem: 90,
        solution: 85,
        credibility: 80,
        cta: 78,
      },
      wordCount,
      estimatedDuration: Math.round(wordCount / 3), // ~3 words per second
      improvements: [
        { element: "Hook", suggestion: "Start with a surprising statistic or bold statement" },
        { element: "Problem", suggestion: "Add specific numbers to quantify the pain" },
        { element: "Solution", suggestion: "Use a clearer before/after comparison" },
        { element: "Credibility", suggestion: "Mention a specific metric or milestone" },
        { element: "CTA", suggestion: "Make your ask more specific and time-bound" },
      ],
      rewrittenScript: `Hi, I'm [Name], founder of [Company].

Did you know that [surprising statistic]? That's a [quantified problem].

We built [Product] to change that. Our [approach] helps [target customer] achieve [specific benefit].

We already have [traction metric], and we've grown [growth rate] this year.

We're raising [amount] to [specific use of funds]. I'd love to tell you more about how we're transforming [industry].`,
      alternativeHooks: [
        "What if you could [achieve desired outcome] in half the time?",
        "[Number]% of [target audience] struggle with [problem]. We fixed that.",
        "I used to [relatable struggle]. Now I [success outcome]. Here's how.",
      ],
    };

    return NextResponse.json({
      success: true,
      data: mockResult,
    });
  } catch (error) {
    console.error("Script analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze script" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch user's script analysis history
    const scripts = await db.pitchScript.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: scripts,
    });
  } catch (error) {
    console.error("Get script history error:", error);
    return NextResponse.json(
      { error: "Failed to get script history" },
      { status: 500 }
    );
  }
}
