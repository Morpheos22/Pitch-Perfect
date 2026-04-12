import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchScript } from "@/lib/ai-service";
import { extractTextFromUrl, extractFileText } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { scriptIterateSchema } from "@/lib/validation/schemas";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// POST /api/coach/script/iterate
// Creates a new version of a script analysis, incorporating the previous analysis for iteration context.

async function handlePost(request: NextRequest) {
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
    const parsed = scriptIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const parentId = validatedData.id;
    const { script, fileUrl, fileName } = body;

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
      const ALLOWED_HOSTS = ['blob.vercel-storage.com', 'public.blob.vercel-storage.com', 'workdrive.zoho.com', 'zoho.com'];
      try {
        const parsedUrl = new URL(fileUrl);
        const isAllowed = ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
        if (!isAllowed) {
          return NextResponse.json({ error: 'Invalid file source.' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Invalid file URL format.' }, { status: 400 });
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
    } as any;

    // Run AI analysis with iteration context
    const analysis = await analyzePitchScript(
      scriptText,
      parentScript.targetAudience || undefined,
      parentScript.pitchDuration || undefined,
      previousAnalysis
    );

    // Determine version number — query DB for max existing version to prevent race conditions
    const latestVersion = await prisma.pitchScript.findFirst({
      where: { parentScriptId: parentId, userId: user.id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const nextVersion = (latestVersion?.version || parentScript.version || 1) + 1;

    // Store as new script with parent reference
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        fileName: fileName || parentScript.fileName || "iteration",
        inputType: detectedInputType,
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
