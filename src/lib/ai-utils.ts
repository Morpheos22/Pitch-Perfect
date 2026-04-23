// Shared AI Utility Functions for Pitch Perfect × Automagikal
//
// Previously duplicated across ai-service.ts and vertex-ai.ts.
// Now consolidated here as the single source of truth.
//
// Contents:
//   - extractJsonFromContent  — Extract JSON from AI response text
//   - repairJson              — Fix common JSON issues from AI models
//   - parseJsonResponse       — Extract + repair + parse JSON from AI response
//   - clampScore              — Clamp AI score values to valid range
//   - validateStringArray     — Normalize AI string array responses

// ============================================
// JSON PARSING — Extract JSON from AI response
// ============================================

/**
 * Extract a JSON object from AI model response content.
 *
 * AI models often wrap JSON in markdown code blocks (```json ... ```)
 * or include prose around it. This function handles both cases:
 * 1. Try extracting from markdown code block first
 * 2. Fall back to balanced brace matching for raw JSON
 */
export function extractJsonFromContent(content: string): string | null {
  // Try to extract from markdown code block first
  const codeBlockMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    const jsonStr = codeBlockMatch[1].trim();
    if (jsonStr.startsWith('{') || jsonStr.startsWith('[')) {
      return jsonStr;
    }
  }

  // Balanced brace matching
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\') {
      escape = true;
      continue;
    }

    if (char === '"' && !escape) {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        return content.substring(start, i + 1);
      }
    }
  }

  return null;
}

// ============================================
// JSON REPAIR — Fix common AI JSON issues
// ============================================

/**
 * Repair common JSON issues from AI model responses:
 * 1. Unescaped newlines inside string values
 * 2. Unescaped tabs inside string values
 * 3. Trailing commas before closing brackets
 * 4. Carriage returns inside string values
 *
 * Walks character-by-character tracking JSON string context
 * to only escape characters that are inside string values.
 */
export function repairJson(json: string): string {
  let result = json;

  // Remove trailing commas before } or ]
  result = result.replace(/,\s*([}\]])/g, '$1');

  // Fix unescaped newlines/tabs inside string values.
  // Strategy: walk through the string character by character, tracking
  // whether we're inside a JSON string. If we encounter a raw newline
  // or tab inside a string, escape it.
  let inString = false;
  let escape = false;
  let output = '';

  for (let i = 0; i < result.length; i++) {
    const ch = result[i];

    if (escape) {
      output += ch;
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      output += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      output += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') {
        output += '\\n';
        continue;
      }
      if (ch === '\r') {
        output += '\\r';
        continue;
      }
      if (ch === '\t') {
        output += '\\t';
        continue;
      }
    }

    output += ch;
  }

  return output;
}

// ============================================
// JSON RESPONSE PARSING — Full parse pipeline
// ============================================

/**
 * Parse a JSON response from an AI model.
 *
 * Pipeline: extract JSON from content → parse → repair if needed → parse again.
 * This is the main entry point for converting raw AI text responses into
 * structured data, handling the common failure modes:
 * - JSON wrapped in markdown code blocks
 * - JSON with prose before/after
 * - Unescaped newlines/tabs in string values
 * - Trailing commas
 *
 * @param content - Raw AI response text
 * @returns Parsed JSON object of type T
 * @throws Error if no JSON found or if parsing fails after repair
 */
export function parseJsonResponse<T>(content: string): T {
  const jsonStr = extractJsonFromContent(content);
  if (!jsonStr) {
    console.error('[AI-Utils] Failed to parse AI response:', content.slice(0, 500));
    throw new Error('No JSON object found in AI response');
  }
  try {
    return JSON.parse(jsonStr) as T;
  } catch (parseErr: any) {
    // AI models sometimes return JSON with unescaped newlines inside string values
    // (especially in rewrittenScript). Try to repair by escaping raw newlines.
    console.warn('[AI-Utils] Initial JSON parse failed, attempting repair:', parseErr?.message);
    try {
      const repaired = repairJson(jsonStr);
      return JSON.parse(repaired) as T;
    } catch (repairErr: any) {
      console.error('[AI-Utils] JSON repair also failed:', repairErr?.message);
      console.error('[AI-Utils] Raw JSON (first 800 chars):', jsonStr.slice(0, 800));
      throw parseErr; // throw original error
    }
  }
}

// ============================================
// SCORE VALIDATION — Clamp AI score values
// ============================================

/**
 * Clamp a value to a min/max range. Returns a default if the value
 * is non-numeric (common with AI model hallucinations).
 *
 * @param value - The value to clamp (may be any type from AI response)
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 100)
 * @param defaultVal - Default value when input is non-numeric (default: 50)
 */
export function clampScore(value: unknown, min = 0, max = 100, defaultVal = 50): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
  if (num === undefined) {
    // Non-numeric AI response — log warning instead of silently defaulting
    console.warn(`[ScoreValidation] Non-numeric score value received: ${JSON.stringify(value)}. Defaulting to ${defaultVal}.`);
    return defaultVal;
  }
  return Math.round(Math.min(max, Math.max(min, num)));
}

// ============================================
// ARRAY VALIDATION — Validate string arrays
// ============================================

/**
 * Validate and normalize a value that should be a string array.
 * Handles AI model responses that sometimes return a single string
 * instead of an array, or other unexpected types.
 */
export function validateStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (typeof value === 'string') return [value];
  return [];
}
