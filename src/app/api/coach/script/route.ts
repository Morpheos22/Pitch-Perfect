import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchScript, ScriptAnalysisResult } from "@/lib/ai-service";
import { extractFileText, extractTextFromUrl } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";

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

    // ── Entitlement check ──
    const entitlement = await requireModuleAccess(user.id, 'e2');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    // Accept both JSON body (pasted text) and FormData (file upload)
    let script: string = '';
    let targetAudience: string | undefined;
    let targetDuration: number | undefined;
    let sessionName: string | null = null;

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // FormData: file upload or Blob URL
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const fileUrl = formData.get("fileUrl") as string | null;
      const blobFileName = formData.get("fileName") as string | null;
      sessionName = formData.get("sessionName") as string | null;
      targetAudience = (formData.get("targetAudience") as string) || undefined;
      const rawDuration = formData.get("targetDuration") ? parseInt(formData.get("targetDuration") as string, 10) : undefined;
      targetDuration = Number.isFinite(rawDuration) ? rawDuration : undefined;

      if (!file && !fileUrl) {
        console.error("[E2] No file or fileUrl received in FormData");
        return NextResponse.json(
          { error: "File or fileUrl is required" },
          { status: 400 }
        );
      }

      // NEW: Blob upload flow — extract text from URL
      if (fileUrl && blobFileName) {
        console.warn("[E2] Extracting text from Blob URL:", { fileUrl, fileName: blobFileName });
        try {
          script = await extractTextFromUrl(fileUrl, blobFileName);
          console.warn("[E2] Text extracted from Blob URL, length:", script.length);
        } catch (e) {
          console.error("[E2] Failed to extract from Blob URL:", e);
          return NextResponse.json(
            { error: "Could not extract text from uploaded file. Please try pasting your script directly." },
            { status: 400 }
          );
        }
      } else if (file) {
        console.warn("[E2] File received:", { name: file.name, size: file.size, type: file.type });

        // Server-side body size guard (legacy path only)
        if (file.size > 4.5 * 1024 * 1024) {
          return NextResponse.json(
            { error: "File too large. Maximum size is 4MB. Please paste your script directly." },
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
            { error: "Could not extract text from file. Please try pasting your script directly." },
            { status: 400 }
          );
        }
      }

      if (!script || script.trim().length < 20) {
        return NextResponse.json(
          { error: "Could not extract enough text from file. Please try pasting your script directly." },
          { status: 400 }
        );
      }
    } else {
      // JSON: pasted text
      const body = await request.json();
      script = body.script;
      targetAudience = body.targetAudience;
      const rawDuration = body.targetDuration;
      targetDuration = Number.isFinite(rawDuration) ? rawDuration : undefined;
      sessionName = body.sessionName;
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

    // Run REAL AI analysis
    let analysis: ScriptAnalysisResult;
    try {
      analysis = await analyzePitchScript(script, targetAudience, targetDuration);
    } catch (aiError: any) {
      console.error("AI script analysis failed:", aiError);
      const msg = aiError?.message || String(aiError);
      const isAuthError = msg.includes('401') || msg.includes('X-Token') || msg.includes('unauthorized');
      return NextResponse.json(
        { error: isAuthError ? "AI service authentication error. Please contact support." : "AI analysis failed. Please try again." },
        { status: 503 }
      );
    }

    // NOTE: Usage is tracked atomically inside requireModuleAccess() — no separate increment needed

    // Store analysis in database using correct schema fields
    const savedScript = await prisma.pitchScript.create({
      data: {
        userId: user.id,
        fileName: sessionName || null,
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
    return NextResponse.json(
      { error: "Failed to analyze script" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const { id, notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Script ID is required" }, { status: 400 });
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json({ error: "Notes must be a string" }, { status: 400 });
    }
    if (typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json({ error: "Notes must be under 2000 characters" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.pitchScript.update({
      where: { id, userId: user.id },
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
