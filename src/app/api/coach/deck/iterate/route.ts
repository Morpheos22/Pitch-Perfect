import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, analyzeDeckVisual } from "@/lib/ai-service";
import { extractTextFromUrl, extractFileText } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { deckIterateSchema } from "@/lib/validation/schemas";

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
    const parsed = deckIterateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const validatedData = parsed.data;
    const parentId = validatedData.id;
    const { fileUrl, fileName, file, content } = body;

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
      // Blob upload flow — SSRF prevention: validate file URL host
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
        analysisContent = await extractTextFromUrl(fileUrl, fileName);
      } catch (e) {
        console.error("[Deck Iterate] Failed to extract from Blob URL:", e);
        return NextResponse.json(
          { error: "Failed to process uploaded file. Please try pasting your deck content directly." },
          { status: 400 }
        );
      }
    }

    if (!analysisContent && file) {
      // Legacy file upload (base64 or buffer — not typical for iterate, but supported)
      try {
        // Guard against unbounded base64 decoding (DoS)
        const MAX_BASE64_SIZE = 15_000_000; // ~10MB decoded
        if (file && file.length > MAX_BASE64_SIZE) {
          return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 });
        }
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
        // SSRF prevention: validate parent file URL host
        const ALLOWED_HOSTS = ['blob.vercel-storage.com', 'public.blob.vercel-storage.com', 'workdrive.zoho.com', 'zoho.com'];
        try {
          const parsedUrl = new URL(parentDeck.fileUrl);
          const isAllowed = ALLOWED_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
          if (!isAllowed) {
            console.warn('[Deck Iterate] Parent file URL host not in allowlist, skipping re-extraction:', parsedUrl.hostname);
          } else {
            analysisContent = await extractTextFromUrl(parentDeck.fileUrl, parentDeck.fileName || 'deck.pdf');
          }
        } catch {
          console.warn('[Deck Iterate] Invalid parent file URL, skipping re-extraction');
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

    // Build previousAnalysis context from parent — use 0 fallback for null scores
    const n = (v: number | null | undefined, fallback = 0) => v ?? fallback;
    const previousAnalysis = {
      overallScore: n(parentDeck.overallScore),
      problemClarityScore: n(parentDeck.problemClarityScore),
      solutionClarityScore: n(parentDeck.solutionClarityScore),
      marketOpportunityScore: n(parentDeck.marketOpportunityScore),
      businessModelScore: n(parentDeck.businessModelScore),
      teamCredibilityScore: n(parentDeck.teamCredibilityScore),
      tractionScore: n(parentDeck.tractionScore),
      financialsScore: n(parentDeck.financialsScore),
      askClarityScore: n(parentDeck.askClarityScore),
      strengths: parentDeck.strengths,
      weaknesses: parentDeck.weaknesses,
      recommendations: parentDeck.recommendations,
    };

    // Run analyses in parallel: content (text) + visual (vision if file URL available)
    // SSRF protection: only send known-safe storage URLs to the vision model.
    const ALLOWED_VISUAL_HOSTS = [
      'public.blob.vercel-storage.com',
      'blob.vercel-storage.com',
      'workdrive.zoho.com',
    ];
    let safeVisualUrl: string | null = null;
    if (fileUrl) {
      try {
        const parsedUrl = new URL(fileUrl);
        const isAllowed = ALLOWED_VISUAL_HOSTS.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.' + h));
        if (isAllowed) {
          const ext = (fileName || parsedUrl.pathname).toLowerCase().split('.').pop() || '';
          if (!['pptx', 'ppt'].includes(ext)) {
            safeVisualUrl = fileUrl;
          }
        }
      } catch { /* skip visual */ }
    }
    const [contentResult, visualResult] = await Promise.allSettled([
      analyzePitchDeck(analysisContent, previousAnalysis),
      safeVisualUrl ? analyzeDeckVisual(safeVisualUrl) : Promise.resolve(null),
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

    // Determine version number — use max existing version to prevent race conditions
    const latestVersion = await prisma.pitchDeck.findFirst({
      where: { parentDeckId: parentId, userId: user.id },
      select: { version: true },
      orderBy: { version: 'desc' },
    });
    const parentVersion = parentDeck.version || 1;
    const nextVersion = Math.max(parentVersion, latestVersion?.version ?? 0) + 1;

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
        rawAnalysis: JSON.parse(JSON.stringify(analysis)),
        version: nextVersion,
        parentDeckId: parentId,
        analyzedAt: new Date(),
      },
    });

    // Usage counter is now managed atomically inside requireModuleAccess().
    // No separate increment needed here — prevents dual-counting race condition.

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
