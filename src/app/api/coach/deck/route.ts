import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, DeckAnalysisResult } from "@/lib/ai-service";
import { extractFileText, detectFileType } from "@/lib/file-parser";

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

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const deckContent = formData.get("content") as string;
    const sessionName = formData.get("sessionName") as string | null;

    if (!file && !deckContent) {
      return NextResponse.json(
        { error: "Either file or content is required" },
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
    let analysisContent = deckContent || "";

    if (file && !deckContent) {
      console.log("[E1] Extracting text from file:", { name: file.name, size: file.size, type: file.type });
      try {
        analysisContent = await extractFileText(file);
        console.log("[E1] Text extracted, length:", analysisContent.length);
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

    // Run REAL AI analysis
    let analysis: DeckAnalysisResult;
    try {
      analysis = await analyzePitchDeck(analysisContent);
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
        fileName: sessionName || file?.name || "text-input",
        fileUrl: file ? file.name : "",
        fileSize: Number.isFinite(file?.size) ? file!.size : 0,
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

    // Increment usage counter
    await prisma.usage.update({
      where: { userId: user.id },
      data: { e1DeckAnalyses: { increment: 1 } },
    });

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
