// Shared AI Utility Functions for Pitch Perfect × Automagikal
//
// Previously duplicated across ai-service.ts and vertex-ai.ts.
// Now consolidated here as the single source of truth.

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
