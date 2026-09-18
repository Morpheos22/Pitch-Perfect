// Shared AI Utility Functions for PitchCoach Ai × Athena Agentic
//
// Single source of truth for AI response parsing helpers.
// (The legacy src/lib/vertex-ai.ts file was removed when Google AI / Vertex AI
// was taken out of the AI fallback chain — see README "Removed (Dead Code)".)
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
 * 5. Smart/curly quotes (Unicode) instead of straight quotes
 * 6. JavaScript-style // comments outside string values
 * 7. Unquoted property names (rare but happens)
 *
 * Walks character-by-character tracking JSON string context
 * to only escape characters that are inside string values.
 */
export function repairJson(json: string): string {
  let result = json;

  // ── Phase 1: Remove trailing commas before } or ] ──
  result = result.replace(/,\s*([}\]])/g, '$1');

  // ── Phase 2: Replace smart/curly quotes with straight quotes ──
  // AI models (especially GLM/GPT) sometimes use Unicode smart quotes
  // instead of ASCII double quotes. This is one of the most common
  // causes of "Expected ':' after property name" parse errors.
  result = result.replace(/[\u201c\u201d]/g, '"'); // Replace left/right double quotes
  result = result.replace(/[\u2018\u2019]/g, "'"); // Replace left/right single quotes (less common in JSON)

  // ── Phase 3: Remove JavaScript-style line comments outside strings ──
  // Some models add `// comment` annotations inside JSON objects
  result = removeJsonComments(result);

  // ── Phase 4: Fix unescaped newlines/tabs/carriage-returns inside string values ──
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

/**
 * Remove JavaScript-style // comments from JSON text.
 * Only removes comments outside of string values to avoid
 * stripping URLs that contain // (like https://...).
 *
 * Tracks string context by counting unescaped double quotes.
 */
function removeJsonComments(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];

  for (let line of lines) {
    // Walk through the line tracking whether we're in a string
    let inString = false;
    let escape = false;
    let commentStart = -1;

    for (let i = 0; i < line.length - 1; i++) {
      const ch = line[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      // Found // outside a string — everything after is a comment
      if (!inString && ch === '/' && line[i + 1] === '/') {
        commentStart = i;
        break;
      }
    }

    if (commentStart >= 0) {
      // Strip the comment, keep everything before it
      line = line.substring(0, commentStart).trimEnd();
    }

    result.push(line);
  }

  return result.join('\n');
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

// ============================================
// SCHEMA VALIDATION — Validate parsed AI response
// ============================================

/**
 * Field type descriptors for schema validation.
 */
export type FieldType = 'number' | 'string' | 'string[]' | 'object';

/**
 * Schema definition for validating AI response structures.
 * Each key maps to an expected field type and whether it's required.
 */
export type SchemaDefinition = Record<string, {
  type: FieldType;
  required?: boolean;   // default: true
  default?: unknown;    // default value if missing/non-numeric
}>;

/**
 * Validate a parsed AI response against an expected schema.
 *
 * This catches malformed AI responses where:
 * - Required fields are missing
 * - Score fields contain strings instead of numbers
 * - Array fields contain single values instead of arrays
 * - Nested objects are missing or wrong type
 *
 * Returns the validated object with defaults applied for missing fields.
 * Logs warnings for any mismatches but does NOT throw — the pipeline
 * should continue with best-effort data rather than crashing.
 *
 * @param parsed - The parsed JSON object from AI response
 * @param schema - Expected schema definition
 * @param label - Module label for logging (e.g. "E2_SCRIPT_ANALYSIS")
 * @returns Validated object with defaults applied
 */
export function validateSchema<T extends Record<string, unknown>>(
  parsed: Record<string, unknown>,
  schema: SchemaDefinition,
  label: string
): T {
  const result: Record<string, unknown> = { ...parsed };
  const warnings: string[] = [];

  for (const [field, spec] of Object.entries(schema)) {
    const value = result[field];
    const isRequired = spec.required !== false;

    if (value === undefined || value === null) {
      if (isRequired || spec.default !== undefined) {
        if (spec.default !== undefined) {
          warnings.push(`Field "${field}" is ${value === null ? 'null' : 'missing'}${isRequired ? ' (required)' : ' (optional)'}, using default: ${JSON.stringify(spec.default)}`);
          result[field] = spec.default;
        } else if (isRequired) {
          warnings.push(`Missing required field "${field}" with no default available`);
        }
      }
      continue;
    }

    // Type check
    switch (spec.type) {
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          const defaultVal = spec.default ?? 50;
          warnings.push(`Field "${field}" expected number, got ${typeof value}: ${JSON.stringify(value)}. Defaulting to ${defaultVal}`);
          result[field] = defaultVal;
        }
        break;

      case 'string':
        if (typeof value !== 'string') {
          const defaultVal = spec.default ?? '';
          warnings.push(`Field "${field}" expected string, got ${typeof value}. Defaulting to "${defaultVal}"`);
          result[field] = defaultVal;
        }
        break;

      case 'string[]':
        if (!Array.isArray(value)) {
          if (typeof value === 'string') {
            // AI sometimes returns a single string instead of array
            result[field] = [value];
          } else {
            const defaultVal = spec.default ?? [];
            warnings.push(`Field "${field}" expected string[], got ${typeof value}. Defaulting to ${JSON.stringify(defaultVal)}`);
            result[field] = defaultVal;
          }
        } else {
          // Filter non-string entries
          result[field] = value.filter((v: unknown) => typeof v === 'string');
        }
        break;

      case 'object':
        if (typeof value !== 'object' || Array.isArray(value) || value === null) {
          const defaultVal = spec.default ?? {};
          warnings.push(`Field "${field}" expected object, got ${typeof value}. Defaulting to ${JSON.stringify(defaultVal)}`);
          result[field] = defaultVal;
        }
        break;
    }
  }

  if (warnings.length > 0) {
    console.warn(`[SchemaValidation:${label}] ${warnings.length} issue(s):\n  ${warnings.join('\n  ')}`);
  }

  return result as T;
}
