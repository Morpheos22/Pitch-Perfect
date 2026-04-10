import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { generateCoachingDrills } from "@/lib/ai-service";
import { requireModuleAccess } from "@/lib/entitlement";

// POST /api/coach/drills
// Generates personalized coaching drills based on an existing analysis session.

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

    // ── Entitlement check: drills require at least one module access ──
    const body = await request.json();
    const { sessionId, module: moduleType } = body;

    const moduleEntitlementMap: Record<string, 'e1' | 'e2' | 'e3' | 'e4'> = {
      deck: 'e1',
      script: 'e2',
      live: 'e3',
      full: 'e4',
    };
    const entitlementModule = moduleEntitlementMap[moduleType] || 'e1';
    const entitlement = await requireModuleAccess(user.id, entitlementModule);
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    if (!sessionId || !moduleType) {
      return NextResponse.json(
        { error: "sessionId and module are required" },
        { status: 400 }
      );
    }

    const validModules = ["deck", "script", "full", "live"] as const;
    if (!validModules.includes(moduleType)) {
      return NextResponse.json(
        { error: "Invalid module. Must be 'deck', 'script', 'full', or 'live'" },
        { status: 400 }
      );
    }

    // Fetch the session and extract scores + weaknesses + strengths
    let scores: Record<string, number> = {};
    let weaknesses: string[] = [];
    let strengths: string[] = [];

    if (moduleType === "deck") {
      const deck = await prisma.pitchDeck.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!deck) {
        return NextResponse.json({ error: "Deck not found" }, { status: 404 });
      }

      scores = {
        problemClarity: deck.problemClarityScore ?? 0,
        solutionClarity: deck.solutionClarityScore ?? 0,
        marketOpportunity: deck.marketOpportunityScore ?? 0,
        businessModel: deck.businessModelScore ?? 0,
        teamCredibility: deck.teamCredibilityScore ?? 0,
        traction: deck.tractionScore ?? 0,
        financials: deck.financialsScore ?? 0,
        askClarity: deck.askClarityScore ?? 0,
      };
      weaknesses = Array.isArray(deck.weaknesses) ? deck.weaknesses : [];
      strengths = Array.isArray(deck.strengths) ? deck.strengths : [];

    } else if (moduleType === "script") {
      const script = await prisma.pitchScript.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!script) {
        return NextResponse.json({ error: "Script not found" }, { status: 404 });
      }

      scores = {
        hook: script.hookScore ?? 0,
        problem: script.problemScore ?? 0,
        solution: script.solutionScore ?? 0,
        credibility: script.credibilityScore ?? 0,
        cta: script.ctaScore ?? 0,
      };
      // Extract weaknesses from improvements JSON
      const improvements = typeof script.improvements === "object" && script.improvements !== null
        ? script.improvements as Record<string, string[]>
        : {};
      weaknesses = Object.values(improvements).flat().slice(0, 5);
      strengths = Array.isArray(script.alternativeHooks) ? script.alternativeHooks.slice(0, 3) : [];

    } else if (moduleType === "full") {
      const session = await prisma.fullPitchSession.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!session) {
        return NextResponse.json({ error: "Full session not found" }, { status: 404 });
      }

      scores = {
        problemSolutionFit: session.problemSolutionFit ?? 0,
        marketOpportunity: session.marketOpportunity ?? 0,
        businessModelViability: session.businessModelViability ?? 0,
        teamCredibility: session.teamCredibility ?? 0,
        tractionMilestones: session.tractionMilestones ?? 0,
        deliveryPresence: session.deliveryPresence ?? 0,
      };
      weaknesses = Array.isArray(session.weaknesses) ? session.weaknesses : [];
      strengths = Array.isArray(session.strengths) ? session.strengths : [];

    } else if (moduleType === "live") {
      const video = await prisma.pitchVideo.findFirst({
        where: { id: sessionId, userId: user.id },
      });

      if (!video) {
        return NextResponse.json({ error: "Live session not found" }, { status: 404 });
      }

      scores = {
        pace: video.paceScore ?? 0,
        clarity: video.clarityScore ?? 0,
        energy: video.energyScore ?? 0,
        confidence: video.confidenceScore ?? 0,
        eyeContact: video.eyeContactScore ?? 0,
        posture: video.postureScore ?? 0,
        gestures: video.gestureScore ?? 0,
      };
      weaknesses = [];
      if (video.deliveryFeedback) weaknesses.push(video.deliveryFeedback);
      if (video.bodyLanguageFeedback && video.bodyLanguageFeedback !== video.deliveryFeedback) {
        weaknesses.push(video.bodyLanguageFeedback);
      }
      if (video.fillerWordCount && video.fillerWordCount > 0) {
        weaknesses.push(`High filler word count (${video.fillerWordCount})`);
      }
      strengths = [`Overall delivery score: ${video.overallDeliveryScore ?? 0}/100`];
      if (video.wordsPerMinute) {
        strengths.push(`Speaking rate: ${video.wordsPerMinute} WPM`);
      }
    }

    // Generate coaching drills using AI
    const drills = await generateCoachingDrills(
      moduleType,
      scores,
      weaknesses,
      strengths
    );

    return NextResponse.json({ drills });
  } catch (error) {
    console.error("Coaching drills generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate coaching drills" },
      { status: 500 }
    );
  }
}
