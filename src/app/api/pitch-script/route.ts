// API Route: Create and analyze pitch script (E2)
// POST /api/pitch-script

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, createPitchScript, updatePitchScriptAnalysis, incrementUsage, checkUsageLimit } from '@/lib/db-operations';
import { analyzePitchScript } from '@/lib/ai-service';
import { uploadFile, extractFileText } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const user = await getOrCreateUser();
    
    // Check usage limits
    const usageCheck = await checkUsageLimit(user.id, 'e2');
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { 
          error: 'Usage limit reached', 
          message: `You've used ${usageCheck.current}/${usageCheck.limit} script coaching sessions. Please upgrade your plan.`,
          limit: usageCheck.limit,
          current: usageCheck.current,
        },
        { status: 403 }
      );
    }

    // Parse request
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const scriptText = formData.get('text') as string | null;
    const targetAudience = formData.get('targetAudience') as string || 'investors';
    const targetDuration = parseInt(formData.get('targetDuration') as string) || 60;

    if (!file && !scriptText) {
      return NextResponse.json(
        { error: 'Either file or text is required' },
        { status: 400 }
      );
    }

    let analysisContent = scriptText || '';
    let inputType: 'TEXT' | 'PDF' | 'DOCX' = 'TEXT';
    let fileName: string | undefined;
    let fileUrl: string | undefined;

    // Handle file upload
    if (file) {
      fileName = file.name;
      const mimeType = file.type;
      
      // Determine input type
      if (mimeType === 'application/pdf') {
        inputType = 'PDF';
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        inputType = 'DOCX';
      }

      // Upload file to storage
      const uploadResult = await uploadFile(
        file,
        user.id,
        'script',
        file.name,
        mimeType
      );
      fileUrl = uploadResult.url;

      // Extract text content from file if not provided
      if (!scriptText) {
        try {
          const extracted = await extractFileText(uploadResult.key, mimeType, file.name);
          analysisContent = extracted.text;
          console.log(`[E2] Extracted ${extracted.wordCount} words from ${fileName}`);
        } catch (e) {
          console.error('Failed to extract file content:', e);
          analysisContent = `[Script content from ${fileName}]`;
        }
      }
    }

    // Create script record in database
    const script = await createPitchScript({
      userId: user.id,
      inputType,
      inputText: analysisContent,
      inputFileUrl: fileUrl,
      fileName,
      targetAudience,
      pitchDuration: targetDuration,
    });

    // Run analysis
    try {
      if (analysisContent && analysisContent.length > 20) {
        const analysis = await analyzePitchScript(
          analysisContent,
          targetAudience,
          targetDuration
        );
        
        // Update script with results
        await updatePitchScriptAnalysis(script.id, {
          hookScore: analysis.hookScore,
          problemScore: analysis.problemScore,
          solutionScore: analysis.solutionScore,
          credibilityScore: analysis.credibilityScore,
          ctaScore: analysis.ctaScore,
          overallScore: analysis.overallScore,
          wordCount: analysis.wordCount,
          estimatedDuration: analysis.estimatedDuration,
          improvements: analysis.improvements,
          rewrittenScript: analysis.rewrittenScript,
          alternativeHooks: analysis.alternativeHooks,
        });

        // Increment usage
        await incrementUsage(user.id, 'e2', analysis.tokensUsed || 0);

        // Return with results
        return NextResponse.json({
          id: script.id,
          status: 'COMPLETED',
          analysis: {
            scores: {
              hook: analysis.hookScore,
              problem: analysis.problemScore,
              solution: analysis.solutionScore,
              credibility: analysis.credibilityScore,
              cta: analysis.ctaScore,
              overall: analysis.overallScore,
            },
            metrics: {
              wordCount: analysis.wordCount,
              estimatedDuration: analysis.estimatedDuration,
            },
            improvements: analysis.improvements,
            rewrittenScript: analysis.rewrittenScript,
            alternativeHooks: analysis.alternativeHooks,
          },
          inputType,
          fileName,
          fileUrl,
          targetAudience,
          createdAt: script.createdAt,
        });
      } else {
        // Mock analysis for development
        const mockAnalysis = {
          hookScore: 65,
          problemScore: 70,
          solutionScore: 75,
          credibilityScore: 60,
          ctaScore: 55,
          overallScore: 65,
          wordCount: analysisContent.split(/\s+/).length,
          estimatedDuration: Math.floor(analysisContent.split(/\s+/).length / 2.5),
          improvements: {
            hook: [
              'Start with a surprising statistic or bold statement instead of a generic introduction',
              'Consider opening with a question that immediately engages your audience',
            ],
            problem: [
              'Make the problem more specific and quantifiable',
              'Add an emotional hook to make the problem feel more urgent',
            ],
            solution: [
              'Be more specific about how your solution works',
              'Clearly differentiate from existing alternatives',
            ],
            credibility: [
              'Add a specific metric or achievement that demonstrates traction',
              'Mention relevant team experience or expertise',
            ],
            cta: [
              'Make your ask more specific (amount, timeline, next step)',
              'Create urgency by mentioning current momentum or opportunity',
            ],
          },
          rewrittenScript: `Did you know that 90% of startups fail because they can't clearly communicate their value? I'm [Name], founder of [Company], and we're changing that.\n\n[Specific problem] costs businesses $X billion annually. Our solution [brief description] has already helped [X customers] save [specific metric]. With [relevant experience], our team is uniquely positioned to capture this $Y billion market.\n\nWe're raising $Z to [specific milestone]. Would you be open to a 15-minute call to learn more?`,
          alternativeHooks: [
            '"What if I told you that [surprising insight about the problem]?"',
            '"In the next 60 seconds, I\'ll show you how we\'re [key benefit]..."',
            '"[Impressive statistic]. That\'s why we built [Company]."',
          ],
        };

        await updatePitchScriptAnalysis(script.id, {
          ...mockAnalysis,
          improvements: mockAnalysis.improvements as unknown as object,
        });

        await incrementUsage(user.id, 'e2', 0);

        return NextResponse.json({
          id: script.id,
          status: 'COMPLETED',
          analysis: {
            scores: {
              hook: mockAnalysis.hookScore,
              problem: mockAnalysis.problemScore,
              solution: mockAnalysis.solutionScore,
              credibility: mockAnalysis.credibilityScore,
              cta: mockAnalysis.ctaScore,
              overall: mockAnalysis.overallScore,
            },
            metrics: mockAnalysis.metrics,
            improvements: mockAnalysis.improvements,
            rewrittenScript: mockAnalysis.rewrittenScript,
            alternativeHooks: mockAnalysis.alternativeHooks,
          },
          inputType,
          fileName,
          fileUrl,
          targetAudience,
          createdAt: script.createdAt,
          _dev: 'Mock analysis (insufficient content)',
        });
      }
    } catch (error) {
      console.error('Script analysis failed:', error);
      
      return NextResponse.json(
        { 
          error: 'Analysis failed', 
          message: error instanceof Error ? error.message : 'Unknown error',
          scriptId: script.id,
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Pitch script API error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET endpoint for fetching a single script analysis
export async function GET(request: NextRequest) {
  try {
    const user = await getOrCreateUser();
    const { searchParams } = new URL(request.url);
    const scriptId = searchParams.get('id');

    if (!scriptId) {
      return NextResponse.json({ error: 'Script ID required' }, { status: 400 });
    }

    const { prisma } = await import('@/lib/db');
    const script = await prisma.pitchScript.findFirst({
      where: { id: scriptId, userId: user.id },
    });

    if (!script) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }

    return NextResponse.json({ script });
  } catch (error) {
    console.error('Get script error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch script' },
      { status: 500 }
    );
  }
}
