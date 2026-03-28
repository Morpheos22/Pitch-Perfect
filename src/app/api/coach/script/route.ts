import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchScript, ScriptAnalysisResult } from "@/lib/ai-service";

// E2: Elevator Pitch Script Coach API
// Analyzes and improves elevator pitch scripts using REAL AI

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

    const body = await request.json();
    const { script, targetAudience, targetDuration } = body;

    if (!script || typeof script !== "string") {
      return NextResponse.json(
        { error: "Script content required" },
        { status: 400 }
      );
    }

    const wordCount = script.split(/\s+/).filter(Boolean).length;

    if (wordCount < 30) {
      return NextResponse.json(
        { error: "Script is too short. Please provide at least 30 words for meaningful analysis." },
        { status: 400 }
      );
    }

    if (wordCount > 1000) {
      return NextResponse.json(
        { error: "Script is too long. For elevator pitches, please keep it under 1000 words." },
        { status: 400 }
      );
    }

    // Run REAL AI analysis
    let analysis: ScriptAnalysisResult;
    try {
      analysis = await analyzePitchScript(script, targetAudience, targetDuration);
    } catch (aiError) {
      console.error("AI script analysis failed:", aiError);
      const errorMessage = aiError instanceof Error ? aiError.message : "Unknown AI error";
      return NextResponse.json(
        { 
          error: "AI analysis failed", 
          message: errorMessage,
          details: "The AI service encountered an error analyzing your script. Please try again."
        },
        { status: 500 }
      );
    }

    // Store analysis in database using correct schema fields
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        inputType: "TEXT",
        inputText: script,
        targetAudience: targetAudience || "investor",
        pitchDuration: targetDuration || 60,
        status: "COMPLETED",
        hookScore: analysis.hookScore,
        problemScore: analysis.problemScore,
        solutionScore: analysis.solutionScore,
        credibilityScore: analysis.credibilityScore,
        ctaScore: analysis.ctaScore,
        overallScore: analysis.overallScore,
        wordCount: analysis.wordCount,
        estimatedDuration: analysis.estimatedDuration,
        improvements: analysis.improvements,
        rewrittenScript: analysis.rewrittenScript,
        alternativeHooks: analysis.alternativeHooks,
        analyzedAt: new Date(),
      },
    });

    // Return real result
    return NextResponse.json({
      success: true,
      data: {
        overallScore: analysis.overallScore,
        hookScore: analysis.hookScore,
        problemScore: analysis.problemScore,
        solutionScore: analysis.solutionScore,
        credibilityScore: analysis.credibilityScore,
        ctaScore: analysis.ctaScore,
        wordCount: analysis.wordCount,
        estimatedDuration: analysis.estimatedDuration,
        improvements: analysis.improvements,
        rewrittenScript: analysis.rewrittenScript,
        alternativeHooks: analysis.alternativeHooks,
        tokensUsed: analysis.tokensUsed,
      },
      id: savedScript.id,
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Script analysis error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to analyze script", message: errorMessage },
      { status: 500 }
    );
  }
}

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

    const scripts = await prisma.pitchScript.findMany({
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
