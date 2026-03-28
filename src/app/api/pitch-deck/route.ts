// API Route: Create and analyze pitch deck (E1)
// POST /api/pitch-deck

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, createPitchDeck, updatePitchDeckAnalysis, incrementUsage, checkUsageLimit } from '@/lib/db-operations';
import { analyzePitchDeck } from '@/lib/ai-service';
import { uploadFile, getFileContent } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getOrCreateUser();
    
    // Check usage limits
    const usageCheck = await checkUsageLimit(user.id, 'e1');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Usage limit reached', 
          message: `You've used ${usageCheck.current}/${usageCheck.limit} pitch deck analyses. Please upgrade your plan.`,
          limit: usageCheck.limit,
          current: usageCheck.current,
        },
        { status: 403 }
      );
    }

    // Parse request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const deckContent = formData.get('content') as string | null;

    if (!file && !deckContent) {
      return NextResponse.json(
        { error: 'Either file or content is required' },
        { status: 400 }
      );
    }

    let analysisContent = deckContent || '';
    let fileName = 'text-input';
    let fileUrl = '';
    let fileSize = 0;
    let fileType = 'text';

    // Handle file upload
    if (file) {
      fileName = file.name;
      fileSize = file.size;
      fileType = file.type;
      
      // Upload file to storage
      try {
        const uploadResult = await uploadFile(
          file,
          user.id,
          'deck',
          file.name,
          file.type
        );
        fileUrl = uploadResult.url;
      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
        // Continue without storage URL - we can still analyze text content
      }

      // Extract text content from file if not provided
      if (!deckContent) {
        try {
          const textContent = await file.text();
          if (textContent && textContent.length > 0) {
            analysisContent = textContent;
          } else {
            return NextResponse.json(
              { 
                error: 'Could not extract content from file',
                message: 'Please provide a text-based file or paste the deck content directly.'
              },
              { status: 400 }
            );
          }
        } catch (e) {
          console.error('Failed to extract file content:', e);
          return NextResponse.json(
            { 
              error: 'Failed to read file content',
              message: 'Please try a different file format or paste the deck content directly.'
            },
            { status: 400 }
          );
        }
      }
    }

    // Validate content length for meaningful analysis
    if (!analysisContent || analysisContent.length < 100) {
      return NextResponse.json(
        { 
          error: 'Insufficient content for analysis',
          message: 'Please provide more detailed pitch deck content (at least 100 characters). The AI needs substantial content to provide meaningful feedback.'
        },
        { status: 400 }
      );
    }

    // Create deck record in database
    const deck = await createPitchDeck({
      userId: user.id,
      fileName,
      fileUrl,
      fileSize,
      fileType,
    });

    // Run REAL AI analysis
    try {
      const analysis = await analyzePitchDeck(analysisContent);
      
      // Update deck with results
      await updatePitchDeckAnalysis(deck.id, {
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
        rawAnalysis: analysis,
      });

      // Increment usage
      await incrementUsage(user.id, 'e1', analysis.tokensUsed || 0);

      // Return with results
      return NextResponse.json({
        id: deck.id,
        status: 'COMPLETED',
        analysis: {
          contentScores: {
            problemClarity: analysis.problemClarityScore,
            solutionClarity: analysis.solutionClarityScore,
            marketOpportunity: analysis.marketOpportunityScore,
            businessModel: analysis.businessModelScore,
            teamCredibility: analysis.teamCredibilityScore,
            traction: analysis.tractionScore,
            financials: analysis.financialsScore,
            askClarity: analysis.askClarityScore,
            overall: analysis.overallScore,
          },
          visualScores: {
            designConsistency: analysis.designConsistencyScore,
            readability: analysis.readabilityScore,
            visualHierarchy: analysis.visualHierarchyScore,
            colorScheme: analysis.colorSchemeScore,
            typography: analysis.typographyScore,
          },
          feedback: {
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            recommendations: analysis.recommendations,
          },
        },
        fileName,
        fileUrl,
        createdAt: deck.createdAt,
        modelUsed: analysis.modelUsed,
        tokensUsed: analysis.tokensUsed,
      });
    } catch (error) {
      console.error('AI Analysis failed:', error);
      
      return NextResponse.json(
        { 
          error: 'AI analysis failed', 
          message: error instanceof Error ? error.message : 'Unknown error',
          details: 'The AI service encountered an error analyzing your pitch deck. Please try again.',
          deckId: deck.id,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Pitch deck API error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching a single deck analysis
export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const deckId = searchParams.get('id');

    if (!deckId) {
      return NextResponse.json({ error: 'Deck ID required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/db');
    const deck = await prisma.pitchDeck.findFirst({
      where: { id: deckId, userId: user.id },
    });

    if (!deck) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    return NextResponse.json({ deck });
  } catch (error) {
    console.error('Get deck error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deck' },
      { status: 500 }
    );
  }
}
