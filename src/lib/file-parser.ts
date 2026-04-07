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
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdf = require('pdf-parse');
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await pdf(buffer);
  return result.text;
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
  const fileName = file.name || '';
  const fileType = detectFileType(fileName);
  
  switch (fileType) {
    case 'pdf':
      return parsePdfText(file);
    case 'pptx':
      return parsePptxText(file);
    case 'docx':
      return parseDocxText(file);
    case 'txt':
      return file.text();
    case 'unknown':
      // Try PDF first (some files have wrong extensions)
      try {
        const text = await file.text();
        if (text && text.length > 50) return text;
      } catch {}
      throw new Error(`Unsupported file type: ${fileName}`);
    default:
      throw new Error(`Unsupported file type: ${fileName}`);
  }
}

export { parsePdfText, parsePptxText, parseDocxText };
