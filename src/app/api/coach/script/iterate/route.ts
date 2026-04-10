import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchScript } from "@/lib/ai-service";
import { extractTextFromUrl, extractFileText } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";

// POST /api/coach/script/iterate
// Creates a new version of a script analysis, incorporating the previous analysis for iteration context.

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
    const entitlement = await requireModuleAccess(user.id, 'e2');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    const body = await request.json();
    const { parentId, script, fileUrl, fileName } = body;

    if (!parentId) {
      return NextResponse.json({ error: "Parent script ID is required" }, { status: 400 });
    }

    // Fetch the parent script
    const parentScript = await prisma.pitchScript.findFirst({
      where: { id: parentId, userId: user.id },
    });

    if (!parentScript) {
      return NextResponse.json({ error: "Parent script not found" }, { status: 404 });
    }

    // Determine script content
    let scriptText = script || "";

    if (!scriptText && fileUrl && fileName) {
      try {
        scriptText = await extractTextFromUrl(fileUrl, fileName);
      } catch (e) {
        console.error("[Script Iterate] Failed to extract from Blob URL:", e);
      }
    }

    // If no new script, use the parent's original text or rewritten version
    if (!scriptText) {
      scriptText = parentScript.rewrittenScript || parentScript.inputText || "";
    }

    if (!scriptText || scriptText.trim().length < 30) {
      return NextResponse.json(
        { error: "Insufficient script content for analysis (minimum 30 words)" },
        { status: 400 }
      );
    }

    const wordCount = scriptText.split(/\s+/).filter(Boolean).length;
    if (wordCount > 1000) {
      return NextResponse.json(
        { error: "Script is too long. Maximum 1000 words for elevator pitches." },
        { status: 400 }
      );
    }

    // Build previousAnalysis context from parent
    const previousAnalysis = {
      overallScore: parentScript.overallScore,
      hookScore: parentScript.hookScore,
      problemScore: parentScript.problemScore,
      solutionScore: parentScript.solutionScore,
      credibilityScore: parentScript.credibilityScore,
      ctaScore: parentScript.ctaScore,
      improvements: parentScript.improvements,
      rewrittenScript: parentScript.rewrittenScript,
    };

    // Run AI analysis with iteration context
    const analysis = await analyzePitchScript(
      scriptText,
      parentScript.targetAudience || undefined,
      parentScript.pitchDuration || undefined,
      previousAnalysis
    );

    const parentVersion = parentScript.version || 1;

    // Store as new script with parent reference
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        fileName: fileName || parentScript.fileName || "iteration",
        inputType: "TEXT",
        inputText: scriptText,
        targetAudience: parentScript.targetAudience || "investor",
        pitchDuration: parentScript.pitchDuration || 60,
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
        version: parentVersion + 1,
        parentScriptId: parentId,
        analyzedAt: new Date(),
      },
    });

    // Increment usage
    await prisma.usage.update({
      where: { userId: user.id },
      data: { e2ScriptCoachSessions: { increment: 1 } },
    });

    return NextResponse.json({
      success: true,
      id: savedScript.id,
      version: savedScript.version,
      parentId: parentId,
      overallScore: analysis.overallScore,
      parentOverallScore: parentScript.overallScore,
      delta: (analysis.overallScore ?? 0) - (parentScript.overallScore ?? 0),
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Script iterate error:", error);
    return NextResponse.json(
      { error: "Failed to iterate script analysis" },
      { status: 500 }
    );
  }
}
