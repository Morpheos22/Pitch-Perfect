import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import ZAI from "z-ai-web-dev-sdk";
import { db } from "@/lib/db";

// E1: Pitch Deck Analyser API
// Analyzes uploaded pitch deck for content and visual quality
// SECURITY: Uses auth() to get authenticated user - NEVER trust client input for userId

interface DeckAnalysisResult {
  overallScore: number;
  contentScores: {
    problemClarity: number;
    solutionClarity: number;
    marketOpportunity: number;
    businessModel: number;
    teamCredibility: number;
    traction: number;
    financials: number;
    askClarity: number;
  };
  visualScores: {
    designConsistency: number;
    readability: number;
    visualHierarchy: number;
    colorScheme: number;
    typography: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

const DECK_ANALYSIS_PROMPT = `You are an expert pitch deck analyst with experience reviewing thousands of investor decks. Analyze the provided pitch deck and provide a comprehensive assessment.

Your analysis should include:

1. CONTENT SCORING (0-100 for each):
   - Problem Clarity: How clearly is the problem articulated?
   - Solution Clarity: How well does the solution address the problem?
   - Market Opportunity: Is the market size compelling and realistic?
   - Business Model: Is the revenue model clear and viable?
   - Team Credibility: Does the team have relevant expertise?
   - Traction: Are there concrete metrics and milestones?
   - Financials: Are projections realistic and well-presented?
   - Ask Clarity: Is the funding ask and use of funds clear?

2. VISUAL SCORING (0-100 for each):
   - Design Consistency: Consistent styling throughout
   - Readability: Text is legible and well-formatted
   - Visual Hierarchy: Key information is emphasized
   - Color Scheme: Professional and cohesive colors
   - Typography: Appropriate font choices and sizing

3. STRENGTHS (3-5 key strengths)
4. WEAKNESSES (3-5 areas for improvement)
5. RECOMMENDATIONS (4-6 actionable next steps)

Respond in JSON format.`;

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation"];
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".pdf") && !file.name.endsWith(".pptx")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a PDF or PPTX file." },
        { status: 400 }
      );
    }

    // Validate file size (max 20MB)
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 20MB." },
        { status: 400 }
      );
    }

    // TODO: Upload file to Cloudflare R2
    // TODO: Store analysis record in database with PENDING status
    // TODO: Extract text/images from PDF/PPTX
    // TODO: Send to Claude Sonnet for analysis

    const zai = await ZAI.create();

    // Placeholder: In production, we'd process the actual file
    // For now, return structured mock response
    const mockResult: DeckAnalysisResult = {
      overallScore: 78,
      contentScores: {
        problemClarity: 85,
        solutionClarity: 80,
        marketOpportunity: 75,
        businessModel: 70,
        teamCredibility: 90,
        traction: 65,
        financials: 60,
        askClarity: 82,
      },
      visualScores: {
        designConsistency: 75,
        readability: 85,
        visualHierarchy: 70,
        colorScheme: 80,
        typography: 78,
      },
      strengths: [
        "Strong problem statement that clearly articulates pain points",
        "Impressive team slide with relevant experience",
        "Clear ask with specific use of funds",
      ],
      weaknesses: [
        "Traction slide lacks specific metrics and growth data",
        "Financial projections need more detail and assumptions",
        "Market size could be better segmented",
      ],
      recommendations: [
        "Add concrete metrics to your traction slide (MRR, users, growth rate)",
        "Include a financial model slide with key assumptions",
        "Break down TAM/SAM/SOM with specific numbers",
        "Consider adding a competitive landscape slide",
      ],
    };

    return NextResponse.json({
      success: true,
      data: mockResult,
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
    // SECURITY: Get authenticated user from session
    const { userId: clerkId } = await auth();

    if (!clerkId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get internal user ID from database
    const user = await db.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Fetch user's deck analysis history
    const decks = await db.pitchDeck.findMany({
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
