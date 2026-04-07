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
  const pdfParse = await import('pdf-parse');
  const pdf = (pdfParse as any).default || pdfParse;
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdf(buffer);
  return result.text || '';
}

export type FileType = 'pdf' | 'pptx' | 'docx' | 'txt' | 'unknown';

export function detectFileType(fileName: string): FileType {
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
        return text;
      }
      case 'pptx':
        return parsePptxText(file);
      case 'docx':
        return parseDocxText(file);
      case 'txt':
        return file.text();
      case 'unknown':
        // Try raw text first (works for .text, no-extension files)
        try {
          const text = await file.text();
          if (text && text.trim().length > 5) return text;
        } catch (textErr) {
          console.error(`[file-parser] file.text() failed for unknown type:`, textErr);
        }
        // Try PDF parse (some files have wrong extensions)
        try {
          const text = await parsePdfText(file);
          if (text && text.trim().length > 5) return text;
        } catch (pdfErr) {
          console.error(`[file-parser] PDF fallback also failed:`, pdfErr);
        }
        throw new Error(`Unsupported file type: ${fileName}. Tried text and PDF parsing.`);
      default:
        throw new Error(`Unsupported file type: ${fileName}`);
    }
  } catch (error) {
    console.error(`[file-parser] Failed to parse ${fileType} file '${fileName}':`, error);
    throw new Error(`Failed to extract text from ${fileType} file: ${fileName}. ${error instanceof Error ? error.message : String(error)}`);
  }
}

export { parsePdfText, parsePptxText, parseDocxText };
