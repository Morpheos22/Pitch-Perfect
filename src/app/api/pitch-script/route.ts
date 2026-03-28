// API Route: Create and analyze pitch script (E2)
// POST /api/pitch-script

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser, createPitchScript, updatePitchScriptAnalysis, incrementUsage, checkUsageLimit } from '@/lib/db-operations';
import { analyzePitchScript } from '@/lib/ai-service';
import { uploadFile, getFileContent } from '@/lib/storage';

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
          analysisContent = await getFileContent(uploadResult.url, mimeType);
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
        // Insufficient content - return error instead of mock
        return NextResponse.json(
          { 
            error: 'Insufficient content for analysis',
            message: 'Please provide more detailed script content (at least 20 characters).',
            scriptId: script.id,
          },
          { status: 400 }
        );
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
