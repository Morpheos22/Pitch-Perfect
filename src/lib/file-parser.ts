// src/lib/file-parser.ts
// Unified file parser for Pitch Perfect
// Supports: PDF, PPTX, DOCX, TXT

// Dynamic imports for lazy loading
async function parsePptxText(file: File): Promise<string> {
  const JSZip = (await import('jszip')).default;
  const buffer = Buffer.from(await file.arrayBuffer());
  const zip = await JSZip.loadAsync(buffer);
  
  const slideTexts: string[] = [];
  const slideFiles = Object.keys(zip.files)
    .filter(name => name.match(/ppt\/slides\/slide\d+\.xml$/))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || '0');
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || '0');
      return numA - numB;
    });
  
  for (const slideFile of slideFiles) {
    const xmlContent = await zip.files[slideFile].async('text');
    // Extract text between <a:t> tags (OpenXML text elements)
    const textMatches = xmlContent.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || [];
    const slideText = textMatches
      .map(match => match.replace(/<\/?a:t[^>]*>/g, ''))
      .join(' ')
      .trim();
    if (slideText) {
      slideTexts.push(`Slide ${slideTexts.length + 1}: ${slideText}`);
    }
  }
  
  return slideTexts.join('\n\n');
}

async function parseDocxText(file: File): Promise<string> {
  const mammoth = await import('mammoth');
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await mammoth.default.extractRawText({ buffer });
  return result.value;
}

async function parsePdfText(file: File): Promise<string> {
  // pdf-parse exports { PDFParse } as a named export.
  // Usage: new PDFParse(data) → .getText() (load is called internally)
  const { PDFParse } = await import('pdf-parse');
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);
  const parser = new PDFParse(uint8);
  try {
    // getText() internally calls load() to initialize the document.
    // The `load` method is private in TypeScript types but getText()
    // handles initialization automatically.
    const result = await parser.getText();
    // result.text contains full text, result.pages[] has per-page text
    return result.text || '';
  } catch (parseErr) {
    // Some PDFs fail on first attempt — retry with a fresh parser instance
    console.warn('[file-parser] PDF parse failed on first attempt, retrying:', parseErr);
    try {
      const retryParser = new PDFParse(uint8);
      const result = await retryParser.getText();
      return result.text || '';
    } catch (retryErr) {
      console.error('[file-parser] PDF parse retry also failed:', retryErr);
      throw new Error('Failed to parse PDF file. The file may be corrupted or use unsupported encoding.');
    }
  } finally {
    try { parser.destroy(); } catch { /* ignore */ }
  }
}

export type FileType = 'pdf' | 'pptx' | 'docx' | 'txt' | 'unknown';

function detectFileType(fileName: string): FileType {
  const ext = fileName.toLowerCase().split('.').pop() || '';
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'pptx': case 'ppt': return 'pptx';
    case 'docx': case 'doc': return 'docx';
    case 'txt': case 'md': case 'text': return 'txt';
    default: return 'unknown';
  }
}

export async function extractFileText(file: File): Promise<string> {
  const fileName = file.name || 'unknown';
  const fileSize = file.size || 0;
  const fileType = detectFileType(fileName);
  console.error(`[file-parser] Parsing: name=${fileName}, size=${fileSize}, type=${fileType}`);
  
  try {
    switch (fileType) {
      case 'pdf': {
        const text = await parsePdfText(file);
        if (!text || text.trim().length < 5) {
          console.error(`[file-parser] PDF returned empty/short text (${text?.length || 0} chars)`);
        }
        return capTextLength(text);
      }
      case 'pptx':
        return capTextLength(await parsePptxText(file));
      case 'docx':
        return capTextLength(await parseDocxText(file));
      case 'txt':
        return capTextLength(await file.text());
      case 'unknown': {
        // Heuristic: if the first 64 bytes contain null bytes, it's almost certainly binary
        const head = Buffer.from(await file.slice(0, 64).arrayBuffer());
        const isBinary = head.includes(0x00);
        if (isBinary) {
          throw new Error(`Unsupported file type: ${fileName}. File appears to be binary.`);
        }
        // Try raw text first (works for .text, no-extension files)
        try {
          const text = await file.text();
          if (text && text.trim().length > 5) return capTextLength(text);
        } catch (textErr) {
          console.error(`[file-parser] file.text() failed for unknown type:`, textErr);
        }
        // Try PDF parse (some files have wrong extensions)
        try {
          const text = await parsePdfText(file);
          if (text && text.trim().length > 5) return capTextLength(text);
        } catch (pdfErr) {
          console.error(`[file-parser] PDF fallback also failed:`, pdfErr);
        }
        throw new Error(`Unsupported file type: ${fileName}. Tried text and PDF parsing.`);
      }
      default:
        throw new Error(`Unsupported file type: ${fileName}`);
    }
  } catch (error) {
    console.error(`[file-parser] Failed to parse ${fileType} file '${fileName}':`, error);
    throw new Error(`Failed to extract text from ${fileType} file: ${fileName}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Cap extracted text length to prevent excessive AI context/cost.
 * Wraps any extracted text with a hard limit.
 */
function capTextLength(text: string): string {
  const MAX_TEXT_LENGTH = 100_000;
  if (text.length > MAX_TEXT_LENGTH) {
    return text.substring(0, MAX_TEXT_LENGTH) + '\n\n[Text truncated: exceeded 100,000 character limit]';
  }
  return text;
}


/**
 * Extract text from a file at a given URL.
 * Fetches the file content, wraps it in a File object, then delegates to extractFileText.
 * This enables the Blob upload flow: client uploads to Blob → server gets URL → extracts text.
 */
export async function extractTextFromUrl(fileUrl: string, fileName: string): Promise<string> {
  console.log(`[file-parser] extractTextFromUrl: url=${fileUrl.substring(0, 80)}, name=${fileName}`);

  let buffer: Buffer;
  try {
    const { getFileContent } = await import("@/lib/storage");
    buffer = await getFileContent(fileUrl);
    console.log(`[file-parser] Got ${buffer.length} bytes from URL`);
  } catch (fetchError: any) {
    console.error(`[file-parser] Failed to fetch file content from URL:`, fetchError.message);
    throw new Error(`Failed to download file from storage: ${fetchError.message}`);
  }

  if (!buffer || buffer.length === 0) {
    throw new Error(`Downloaded file is empty (0 bytes). The upload may have failed.`);
  }

  // Construct a File object from the buffer for extractFileText
  const ext = fileName.toLowerCase().split(".").pop() || "";
  const { EXTENSION_TO_MIME } = await import("@/lib/file-validation");

  const file = new File([new Uint8Array(buffer)], fileName, {
    type: EXTENSION_TO_MIME[ext] || "application/octet-stream",
  });

  return extractFileText(file);
}
