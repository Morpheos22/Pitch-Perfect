// Generate test fixture files for E2E parsing tests
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

const DIR = path.join(import.meta.dirname, 'fixtures');
fs.mkdirSync(DIR, { recursive: true });

// ============================================================
// 1. PDF — raw minimal valid PDF with known text
// ============================================================
const pdfBytes = Buffer.from(
  '%PDF-1.4\n' +
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj\n' +
  '4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n' +
  '5 0 obj<</Length 87>>stream\n' +
  'BT\n/F1 12 Tf\n100 700 Td\n(Pitch Perfect AI is the best pitch coaching platform.) Tj\n0 -20 Td\n(We help founders win investors.) Tj\nET\n' +
  'endstream\nendobj\n' +
  'xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000266 00000 n \n0000000340 00000 n \n' +
  'trailer<</Size 6/Root 1 0 R>>\nstartxref\n480\n%%EOF'
);
fs.writeFileSync(path.join(DIR, 'test.pdf'), pdfBytes);
console.log('✅ Created test.pdf');

// ============================================================
// 2. PPTX — two slides with text via jszip
// ============================================================
const pptx = new JSZip();

// [Content_Types].xml
pptx.file('[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
  '<Override PartName="/ppt/slides/slide1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
  '<Override PartName="/ppt/slides/slide2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
  '</Types>'
);

// _rels/.rels
pptx.folder('_rels').file('.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>' +
  '</Relationships>'
);

// ppt/presentation.xml
const pptFolder = pptx.folder('ppt');
pptFolder.file('presentation.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId3"/></p:sldIdLst>' +
  '</p:presentation>'
);

// ppt/_rels/presentation.xml.rels
pptFolder.folder('_rels').file('presentation.xml.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>' +
  '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>' +
  '</Relationships>'
);

// Slide 1 — Problem & Solution
pptFolder.folder('slides').file('slide1.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
  '<p:cSld><p:spTree>' +
  '<p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:p><a:r><a:t>Pitch Perfect AI - The Problem</a:t></a:r></a:p>' +
  '<a:p><a:r><a:t>Founders struggle to prepare compelling investor pitches.</a:t></a:r></a:p>' +
  '<a:p><a:r><a:t>90% of pitch decks fail to secure funding.</a:t></a:r></a:p>' +
  '</p:txBody></p:sp>' +
  '</p:spTree></p:cSld></p:sld>'
);

// Slide 2 — Market & Traction
pptFolder.folder('slides').file('slide2.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
  '<p:cSld><p:spTree>' +
  '<p:sp><p:nvSpPr/><p:spPr/><p:txBody><a:p><a:r><a:t>Market Opportunity</a:t></a:r></a:p>' +
  '<a:p><a:r><a:t>TAM: $4.2B in pitch coaching and investor readiness tools.</a:t></a:r></a:p>' +
  '<a:p><a:r><a:t>We have 500 beta users and 85% satisfaction rate.</a:t></a:r></a:p>' +
  '</p:txBody></p:sp>' +
  '</p:spTree></p:cSld></p:sld>'
);

const pptxBuffer = await pptx.generateAsync({ type: 'nodebuffer' });
fs.writeFileSync(path.join(DIR, 'test.pptx'), pptxBuffer);
console.log('✅ Created test.pptx');

// ============================================================
// 3. DOCX — text document via manual OOXML zip
// ============================================================
const docx = new JSZip();

docx.file('[Content_Types].xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>'
);

docx.folder('_rels').file('.rels',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>'
);

docx.folder('word').file('document.xml',
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  '<w:body>' +
  '<w:p><w:r><w:t>Elevator Pitch Script</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>What if you could turn every pitch into a guaranteed close?</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Pitch Perfect AI uses advanced language models to analyze your pitch scripts in real time.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>We score your hook, problem statement, solution, credibility, and call to action.</w:t></w:r></w:p>' +
  '<w:p><w:r><w:t>Join 500 founders who have already improved their fundraising success rate.</w:t></w:r></w:p>' +
  '</w:body>' +
  '</w:document>'
);

const docxBuffer = await docx.generateAsync({ type: 'nodebuffer' });
fs.writeFileSync(path.join(DIR, 'test.docx'), docxBuffer);
console.log('✅ Created test.docx');

// ============================================================
// 4. TXT
// ============================================================
fs.writeFileSync(path.join(DIR, 'test.txt'),
  'Simple Text File\n\n' +
  'This is a plain text script for testing.\n' +
  'Pitch Perfect AI helps founders prepare winning investor pitches.\n' +
  'Our AI coach analyzes hooks, problem statements, solutions, credibility signals, and CTAs.\n'
);
console.log('✅ Created test.txt');

// ============================================================
// 5. MD (Markdown)
// ============================================================
fs.writeFileSync(path.join(DIR, 'test.md'),
  '# Elevator Pitch\n\n' +
  '## Problem\n' +
  'Founders waste months preparing pitches that fail to impress investors.\n\n' +
  '## Solution\n' +
  'Pitch Perfect AI provides instant AI-powered pitch coaching.\n\n' +
  '## Traction\n' +
  '- 500 beta users\n' +
  '- 85% satisfaction rate\n' +
  '- 3 pilot partnerships with accelerators\n'
);
console.log('✅ Created test.md');

console.log('\nAll fixture files created in', DIR);
