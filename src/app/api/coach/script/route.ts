import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzeScriptWithFallback } from "@/lib/ai-service";
import type { ScriptAnalysisResult } from "@/lib/ai-service";
import { extractFileText, extractTextFromUrl } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { scriptInputSchema, scriptIterateSchema } from "@/lib/validation/schemas";
import { requireAuth } from "@/lib/with-auth";
import { withRateLimit } from "@/lib/rate-limit";
import { ALLOWED_UPLOAD_HOSTS, isHostAllowed } from "@/lib/storage";
import { activateKalProtocol, KAL_PLACEHOLDER_MESSAGE } from "@/lib/kal-protocol";
export const dynamic = 'force-dynamic';

export const maxDuration = 60;


// E2: Script Check API
// Analyzes and improves elevator pitch scripts using REAL AI


async function handlePost(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    // ── Entitlement check ──
    const entitlement = await requireModuleAccess(user.id, 'e2');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }


    // Accept both JSON body and FormData (file upload)
    let script: string = '';
    let targetAudience: string | undefined;
    let targetDuration: number | undefined;
    let sessionName: string | null = null;
    let scriptFileUrl: string | null = null;
    let detectedInputType: "TEXT" | "PDF" | "DOCX" = "TEXT";


    const contentType = request.headers.get("content-type") || "";


    if (contentType.includes("multipart/form-data")) {
      // FormData: file upload or Blob URL
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const fileUrl = formData.get("fileUrl") as string | null;
      const blobFileName = formData.get("fileName") as string | null;
      sessionName = formData.get("sessionName") as string | null;
      targetAudience = (formData.get("targetAudience") as string) || undefined;
      const rawDurationStr = formData.get("targetDuration") as string | null;
      const rawDuration = rawDurationStr ? parseInt(rawDurationStr, 10) : NaN;
      // Clamp to Zod schema bounds (min 10, max 600) — parity with JSON path
      if (Number.isFinite(rawDuration)) {
        targetDuration = Math.max(10, Math.min(600, rawDuration));
        if (rawDuration !== targetDuration) {
          console.warn(`[E2] FormData targetDuration clamped: ${rawDuration} → ${targetDuration}`);
        }
      } else {
        targetDuration = undefined;
      }


      if (!file && !fileUrl) {
        console.error("[E2] No file or fileUrl received in FormData");
        return NextResponse.json(
          { error: "File or fileUrl is required" },
          { status: 400 }
        );
      }


      // NEW: Blob upload flow — extract text from URL
      if (fileUrl && blobFileName) {
        // ── SSRF protection: validate the URL host ──
        if (!isHostAllowed(fileUrl, ALLOWED_UPLOAD_HOSTS)) {
          console.error("[E2] Rejected fileUrl — host not in allowlist:", fileUrl);
          return NextResponse.json(
            { error: "File URL not allowed. Please upload files through the app." },
            { status: 400 }
          );
        }
        scriptFileUrl = fileUrl;
        // Detect input type from file extension
        const ext = blobFileName.toLowerCase().split('.').pop();
        if (ext === 'pdf') detectedInputType = 'PDF';
        else if (ext === 'docx' || ext === 'doc') detectedInputType = 'DOCX';
        console.warn("[E2] Extracting text from Blob URL:", { fileUrl, fileName: blobFileName, inputType: detectedInputType });
        try {
          script = await extractTextFromUrl(fileUrl, blobFileName);
          console.warn("[E2] Text extracted from Blob URL, length:", script.length);
        } catch (e) {
          console.error("[E2] Failed to extract from Blob URL:", e);
          return NextResponse.json(
            { error: "Could not extract text from uploaded file. Please try uploading a different file format." },
            { status: 400 }
          );
        }
      } else if (file) {
        // Detect input type from uploaded file extension
        const ext = file.name.toLowerCase().split('.').pop();
        if (ext === 'pdf') detectedInputType = 'PDF';
        else if (ext === 'docx' || ext === 'doc') detectedInputType = 'DOCX';
        console.warn("[E2] File received:", { name: file.name, size: file.size, type: file.type, inputType: detectedInputType });


        // Server-side body size guard (legacy path only)
        if (file.size > 4.5 * 1024 * 1024) {
          return NextResponse.json(
            { error: "File too large. Maximum size is 4MB for direct upload. Please use a smaller file." },
            { status: 413 }
          );
        }


        // Extract text from file using unified parser
        try {
          script = await extractFileText(file);
          console.warn("[E2] Text extracted successfully, length:", script.length);
        } catch (e) {
          console.error("[E2] Failed to extract file text:", e);
          return NextResponse.json(
            { error: "Could not extract text from file. Please try uploading a different file format." },
            { status: 400 }
          );
        }
      }


      if (!script || script.trim().length < 20) {
        return NextResponse.json(
          { error: "Could not extract enough text from file. Please upload a text-based file." },
          { status: 400 }
        );
      }
    } else {
      // JSON body
      const body = await request.json();
      const parsed = scriptInputSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const validatedData = parsed.data;
      script = validatedData.content || '';
      targetAudience = validatedData.targetAudience;
      targetDuration = validatedData.pitchDuration;
      sessionName = validatedData.sessionName || null;
      // Set detectedInputType from the declared inputType (consistency with FormData path)
      if (validatedData.inputType) {
        detectedInputType = validatedData.inputType.toUpperCase() as "TEXT" | "PDF" | "DOCX";
      }
    }


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


    // Run AI analysis with dual-strategy fallback (Z.ai → Vertex AI)
    const analysis = await analyzeScriptWithFallback(script, targetAudience, targetDuration);

    if (!analysis) {
      // ── Kal Protocol: graceful degradation ──
      // Instead of returning a generic 503, activate the Kal Protocol
      // which marks the session as KAL_PENDING, fires a background retry,
      // and tells the user to check their dashboard.
      const savedKalSession = await prisma.pitchScript.create({
        data: {
          userId: user.id,
          fileName: sessionName || null,
          inputType: detectedInputType,
          inputText: script,
          inputFileUrl: scriptFileUrl,
          targetAudience: targetAudience || "investor",
          pitchDuration: targetDuration || 60,
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
          notes: "Kal Protocol: Analysis in progress. Check dashboard in a few minutes.",
        },
      });

      // Fire Kal Protocol (non-blocking — the user gets an immediate response)
      activateKalProtocol({
        userId: user.id,
        sessionId: savedKalSession.id,
        module: 'e2',
        model: 'glm-4-plus',
        error: 'All AI providers failed during initial request',
        inputPayload: script,
        userEmail: user.email || '',
        userName: user.firstName || undefined,
        targetAudience,
        targetDuration,
      }).catch((kalErr) => {
        console.error('[E2] Kal Protocol activation failed:', kalErr);
      });

      return NextResponse.json({
        success: true,
        kalProtocol: true,
        id: savedKalSession.id,
        message: KAL_PLACEHOLDER_MESSAGE,
      });
    }


    // NOTE: Usage is tracked atomically inside requireModuleAccess() — no separate increment needed


    // Store analysis in database using correct schema fields
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        fileName: sessionName || null,
        inputType: detectedInputType,
        inputText: script,
        inputFileUrl: scriptFileUrl,
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
  } catch (error: any) {
    console.error("[E2] SCRIPT ANALYSIS FAILED — Full error:", error);
    const msg = error?.message || String(error);
    console.error(`[E2] Error message: ${msg}`);
    console.error(`[E2] Error stack:`, error?.stack?.substring(0, 500));


    if (msg.includes("BLOB_READ_WRITE_TOKEN") || msg.includes("Blob not found") || msg.includes("Blob returned")) {
      return NextResponse.json(
        { error: "File storage access error — could not retrieve uploaded file. Please try again or contact support." },
        { status: 502 }
      );
    }
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { error: isDev ? `Script analysis error: ${msg}` : "Failed to analyze script" },
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


export async function PATCH(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const body = await request.json();
    const parsed = scriptIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const notes = validatedData.notes;


    if (!validatedData.id) {
      return NextResponse.json({ error: "Script ID is required" }, { status: 400 });
    }


    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;


    const updated = await prisma.pitchScript.update({
      where: { id: validatedData.id, userId: user.id },
      data: updateData,
    });


    return NextResponse.json({ success: true, notes: updated.notes });
  } catch (error) {
    console.error("PATCH script error:", error);
    return NextResponse.json({ error: "Failed to update script" }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get("id");


    if (!scriptId) {
      return NextResponse.json({ error: "Script ID is required" }, { status: 400 });
    }


    await prisma.pitchScript.delete({
      where: { id: scriptId, userId: user.id },
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE script error:", error);
    return NextResponse.json({ error: "Failed to delete script" }, { status: 500 });
  }
}


export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get("id");


    // Single script lookup by ID (for session detail page)
    if (scriptId) {
      const script = await prisma.pitchScript.findFirst({
        where: { id: scriptId, userId: user.id },
      });


      if (!script) {
        return NextResponse.json({ error: "Script not found" }, { status: 404 });
      }


      // Transform to match the session page's expected format
      const improvements = typeof script.improvements === "object" && script.improvements !== null
        ? script.improvements as Record<string, string[]>
        : { hook: [], problem: [], solution: [], credibility: [], cta: [] };


      const alternativeHooks = Array.isArray(script.alternativeHooks) ? script.alternativeHooks : [];


      return NextResponse.json({
        id: script.id,
        status: script.status,
        inputType: script.inputType,
        fileName: script.fileName || undefined,
        createdAt: script.createdAt,
        notes: script.notes,
        version: script.version,
        parentId: script.parentScriptId,
        targetAudience: script.targetAudience,
        // Include original script text so the session page can pass it to
        // the iterate endpoint. Without this, iterate always re-analyzes
        // the AI-rewritten version, never the user's original input.
        script: script.inputText || undefined,
        analysis: {
          scores: {
            hook: script.hookScore,
            problem: script.problemScore,
            solution: script.solutionScore,
            credibility: script.credibilityScore,
            cta: script.ctaScore,
            overall: script.overallScore,
          },
          metrics: {
            wordCount: script.wordCount || 0,
            estimatedDuration: script.estimatedDuration || 0,
          },
          improvements,
          rewrittenScript: script.rewrittenScript || "",
          alternativeHooks,
        },
      });
    }


    // List all scripts (for history page) — exclude sensitive fields
    const scripts = await prisma.pitchScript.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        fileName: true,
        overallScore: true,
        hookScore: true,
        problemScore: true,
        solutionScore: true,
        credibilityScore: true,
        ctaScore: true,
        wordCount: true,
        estimatedDuration: true,
        createdAt: true,
        analyzedAt: true,
        version: true,
        parentScriptId: true,
        notes: true,
        // Explicitly exclude: inputText, rewrittenScript, rawAnalysis
      },
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
