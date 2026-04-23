// Global polyfills for Vercel serverless environment
// Must be imported at the top of any file that uses pdf-parse

// DOMMatrix polyfill — pdf-parse's browser bundle references DOMMatrix at module level.
// In Vercel serverless (Node.js), this global doesn't exist, causing:
//   ReferenceError: DOMMatrix is not defined
// This stub provides enough for pdf-parse to load without crashing.
// DOMMatrix is only used for matrix transforms in layout calculations,
// which we don't need for text extraction.
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).DOMMatrix === 'undefined') {
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true; isIdentity = true;
    constructor(_init?: string | number[]) {}
    multiply(_other?: any) { return this; }
    inverse() { return this; }
    translate(_tx: number, _ty: number, _tz?: number) { return this; }
    scale(_scale: number) { return this; }
    rotate(_angle: number) { return this; }
    rotateFromVector(_x: number, _y: number) { return this; }
    toString() { return 'matrix(1, 0, 0, 1, 0, 0)'; }
  };
}

export {};
