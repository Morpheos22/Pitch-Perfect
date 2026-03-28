// Document Parser Utility
// Extracts text content from PDF, PPTX, DOCX, and plain text files
// Used by pitch deck analyzer and script coach modules

import mammoth from 'mammoth';
import JSZip from 'jszip';

// PDF parsing - use dynamic require for CommonJS compatibility
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

// ============================================
// TYPES
// ============================================

export interface ParsedDocument {
  text: string;
  pageCount?: number;
  slideCount?: number;
  wordCount: number;
  metadata?: Record<string, unknown>;
}

export interface ParseError {
  error: string;
  message: string;
}

// ============================================
// PDF PARSING
// ============================================

async function parsePDF(buffer: Buffer): Promise<ParsedDocument> {
  const data = await pdfParse(buffer);

  const text = data.text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  return {
    text,
    pageCount: data.numpages,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: {
      info: data.info,
      version: data.version,
    },
  };
}

// ============================================
// PPTX PARSING (PowerPoint)
// ============================================

async function parsePPTX(buffer: Buffer): Promise<ParsedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const slides: string[] = [];
  let slideIndex = 1;

  // PPTX files have slides in ppt/slides/slide1.xml, slide2.xml, etc.
  while (true) {
    const slideFile = zip.file(`ppt/slides/slide${slideIndex}.xml`);
    if (!slideFile) break;

    const content = await slideFile.async('text');
    
    // Extract text from XML - looking for <a:t> tags (text content)
    const textMatches = content.match(/<a:t>([^<]*)<\/a:t>/g);
    if (textMatches) {
      const slideText = textMatches
        .map(match => match.replace(/<\/?a:t>/g, ''))
        .join(' ')
        .trim();
      if (slideText) {
        slides.push(`[Slide ${slideIndex}] ${slideText}`);
      }
    }
    
    slideIndex++;
  }

  const text = slides.join('\n\n');
  
  return {
    text,
    slideCount: slides.length,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

// ============================================
// PPT PARSING (Legacy PowerPoint)
// ============================================

async function parsePPT(buffer: Buffer): Promise<ParsedDocument> {
  // Legacy PPT files are binary and harder to parse
  // For now, return a placeholder indicating the limitation
  // In production, consider using a server-side conversion or external API
  
  return {
    text: '[Legacy PowerPoint file detected. Please convert to PPTX format for full text extraction, or paste the slide content manually.]',
    wordCount: 0,
    metadata: {
      note: 'Legacy PPT format requires conversion to PPTX for text extraction',
    },
  };
}

// ============================================
// DOCX PARSING (Word Documents)
// ============================================

async function parseDOCX(buffer: Buffer): Promise<ParsedDocument> {
  const result = await mammoth.extractRawText({ buffer });
  
  const text = result.value
    .replace(/\s+/g, ' ')
    .trim();

  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    metadata: {
      messages: result.messages,
    },
  };
}

// ============================================
// DOC PARSING (Legacy Word)
// ============================================

async function parseDOC(buffer: Buffer): Promise<ParsedDocument> {
  // Legacy DOC files are binary and harder to parse
  // mammoth can sometimes handle them, but it's hit or miss
  
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.replace(/\s+/g, ' ').trim();
    
    return {
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    };
  } catch {
    return {
      text: '[Legacy Word file detected. Please convert to DOCX format for full text extraction, or paste the content manually.]',
      wordCount: 0,
      metadata: {
        note: 'Legacy DOC format may require conversion for text extraction',
      },
    };
  }
}

// ============================================
// PLAIN TEXT PARSING
// ============================================

function parsePlainText(buffer: Buffer): ParsedDocument {
  const text = buffer.toString('utf-8').trim();
  
  return {
    text,
    wordCount: text.split(/\s+/).filter(Boolean).length,
  };
}

// ============================================
// MAIN EXPORT
// ============================================

/**
 * Parse a document buffer and extract text content
 * Supports PDF, PPTX, PPT, DOCX, DOC, and plain text files
 */
export async function parseDocument(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<ParsedDocument> {
  // Get file extension as fallback for mime type detection
  const ext = fileName?.toLowerCase().split('.').pop() || '';

  try {
    // PDF
    if (mimeType === 'application/pdf' || ext === 'pdf') {
      return await parsePDF(buffer);
    }

    // PowerPoint (modern)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      ext === 'pptx'
    ) {
      return await parsePPTX(buffer);
    }

    // PowerPoint (legacy)
    if (mimeType === 'application/vnd.ms-powerpoint' || ext === 'ppt') {
      return await parsePPT(buffer);
    }

    // Word (modern)
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      ext === 'docx'
    ) {
      return await parseDOCX(buffer);
    }

    // Word (legacy)
    if (mimeType === 'application/msword' || ext === 'doc') {
      return await parseDOC(buffer);
    }

    // Plain text
    if (
      mimeType === 'text/plain' ||
      ext === 'txt' ||
      mimeType === 'application/text'
    ) {
      return parsePlainText(buffer);
    }

    // Unknown format - try as plain text
    console.warn(`Unknown mime type: ${mimeType}, attempting text extraction`);
    return parsePlainText(buffer);
  } catch (error) {
    console.error('Document parsing error:', error);
    throw new Error(
      `Failed to parse document: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Quick text extraction for files already in R2 storage
 * Downloads from R2 and parses
 */
export async function extractTextFromR2File(
  r2Key: string,
  mimeType: string
): Promise<string> {
  // Import storage functions dynamically to avoid circular dependencies
  const { getFileBuffer } = await import('./storage');
  
  const buffer = await getFileBuffer(r2Key);
  const result = await parseDocument(buffer, mimeType);
  
  return result.text;
}

/**
 * Validate that extracted content is sufficient for analysis
 */
export function validateContentForAnalysis(content: string, minLength = 100): {
  valid: boolean;
  wordCount: number;
  message?: string;
} {
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  
  if (content.length < minLength) {
    return {
      valid: false,
      wordCount,
      message: `Content too short (${content.length} chars, ${wordCount} words). Need at least ${minLength} characters for meaningful analysis.`,
    };
  }
  
  if (wordCount < 20) {
    return {
      valid: false,
      wordCount,
      message: `Not enough words (${wordCount}). Need at least 20 words for analysis.`,
    };
  }
  
  return {
    valid: true,
    wordCount,
  };
}
