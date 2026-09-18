import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { analyzePitchDeck, analyzeDeckVisual, DeckAnalysisResult } from "@/lib/ai-service";
import { extractFileText, extractTextFromUrl } from "@/lib/file-parser";
import { requireModuleAccess } from "@/lib/entitlement";
import { deckIterateSchema } from "@/lib/validation/schemas";
import { blobUrlToDataUri, isBlobUrl } from "@/lib/blob-signature";
import { withRateLimit } from "@/lib/rate-limit";
import { ALLOWED_UPLOAD_HOSTS, isHostAllowed } from "@/lib/storage";
import { requireAuth } from "@/lib/with-auth";
import { createLogger } from '@/lib/logger';
const log = createLogger('E1');
export const dynamic = 'force-dynamic';
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

// === Existing Athena Worker (Z.ai/Gemini path) ===
const workerUrl = () =>
  process.env.ATHENA_WORKER_URL || "https://pitchcoach-athena-d1.workers.dev";

// === Union Alpha Worker (new path, feature-flagged) ===
const unionAlphaUrl = () =>
  process.env.ATHENA_UNION_ALPHA_WORKER_URL ||
  "https://athena-union-alpha-worker.morphylee22.workers.dev";
const unionAlphaEnabled = () => process.env.UNION_ALPHA_ENABLED === "true";

// HMAC token signer — mirrors the verifier in src/auth.ts of the Worker
async function signAthenaToken(uid: string, route: string): Promise<string> {
  const secret = process.env.WORKER_AUTH_SECRET;
  if (!secret) throw new Error("WORKER_AUTH_SECRET not set");
  const payload = JSON.stringify({ ts: Date.now(), uid, route });
  const body = new TextEncoder().encode(payload);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, body);
  const b64url = (buf: Uint8Array | ArrayBuffer) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return Buffer.from(s, "binary")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  };
  return `${b64url(body)}.${b64url(sig)}`;
}

// Call the union-alpha Worker
async function callUnionAlpha(
  userId: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const token = await signAthenaToken(userId, "greet");
  return (await fetch(`${unionAlphaUrl()}/greet`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Athena-Auth": token,
      Origin: "https://pitchcoachai.tech",
    },
    body: JSON.stringify({
      messages: body.messages ?? [],
      max_tokens: body.max_tokens ?? 1024,
      stream: false,
    }),
    cache: "no-store",
  }).catch((error) => ({
    ok: false,
    status: 502,
    json: async () => ({
      error: error instanceof Error ? error.message : "union-alpha unavailable",
    }),
  }))) as any;
}

// === Existing helpers (unchanged) ===
async function founderContext(userId: string) {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return { founder_id: userId, source: "session" };
  const response = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/pitch_decks?founder_id=eq.${encodeURIComponent(
      userId
    )}&order=created_at.desc&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );
  if (!response.ok) return { founder_id: userId, source: "session" };
  const decks = await response.json();
  return {
    founder_id: userId,
    deck: Array.isArray(decks) ? decks[0] ?? null : null,
    source: "supabase",
  };
}

