import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck } from "@/lib/ai-service";
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
      } catch (e) {
        console.error("[Deck Iterate] Failed to extract from Blob URL:", e);
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
      // Try to reconstruct from rawAnalysis
      if (parentDeck.rawAnalysis && typeof parentDeck.rawAnalysis === "object") {
        const raw = parentDeck.rawAnalysis as Record<string, unknown>;
        // We don't store original content, so we can't re-analyze without it
        return NextResponse.json(
          { error: "No new content provided. Please upload a new version of your deck or paste content." },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "No content available for re-analysis" },
        { status: 400 }
      );
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

    // Run AI analysis with iteration context
    const analysis = await analyzePitchDeck(analysisContent, previousAnalysis);

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

    // Increment usage
    await prisma.usage.update({
      where: { userId: user.id },
      data: { e1DeckAnalyses: { increment: 1 } },
    });

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
