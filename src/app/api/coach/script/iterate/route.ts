import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeScriptWithFallback } from "@/lib/ai-service";
import { extractTextFromUrl, extractFileText } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { scriptIterateSchema } from "@/lib/validation/schemas";
import { ALLOWED_UPLOAD_HOSTS, isHostAllowed } from "@/lib/storage";
import { requireAuth } from "@/lib/with-auth";
import { withRateLimit } from "@/lib/rate-limit";
import { activateKalProtocol } from "@/lib/kal-protocol";
export const dynamic = 'force-dynamic';

export const maxDuration = 60;


// POST /api/coach/script/iterate
// Creates a new version of a script analysis, incorporating the previous analysis for iteration context.


async function handlePost(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    // ── Entitlement check ──
    const entitlement = await requireModuleAccess(user.id, 'e2');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }


    const body = await request.json();
    const parsed = scriptIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const parentId = validatedData.id;
    // Use validated fields instead of raw body — prevents injection of unvalidated fileUrl/fileName
    const script = validatedData.script;
    const fileUrl = validatedData.fileUrl;
    const fileName = validatedData.fileName;


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


    // Determine script content and input type
    let scriptText = script || "";
    let detectedInputType: "TEXT" | "PDF" | "DOCX" = parentScript.inputType || "TEXT";


    if (!scriptText && fileUrl && fileName) {
      // Detect input type from file extension
      const ext = fileName.toLowerCase().split('.').pop();
      if (ext === 'pdf') detectedInputType = 'PDF';
      else if (ext === 'docx' || ext === 'doc') detectedInputType = 'DOCX';
      // SSRF prevention: validate file URL host
      if (!isHostAllowed(fileUrl, ALLOWED_UPLOAD_HOSTS)) {
        return NextResponse.json({ error: 'Invalid file source.' }, { status: 400 });
      }
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


    // Build previousAnalysis context from parent (coerce null → defaults for type safety)
    const previousAnalysis = {
      overallScore: parentScript.overallScore ?? 0,
      hookScore: parentScript.hookScore ?? undefined,
      problemScore: parentScript.problemScore ?? undefined,
      solutionScore: parentScript.solutionScore ?? undefined,
      credibilityScore: parentScript.credibilityScore ?? undefined,
      ctaScore: parentScript.ctaScore ?? undefined,
      improvements: parentScript.improvements,
      rewrittenScript: parentScript.rewrittenScript ?? undefined,
    } as { overallScore: number; hookScore?: number; problemScore?: number; solutionScore?: number; credibilityScore?: number; ctaScore?: number; improvements?: Record<string, string[]>; rewrittenScript?: string };


    // Determine version number — query DB for max existing version to prevent race conditions
    const latestVersion = await prisma.pitchScript.findFirst({
      where: { parentScriptId: parentId, userId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version || parentScript.version || 1) + 1;

    // Run AI analysis with dual-strategy fallback (Z.ai → Vertex AI)
    const analysis = await analyzeScriptWithFallback(
      scriptText,
      parentScript.targetAudience || undefined,
      parentScript.pitchDuration || undefined,
      previousAnalysis,
      '[E2 Iterate]'
    );

    if (!analysis) {
      // ── Kal Protocol: graceful degradation on iterate failure ──
      // Instead of returning a raw 503, activate Kal Protocol V1 which
      // marks the session as KAL_PENDING, fires a background retry,
      // and emails the user when results are ready.
      const savedKalIteration = await prisma.pitchScript.create({
        data: {
          userId: user.id,
          fileName: fileName || parentScript.fileName || "iteration",
          inputType: detectedInputType,
          inputText: scriptText,
          inputFileUrl: fileUrl || parentScript.inputFileUrl,
          targetAudience: parentScript.targetAudience || "investor",
          pitchDuration: parentScript.pitchDuration || 60,
          status: "KAL_PENDING",
          hookScore: 0,
          problemScore: 0,
          solutionScore: 0,
          credibilityScore: 0,
          ctaScore: 0,
          overallScore: 0,
          wordCount: wordCount,
          estimatedDuration: Math.round(wordCount / 2.5),
          improvements: { hook: [], problem: [], solution: [], credibility: [], cta: [] },
          rewrittenScript: "",
          alternativeHooks: [],
          version: nextVersion,
          parentScriptId: parentId,
          notes: "Kal Protocol: Iteration analysis in progress. Results will appear shortly.",
        },
      });

      // Fire Kal Protocol (non-blocking)
      activateKalProtocol({
        userId: user.id,
        sessionId: savedKalIteration.id,
        module: 'e2',
        model: 'glm-4-plus',
        error: 'All AI providers failed during iteration',
        inputPayload: scriptText,
        userEmail: (user as Record<string, unknown>).email as string || '',
        userName: (user as Record<string, unknown>).firstName as string || undefined,
        targetAudience: parentScript.targetAudience || undefined,
        targetDuration: parentScript.pitchDuration || undefined,
      }).catch((kalErr) => {
        console.error('[E2 Iterate] Kal Protocol activation failed:', kalErr);
      });

      return NextResponse.json({
        kalProtocol: true,
        id: savedKalIteration.id,
        message: "Analysis is being processed in the background. Check your dashboard in a few minutes.",
      });
    }


    // Store as new script with parent reference
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        fileName: fileName || parentScript.fileName || "iteration",
        inputType: detectedInputType,
        inputText: scriptText,
        inputFileUrl: fileUrl || parentScript.inputFileUrl, // Preserve blob URL for ownership verification
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
        version: nextVersion,
        parentScriptId: parentId,
        analyzedAt: new Date(),
      },
    });


    // NOTE: Usage is tracked atomically inside requireModuleAccess() — no separate increment needed


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


export const POST = withRateLimit(handlePost, {
  limit: 5,
  windowMs: 60_000,
  identifierType: 'both',
  name: 'AI Analysis',
});
