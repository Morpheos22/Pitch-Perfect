import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, analyzeDeckVisual, DeckAnalysisResult } from "@/lib/ai-service";
import { extractFileText, extractTextFromUrl } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { deckIterateSchema } from "@/lib/validation/schemas";
import { blobUrlToDataUri } from "@/lib/blob-signature";
import { withRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

// E1: Pitch Deck Analyser API
// Analyzes uploaded pitch deck for content and visual quality using REAL AI

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
          { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum upload size is 4.5MB for direct upload. Please use a smaller file.` },
          { status: 413 }
        );
      }
    }

    // Get content for analysis
    // Priority: deckContent > fileUrl (Blob upload) > file (legacy upload)
    let analysisContent = deckContent || "";

    if (!analysisContent && fileUrl && fileName) {
      // NEW: Blob upload flow — fetch from URL, extract text
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
      console.warn("[E1] Extracting text from Blob URL:", { fileUrl, fileName });
      try {
        analysisContent = await extractTextFromUrl(fileUrl, fileName);
        console.warn("[E1] Text extracted from Blob URL, length:", analysisContent.length);
      } catch (e) {
        console.error("[E1] Failed to extract from Blob URL:", e);
        return NextResponse.json(
          { error: "Failed to process uploaded file. Please try uploading a different file format." },
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
          ? " This PDF may be password-protected, scanned (image-only), or corrupted. Please upload a text-based PDF."
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
        { error: "Insufficient content for analysis. Could not extract enough text — the file may be image-based or empty. Please upload a text-based file." },
        { status: 400 }
      );
    }

    // Run AI analyses in parallel: content (text) + visual (vision)
    // Visual analysis requires a URL the AI gateway can fetch, or a data URI.
    // Private blob URLs must be converted to data URIs since the AI gateway
    // cannot authenticate to fetch private blobs.
    const ALLOWED_VISUAL_HOSTS = [
      'public.blob.vercel-storage.com',
      'blob.vercel-storage.com',
      'workdrive.zoho.com',
    ];
    let visualUrl: string | null = null;
    if (fileUrl) {
      try {
        const parsedUrl = new URL(fileUrl);
        const isAllowed = ALLOWED_VISUAL_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
        if (isAllowed) {
          // PPTX files cannot be visually analyzed — the vision model expects image/PDF formats.
          const ext = (fileName || parsedUrl.pathname).toLowerCase().split('.').pop() || '';
          if (['pptx', 'ppt'].includes(ext)) {
            console.warn('[E1] Visual audit skipped — PPTX format not supported by vision model');
          } else {
            // Private blob URLs need conversion to data URI for AI access
            // Public blob URLs (workdrive, public.blob) can be used directly
            if (parsedUrl.hostname === 'blob.vercel-storage.com' && !parsedUrl.hostname.startsWith('public.')) {
              // Private Vercel Blob — convert to data URI
              console.warn('[E1] Converting private blob URL to data URI for vision model');
              const dataUri = await blobUrlToDataUri(fileUrl);
              visualUrl = dataUri || fileUrl; // Fallback to raw URL (may fail, but will degrade gracefully)
            } else {
              visualUrl = fileUrl;
            }
          }
        } else {
          console.warn('[E1] Visual audit skipped — URL host not in allowlist:', parsedUrl.hostname);
        }
      } catch {
        console.warn('[E1] Visual audit skipped — invalid URL:', fileUrl);
      }
    }
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
        fileSize: file && Number.isFinite(file.size) ? file.size : parseInt(fileSizeStr || '0', 10) || 0,
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
        rawAnalysis: JSON.parse(JSON.stringify(analysis)),
        analyzedAt: new Date(),
      },
    });

    // Usage counter is now managed atomically inside requireModuleAccess().
    // No separate increment needed here — prevents dual-counting race condition.

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
  } catch (error: any) {
    console.error("Deck analysis error:", error);
    // Provide specific error messages for common failure modes
    const msg = error?.message || String(error);
    if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("timeout")) {
      return NextResponse.json(
        { error: "Network error — could not reach AI service. Please try again in a moment." },
        { status: 502 }
      );
    }
    if (msg.includes("413") || msg.includes("body") && msg.includes("limit")) {
      return NextResponse.json(
        { error: "File too large for serverless upload. Try a smaller file or use the blob upload path." },
        { status: 413 }
      );
    }
    return NextResponse.json(
      { error: "Failed to analyze deck. If the file is image-based or scanned, try uploading a text-based PDF instead." },
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
    const parsed = deckIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const notes = validatedData.notes;

    if (!validatedData.id) {
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (notes !== undefined) updateData.notes = notes;

    const updated = await prisma.pitchDeck.update({
      where: { id: validatedData.id, userId: user.id },
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

    // List all decks (for history page) — exclude rawAnalysis to reduce payload size
    const decks = await prisma.pitchDeck.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, fileName: true, fileUrl: true, fileSize: true, fileType: true,
        status: true, version: true, parentDeckId: true, notes: true,
        problemClarityScore: true, solutionClarityScore: true,
        marketOpportunityScore: true, businessModelScore: true,
        teamCredibilityScore: true, tractionScore: true,
        financialsScore: true, askClarityScore: true, overallScore: true,
        designConsistencyScore: true, readabilityScore: true,
        visualHierarchyScore: true, colorSchemeScore: true, typographyScore: true,
        strengths: true, weaknesses: true, recommendations: true,
        createdAt: true, analyzedAt: true,
        // Explicitly exclude rawAnalysis — not needed for list views
      },
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