async function warmSession(
  userId: string,
  sessionId: string,
  body: Record<string, unknown>
) {
  try {
    const response = await fetch(`${workerUrl()}/v1/session/warmup`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.ATHENA_WORKER_TOKEN
          ? { authorization: `Bearer ${process.env.ATHENA_WORKER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        user_id: userId,
        session_id: sessionId,
        ttl_seconds: 86400,
        state: body,
      }),
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export const maxDuration = 60;


// E1: Pitch Deck Analyser API
// Analyzes uploaded pitch deck for content and visual quality using REAL AI


async function handlePost(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


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


    log.debug('Request received:', {
      hasFile: !!file,
      fileUrl: fileUrl ? fileUrl.substring(0, 80) + "..." : null,
      fileName,
      fileSize: fileSizeStr,
      hasContent: !!deckContent,
    });


    if (!file && !deckContent && !fileUrl) {
      return NextResponse.json(
        { error: "Either file, fileUrl, or content is required" },
        { status: 400 }
      );
    }


    // Validate file type for both direct uploads and blob URLs
    const allowedExtensions = [".pdf", ".pptx", ".ppt", ".txt"];
    const fileToValidate = file || (fileName ? { name: fileName } : null);
    if (fileToValidate) {
      const ext = fileToValidate.name.toLowerCase().substring(fileToValidate.name.lastIndexOf("."));
      if (!allowedExtensions.includes(ext)) {
        return NextResponse.json(
          { error: `Invalid file type (${ext || 'unknown'}). Supported formats: PDF, PPTX, PPT, TXT.` },
          { status: 400 }
        );
      }
    }


    // Validate file if provided (direct upload)
    if (file) {
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
      // Blob upload flow — fetch from URL, extract text
      // SSRF prevention: validate file URL host using shared allowlist
      if (!isHostAllowed(fileUrl, ALLOWED_UPLOAD_HOSTS)) {
        return NextResponse.json({ error: 'Invalid file source.' }, { status: 400 });
      }
      log.debug('Extracting text from Blob URL:', { fileUrl: fileUrl.substring(0, 80), fileName });
      try {
        analysisContent = await extractTextFromUrl(fileUrl, fileName);
        log.debug('Text extracted from Blob URL, length:', analysisContent.length);
      } catch (e) {
        log.error('Failed to extract from Blob URL:', e);
        return NextResponse.json(
          { error: "Failed to process uploaded file. Please try uploading a different file format." },
          { status: 400 }
        );
      }
    }


    if (!analysisContent && file && !deckContent) {
      // LEGACY: Direct file upload (for backward compat / small files)
      log.debug('Extracting text from file:', { name: file.name, size: file.size, type: file.type });
      try {
        analysisContent = await extractFileText(file);
        log.debug('Text extracted, length:', analysisContent.length);
      } catch (e: unknown) {
        log.error('Failed to extract file content:', e);
        const errMsg = e instanceof Error ? e.message : String(e);
        const hint = errMsg.includes("PDF")
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
      log.error('Insufficient content:', { length: analysisContent.length, source: fileUrl ? 'blob' : file ? 'direct' : 'content' });
      return NextResponse.json(
        { error: "Insufficient content for analysis. Could not extract enough text — the file may be image-based or empty. Please upload a text-based file." },
        { status: 400 }
      );
    }


    // Run AI analyses in parallel: content (text) + visual (vision)
    // Visual analysis requires a URL the AI gateway can fetch, or a data URI.
    // Blob URLs are converted to data URIs since the AI gateway may not be
    // able to fetch external blob URLs directly.
    let visualUrl: string | null = null;
    if (fileUrl) {
      try {
        const parsedUrl = new URL(fileUrl);
        if (isHostAllowed(fileUrl, ALLOWED_UPLOAD_HOSTS)) {
          // PPTX files cannot be visually analyzed — the vision model expects image/PDF formats.
          const ext = (fileName || parsedUrl.pathname).toLowerCase().split('.').pop() || '';
          if (['pptx', 'ppt'].includes(ext)) {
            log.debug('Visual audit skipped — PPTX format not supported by vision model');
          } else {
            // Blob URLs — the store is public so URLs are directly accessible.
            // For vision model access, convert to data URI for reliability
            // since the AI gateway might not be able to fetch external URLs directly.
            if (isBlobUrl(fileUrl)) {
              log.debug('Converting blob URL to data URI for vision model');
              const dataUri = await blobUrlToDataUri(fileUrl);
              visualUrl = dataUri || fileUrl; // Fallback to raw URL (may fail, but will degrade gracefully)
            } else {
              visualUrl = fileUrl;
            }
          }
        } else {
          log.warn('Visual audit skipped — URL host not in allowlist:', parsedUrl.hostname);
        }
      } catch {
        log.warn('Visual audit skipped — invalid URL:', fileUrl);
      }
    }
    const hasVisualInput = !!visualUrl;


    log.debug('Starting AI analysis:', { contentLength: analysisContent.length, hasVisualInput, visualSource: visualUrl ? 'provided' : 'none' });


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


        log.debug('Visual audit merged from vision model');
      } else if (visualResult.status === 'rejected') {
        log.warn('Visual audit skipped — vision model unavailable, using content-only visual scores');
      }
    } catch (aiError: unknown) {
      log.error('AI deck analysis FAILED:', aiError);
      const msg = aiError instanceof Error ? aiError.message : String(aiError);
      log.error('Full error:', msg);
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
  } catch (error: unknown) {
    log.error('DECK ANALYSIS FAILED — Full error:', error);
    // Provide specific error messages for common failure modes
    const msg = error instanceof Error ? error.message : String(error);
    log.error(`Error message: ${msg}`);
    log.error('Error stack:', error instanceof Error ? error.stack?.substring(0, 500) : undefined);


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
    if (msg.includes("BLOB_READ_WRITE_TOKEN") || msg.includes("Blob not found") || msg.includes("Blob returned")) {
      return NextResponse.json(
        { error: "File storage access error — could not retrieve uploaded file. Please try again or contact support." },
        { status: 502 }
      );
    }
    if (msg.includes("pdf-parse") || msg.includes("PDF") || msg.includes("parse")) {
      return NextResponse.json(
        { error: "Could not parse the uploaded file. If the file is image-based or scanned, try uploading a text-based PDF instead." },
        { status: 400 }
      );
    }
    // Return the actual error detail in development, generic in production
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      { error: isDev ? `Deck analysis error: ${msg}` : "Failed to analyze deck. If the file is image-based or scanned, try uploading a text-based PDF instead." },
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
  } catch (error: unknown) {
    log.error('PATCH deck error:', error);
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to update deck" }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


    const { searchParams } = new URL(request.url);
    const deckId = searchParams.get("id");


    if (!deckId) {
      return NextResponse.json({ error: "Deck ID is required" }, { status: 400 });
    }


    await prisma.pitchDeck.delete({
      where: { id: deckId, userId: user.id },
    });


    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    log.error('DELETE deck error:', error);
    if (error instanceof Error && 'code' in error && (error as any).code === 'P2025') {
      return NextResponse.json({ error: "Deck not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Failed to delete deck" }, { status: 500 });
  }
}


export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await requireAuth();
    if (authError) return authError;


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
  } catch (error: unknown) {
    log.error('Get deck history error:', error);
    return NextResponse.json(
      { error: "Failed to get deck history" },
      { status: 500 }
    );
  }
}
