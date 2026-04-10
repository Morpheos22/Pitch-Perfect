import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, analyzeDeckVisual, DeckAnalysisResult } from "@/lib/ai-service";
import { extractFileText, extractTextFromUrl } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";

// E1: Pitch Deck Analyser API
// Analyzes uploaded pitch deck for content and visual quality using REAL AI

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
    const entitlement = await requireModuleAccess(user.id, 'e1');
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const fileUrl = formData.get("fileUrl") as string | null;
    const fileName = formData.get("fileName") as string | null;
    const deckContent = formData.get("content") as string;
    const sessionName = formData.get("sessionName") as string | null;
    const fileSizeStr = formData.get("fileSize") as string | null;

    if (!file && !deckContent && !fileUrl) {
      return NextResponse.json(
        { error: "Either file, fileUrl, or content is required" },
        { status: 400 }
      );
    }

    // Validate file if provided
    if (file) {
      const allowedTypes = [
        "application/pdf",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
      ];
      const isAllowedType = allowedTypes.includes(file.type) || 
        file.name.endsWith(".pdf") || 
        file.name.endsWith(".pptx") ||
        file.name.endsWith(".ppt") ||
        file.name.endsWith(".txt");
      
      if (!isAllowedType) {
        return NextResponse.json(
          { error: `Invalid file type (${file.type || 'unknown'}). Supported formats: PDF, PPTX, PPT, TXT.` },
          { status: 400 }
        );
      }

      // Vercel Hobby body limit guard
      const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;
      if (!Number.isFinite(file.size) || file.size > VERCEL_BODY_LIMIT) {
        return NextResponse.json(
          { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Vercel limits uploads to 4.5MB. Try pasting your deck content directly.` },
          { status: 413 }
        );
      }
    }

    // Get content for analysis
    // Priority: deckContent (pasted) > fileUrl (Blob upload) > file (legacy upload)
    let analysisContent = deckContent || "";

    if (!analysisContent && fileUrl && fileName) {
      // NEW: Blob upload flow — fetch from URL, extract text
      console.warn("[E1] Extracting text from Blob URL:", { fileUrl, fileName });
      try {
        analysisContent = await extractTextFromUrl(fileUrl, fileName);
        console.warn("[E1] Text extracted from Blob URL, length:", analysisContent.length);
      } catch (e) {
        console.error("[E1] Failed to extract from Blob URL:", e);
        return NextResponse.json(
          { error: "Failed to process uploaded file. Please try pasting content directly." },
          { status: 400 }
        );
      }
    }

    if (!analysisContent && file && !deckContent) {
      // LEGACY: Direct file upload (for backward compat / small files)
      console.warn("[E1] Extracting text from file:", { name: file.name, size: file.size, type: file.type });
      try {
        analysisContent = await extractFileText(file);
        console.warn("[E1] Text extracted, length:", analysisContent.length);
      } catch (e: any) {
        console.error("[E1] Failed to extract file content:", e);
        const hint = e?.message?.includes("PDF")
          ? " This PDF may be password-protected, scanned (image-only), or corrupted. Try pasting your deck content directly."
          : "";
        return NextResponse.json(
          { error: `Failed to read file content.${hint}` },
          { status: 400 }
        );
      }
    }

    // Truncate if content exceeds maximum length
    const MAX_CONTENT_LENGTH = 50000;
    if (analysisContent.length > MAX_CONTENT_LENGTH) {
      analysisContent = analysisContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated at 50,000 characters]";
    }

    if (!analysisContent || analysisContent.length < 50) {
      return NextResponse.json(
        { error: "Insufficient content for analysis. Could not extract enough text — the file may be image-based or empty. Please paste your deck content directly." },
        { status: 400 }
      );
    }

    // Run AI analyses in parallel: content (text) + visual (vision)
    // Visual analysis requires a public URL (blob upload only).
    // Legacy file uploads have no public URL, so skip visual audit for those.
    const visualUrl = fileUrl || null;
    const hasVisualInput = !!visualUrl;

    let analysis: DeckAnalysisResult;
    try {
      const [contentResult, visualResult] = await Promise.allSettled([
        analyzePitchDeck(analysisContent),
        hasVisualInput && visualUrl
          ? analyzeDeckVisual(visualUrl)
          : Promise.resolve(null),
      ]);

      if (contentResult.status === 'rejected') {
        throw contentResult.reason;
      }
      analysis = contentResult.value;

      // Merge visual scores from vision model if available
      if (visualResult.status === 'fulfilled' && visualResult.value) {
        const visual = visualResult.value;
        analysis.designConsistencyScore = visual.designConsistencyScore;
        analysis.readabilityScore = visual.readabilityScore;
        analysis.visualHierarchyScore = visual.visualHierarchyScore;
        analysis.colorSchemeScore = visual.colorSchemeScore;
        analysis.typographyScore = visual.typographyScore;

        // Enrich feedback with visual-specific insights
        if (visual.visualWeaknesses.length > 0) {
          analysis.weaknesses = [...analysis.weaknesses, ...visual.visualWeaknesses.slice(0, 2)];
        }
        if (visual.visualRecommendations.length > 0) {
          analysis.recommendations = [...analysis.recommendations, ...visual.visualRecommendations.slice(0, 2)];
        }

        console.warn("[E1] Visual audit merged from vision model");
      } else if (visualResult.status === 'rejected') {
        console.warn("[E1] Visual audit skipped — vision model unavailable, using content-only visual scores");
      }
    } catch (aiError: any) {
      console.error("[E1] AI deck analysis FAILED:", aiError);
      const msg = aiError?.message || String(aiError);
      console.error(`[E1] Full error:`, msg);
      const isAuthError = msg.includes('401') || msg.includes('X-Token') || msg.includes('unauthorized');
      // Full error already logged server-side above; do not expose details to client
      return NextResponse.json(
        { error: isAuthError ? "AI service authentication error. Please contact support." : "AI analysis failed. Please try again." },
        { status: 503 }
      );
    }

    // Store analysis in database
    const savedDeck = await prisma.pitchDeck.create({
      data: {
        userId: user.id,
        fileName: sessionName || fileName || file?.name || "text-input",
        fileUrl: fileUrl || (file ? file.name : ""),
        fileSize: Number.isFinite(file?.size) ? file!.size : parseInt(fileSizeStr || '0', 10) || 0,
        fileType: file?.type || "text/plain",
        status: "COMPLETED",
        problemClarityScore: analysis.problemClarityScore,
        solutionClarityScore: analysis.solutionClarityScore,
        marketOpportunityScore: analysis.marketOpportunityScore,
        businessModelScore: analysis.businessModelScore,
        teamCredibilityScore: analysis.teamCredibilityScore,
        tractionScore: analysis.tractionScore,
        financialsScore: analysis.financialsScore,
        askClarityScore: analysis.askClarityScore,
        overallScore: analysis.overallScore,
        designConsistencyScore: analysis.designConsistencyScore,
        readabilityScore: analysis.readabilityScore,
        visualHierarchyScore: analysis.visualHierarchyScore,
        colorSchemeScore: analysis.colorSchemeScore,
        typographyScore: analysis.typographyScore,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        recommendations: analysis.recommendations,
        rawAnalysis: analysis as any,
        analyzedAt: new Date(),
      },
    });

    // Increment usage counter (non-blocking — don't fail the response if usage tracking fails)
    try {
      await prisma.usage.update({
        where: { userId: user.id },
        data: { e1DeckAnalyses: { increment: 1 } },
      });
    } catch (usageErr) {
      console.error("[E1] Failed to update usage counter (non-fatal):", usageErr);
    }

    // Return real result
    return NextResponse.json({
      success: true,
      data: {
        overallScore: analysis.overallScore,
        problemClarityScore: analysis.problemClarityScore,
        solutionClarityScore: analysis.solutionClarityScore,
        marketOpportunityScore: analysis.marketOpportunityScore,
        businessModelScore: analysis.businessModelScore,
        teamCredibilityScore: analysis.teamCredibilityScore,
        tractionScore: analysis.tractionScore,
        financialsScore: analysis.financialsScore,
        askClarityScore: analysis.askClarityScore,
        designConsistencyScore: analysis.designConsistencyScore,
        readabilityScore: analysis.readabilityScore,
        visualHierarchyScore: analysis.visualHierarchyScore,
        colorSchemeScore: analysis.colorSchemeScore,
        typographyScore: analysis.typographyScore,
        strengths: analysis.strengths,
        weaknesses: analysis.weaknesses,
        recommendations: analysis.recommendations,
        tokensUsed: analysis.tokensUsed,
      },
      id: savedDeck.id,
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Deck analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze deck" },
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
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }

    if (notes !== undefined && typeof notes !== "string") {
      return NextResponse.json({ error: "Notes must be a string" }, { status: 400 });
    }
    if (typeof notes === "string" && notes.length > 2000) {
      return NextResponse.json({ error: "Notes must be under 2000 characters" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.pitchDeck.update({
      where: { id, userId: user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, notes: updated.notes });
  } catch (error: any) {
    console.error("PATCH deck error:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 });
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
    const deckId = searchParams.get("id");

    if (!deckId) {
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }

    await prisma.pitchDeck.delete({
      where: { id: deckId, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE deck error:", error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
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
    const deckId = searchParams.get("id");

    // Single deck lookup by ID (for session detail page)
    if (deckId) {
      const deck = await prisma.pitchDeck.findFirst({
        where: { id: deckId, userId: user.id },
      });

      if (!deck) {
        return NextResponse.json({ error: "Deck not found" }, { status: 404 });
      }

      // Transform to match the session page's expected format
      const strengths = Array.isArray(deck.strengths) ? deck.strengths : [];
      const weaknesses = Array.isArray(deck.weaknesses) ? deck.weaknesses : [];
      const recommendations = Array.isArray(deck.recommendations) ? deck.recommendations : [];

      return NextResponse.json({
        id: deck.id,
        status: deck.status,
        fileName: deck.fileName,
        createdAt: deck.createdAt,
        notes: deck.notes,
        version: deck.version,
        parentId: deck.parentDeckId,
        analysis: {
          contentScores: {
            problemClarity: deck.problemClarityScore,
            solutionClarity: deck.solutionClarityScore,
            marketOpportunity: deck.marketOpportunityScore,
            businessModel: deck.businessModelScore,
            teamCredibility: deck.teamCredibilityScore,
            traction: deck.tractionScore,
            financials: deck.financialsScore,
            askClarity: deck.askClarityScore,
            overall: deck.overallScore,
          },
          visualScores: {
            designConsistency: deck.designConsistencyScore,
            readability: deck.readabilityScore,
            visualHierarchy: deck.visualHierarchyScore,
            colorScheme: deck.colorSchemeScore,
            typography: deck.typographyScore,
          },
          feedback: {
            strengths,
            weaknesses,
            recommendations,
          },
        },
      });
    }

    // List all decks (for history page)
    const decks = await prisma.pitchDeck.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      success: true,
      data: decks,
    });
  } catch (error) {
    console.error("Get deck history error:", error);
    return NextResponse.json(
      { error: "Failed to get deck history" },
      { status: 500 }
    );
  }
}
