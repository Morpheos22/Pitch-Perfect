// API Route: Create and analyze pitch deck (E1)
// POST /api/pitch-deck

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, createPitchDeck, updatePitchDeckAnalysis, incrementUsage, checkUsageLimit } from '@/lib/db-operations';
import { analyzePitchDeck } from '@/lib/ai-service';
import { uploadFile, extractFileText, isR2Configured } from '@/lib/storage';
import { validateContentForAnalysis } from '@/lib/document-parser';

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
      const uploadResult = await uploadFile(
        file,
        user.id,
        'deck',
        file.name,
        file.type
      );
      fileUrl = uploadResult.url;

      // Extract text content from file if not provided
      if (!deckContent) {
        try {
          const extracted = await extractFileText(uploadResult.key, file.type, file.name);
          analysisContent = extracted.text;
          console.log(`[E1] Extracted ${extracted.wordCount} words from ${fileName}${extracted.pageCount ? ` (${extracted.pageCount} pages)` : ''}${extracted.slideCount ? ` (${extracted.slideCount} slides)` : ''}`);
        } catch (e) {
          console.error('Failed to extract file content:', e);
          // Continue with placeholder content for development
          analysisContent = `[Pitch deck content from ${fileName}]`;
        }
      }
    }

    // Create deck record in database
    const deck = await createPitchDeck({
      userId: user.id,
      fileName,
      fileUrl,
      fileSize,
      fileType,
    });

    // Run analysis
    try {
      if (analysisContent && analysisContent.length > 50) {
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
        });
      } else {
        // Mock analysis for development
        const mockAnalysis = {
          problemClarityScore: 72,
          solutionClarityScore: 68,
          marketOpportunityScore: 75,
          businessModelScore: 65,
          teamCredibilityScore: 80,
          tractionScore: 55,
          financialsScore: 60,
          askClarityScore: 70,
          overallScore: 68,
          designConsistencyScore: 75,
          readabilityScore: 80,
          visualHierarchyScore: 70,
          colorSchemeScore: 72,
          typographyScore: 78,
          strengths: [
            'Clear problem statement that resonates with target audience',
            'Strong team credentials with relevant industry experience',
            'Compelling market opportunity with realistic TAM figures',
          ],
          weaknesses: [
            'Traction metrics could be more specific and quantifiable',
            'Financial projections lack detailed assumptions',
            'Ask and use of funds could be more detailed',
          ],
          recommendations: [
            'Add specific revenue or user growth metrics to traction slide',
            'Include unit economics alongside financial projections',
            'Break down funding ask into specific allocation percentages',
            'Consider adding a competitive landscape slide',
            'Strengthen the call-to-action with specific next steps',
          ],
        };

        await updatePitchDeckAnalysis(deck.id, {
          ...mockAnalysis,
          rawAnalysis: mockAnalysis,
        });

        await incrementUsage(user.id, 'e1', 0);

        return NextResponse.json({
          id: deck.id,
          status: 'COMPLETED',
          analysis: {
            contentScores: {
              problemClarity: mockAnalysis.problemClarityScore,
              solutionClarity: mockAnalysis.solutionClarityScore,
              marketOpportunity: mockAnalysis.marketOpportunityScore,
              businessModel: mockAnalysis.businessModelScore,
              teamCredibility: mockAnalysis.teamCredibilityScore,
              traction: mockAnalysis.tractionScore,
              financials: mockAnalysis.financialsScore,
              askClarity: mockAnalysis.askClarityScore,
              overall: mockAnalysis.overallScore,
            },
            visualScores: {
              designConsistency: mockAnalysis.designConsistencyScore,
              readability: mockAnalysis.readabilityScore,
              visualHierarchy: mockAnalysis.visualHierarchyScore,
              colorScheme: mockAnalysis.colorSchemeScore,
              typography: mockAnalysis.typographyScore,
            },
            feedback: {
              strengths: mockAnalysis.strengths,
              weaknesses: mockAnalysis.weaknesses,
              recommendations: mockAnalysis.recommendations,
            },
          },
          fileName,
          fileUrl,
          createdAt: deck.createdAt,
          _dev: 'Mock analysis (insufficient content)',
        });
      }
    } catch (error) {
      console.error('Analysis failed:', error);
      
      return NextResponse.json(
        { 
          error: 'Analysis failed', 
          message: error instanceof Error ? error.message : 'Unknown error',
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
