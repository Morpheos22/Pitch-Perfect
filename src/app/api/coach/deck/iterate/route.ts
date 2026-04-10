import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, analyzeDeckVisual } from "@/lib/ai-service";
import { extractTextFromUrl, extractFileText } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";

// POST /api/coach/deck/iterate
// Creates a new version of a pitch deck analysis, incorporating the previous analysis for iteration context.

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

    const body = await request.json();
    const { parentId, fileUrl, fileName, file, content } = body;

    if (!parentId) {
      return NextResponse.json({ error: "Parent deck ID is required" }, { status: 400 });
    }

    // Fetch the parent deck analysis
    const parentDeck = await prisma.pitchDeck.findFirst({
      where: { id: parentId, userId: user.id },
    });

    if (!parentDeck) {
      return NextResponse.json({ error: "Parent deck not found" }, { status: 404 });
    }

    // Determine the content source for the new analysis
    let analysisContent = content || "";

    if (!analysisContent && fileUrl && fileName) {
      // Blob upload flow
      try {
        analysisContent = await extractTextFromUrl(fileUrl, fileName);
      } catch (e: any) {
        console.error("[Deck Iterate] Failed to extract from Blob URL:", e);
        return NextResponse.json(
          { error: `Failed to process uploaded file: ${e?.message || 'unknown error'}` },
          { status: 400 }
        );
      }
    }

    if (!analysisContent && file) {
      // Legacy file upload (base64 or buffer — not typical for iterate, but supported)
      try {
        // file comes as base64 from JSON body
        const buffer = Buffer.from(file, "base64");
        const ext = fileName?.toLowerCase().split(".").pop() || "txt";
        const mimeTypes: Record<string, string> = {
          pdf: "application/pdf",
          pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          txt: "text/plain",
        };
        const fileObj = new File([buffer], fileName || "deck.pdf", {
          type: mimeTypes[ext] || "application/octet-stream",
        });
        analysisContent = await extractFileText(fileObj);
      } catch (e) {
        console.error("[Deck Iterate] Failed to extract from file:", e);
      }
    }

    // If no new content provided, reuse parent deck content (user may just want re-analysis with improved model)
    if (!analysisContent) {
      // If no new content provided, fetch parent's file URL and try to extract text
      if (parentDeck.fileUrl) {
        try {
          analysisContent = await extractTextFromUrl(parentDeck.fileUrl, parentDeck.fileName || 'deck.pdf');
        } catch (e) {
          console.warn("[Deck Iterate] Could not re-extract text from parent file URL:", e);
        }
      }

      // If still no content, return error
      if (!analysisContent || analysisContent.length < 50) {
        return NextResponse.json(
          { error: "Cannot re-analyze — original file content is unavailable. Please upload a new version of your deck." },
          { status: 400 }
        );
      }
    }

    // Truncate if needed
    const MAX_CONTENT_LENGTH = 50000;
    if (analysisContent.length > MAX_CONTENT_LENGTH) {
      analysisContent = analysisContent.slice(0, MAX_CONTENT_LENGTH) + "\n\n[Content truncated at 50,000 characters]";
    }

    if (analysisContent.length < 50) {
      return NextResponse.json(
        { error: "Insufficient content for analysis" },
        { status: 400 }
      );
    }

    // Build previousAnalysis context from parent
    const previousAnalysis = {
      overallScore: parentDeck.overallScore,
      problemClarityScore: parentDeck.problemClarityScore,
      solutionClarityScore: parentDeck.solutionClarityScore,
      marketOpportunityScore: parentDeck.marketOpportunityScore,
      businessModelScore: parentDeck.businessModelScore,
      teamCredibilityScore: parentDeck.teamCredibilityScore,
      tractionScore: parentDeck.tractionScore,
      financialsScore: parentDeck.financialsScore,
      askClarityScore: parentDeck.askClarityScore,
      strengths: parentDeck.strengths,
      weaknesses: parentDeck.weaknesses,
      recommendations: parentDeck.recommendations,
    };

    // Run analyses in parallel: content (text) + visual (vision if file URL available)
    const [contentResult, visualResult] = await Promise.allSettled([
      analyzePitchDeck(analysisContent, previousAnalysis),
      fileUrl ? analyzeDeckVisual(fileUrl) : Promise.resolve(null),
    ]);

    if (contentResult.status === 'rejected') {
      throw contentResult.reason;
    }
    const analysis = contentResult.value;

    // Merge visual scores from vision model if available
    if (visualResult.status === 'fulfilled' && visualResult.value) {
      const visual = visualResult.value;
      analysis.designConsistencyScore = visual.designConsistencyScore;
      analysis.readabilityScore = visual.readabilityScore;
      analysis.visualHierarchyScore = visual.visualHierarchyScore;
      analysis.colorSchemeScore = visual.colorSchemeScore;
      analysis.typographyScore = visual.typographyScore;
      if (visual.visualWeaknesses.length > 0) {
        analysis.weaknesses = [...analysis.weaknesses, ...visual.visualWeaknesses.slice(0, 2)];
      }
      if (visual.visualRecommendations.length > 0) {
        analysis.recommendations = [...analysis.recommendations, ...visual.visualRecommendations.slice(0, 2)];
      }
    }

    // Determine version number
    const parentVersion = parentDeck.version || 1;

    // Store as new deck with parent reference
    const savedDeck = await prisma.pitchDeck.create({
      data: {
        userId: user.id,
        fileName: fileName || parentDeck.fileName || "iteration",
        fileUrl: fileUrl || parentDeck.fileUrl,
        fileSize: 0,
        fileType: parentDeck.fileType,
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
        version: parentVersion + 1,
        parentDeckId: parentId,
        analyzedAt: new Date(),
      },
    });

    // Increment usage (non-blocking — don't fail the response if usage tracking fails)
    try {
      await prisma.usage.update({
        where: { userId: user.id },
        data: { e1DeckAnalyses: { increment: 1 } },
      });
    } catch (usageErr) {
      console.error("[E1 Iterate] Failed to update usage counter (non-fatal):", usageErr);
    }

    return NextResponse.json({
      success: true,
      id: savedDeck.id,
      version: savedDeck.version,
      parentId: parentId,
      overallScore: analysis.overallScore,
      parentOverallScore: parentDeck.overallScore,
      delta: (analysis.overallScore ?? 0) - (parentDeck.overallScore ?? 0),
      modelUsed: analysis.modelUsed,
    });
  } catch (error) {
    console.error("Deck iterate error:", error);
    return NextResponse.json(
      { error: "Failed to iterate deck analysis" },
      { status: 500 }
    );
  }
}
