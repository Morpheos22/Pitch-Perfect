import { describe, it, expect } from 'vitest';
import {
  extractJsonFromContent,
  clampScore,
  validateStringArray,
  repairJson,
  parseJsonResponse,
  validateSchema,
} from '@/lib/ai-utils';

// ============================================
// extractJsonFromContent
// ============================================
describe('extractJsonFromContent', () => {
  it('extracts JSON wrapped in a markdown code block with ```json', () => {
    const input = 'Here is the result:\n```json\n{"score": 85, "feedback": "Good"}\n```\nEnd.';
    const result = extractJsonFromContent(input);
    expect(result).toBe('{"score": 85, "feedback": "Good"}');
  });

  it('extracts JSON wrapped in a plain code block (```)', () => {
    const input = '```\n{"score": 90}\n```';
    const result = extractJsonFromContent(input);
    expect(result).toBe('{"score": 90}');
  });

  it('extracts raw JSON object embedded in text', () => {
    const input = 'The analysis returned {"clarity": 7, "conciseness": 8} as the result.';
    const result = extractJsonFromContent(input);
    expect(result).toBe('{"clarity": 7, "conciseness": 8}');
  });

  it('returns null when no JSON is present', () => {
    const input = 'This is just plain text without any JSON at all.';
    const result = extractJsonFromContent(input);
    expect(result).toBeNull();
  });

  it('returns the first complete JSON object when multiple exist', () => {
    const input = 'First: {"a": 1} and second: {"b": 2}';
    const result = extractJsonFromContent(input);
    expect(result).toBe('{"a": 1}');
  });
});

// ============================================
// clampScore
// ============================================
describe('clampScore', () => {
  it('returns the number when it is within the default range', () => {
    expect(clampScore(75)).toBe(75);
  });

  it('clamps to minimum when the number is below the range', () => {
    expect(clampScore(-10)).toBe(0);
  });

  it('clamps to maximum when the number is above the range', () => {
    expect(clampScore(150)).toBe(100);
  });

  it('returns default (50) for non-numeric string', () => {
    expect(clampScore('not-a-number')).toBe(50);
  });

  it('returns default (50) for null', () => {
    expect(clampScore(null)).toBe(50);
  });

  it('returns default (50) for undefined', () => {
    expect(clampScore(undefined)).toBe(50);
  });

  it('respects custom min, max, and defaultVal', () => {
    expect(clampScore(-5, 1, 10, 5)).toBe(1);
    expect(clampScore(20, 1, 10, 5)).toBe(10);
    expect(clampScore('bad', 1, 10, 5)).toBe(5);
  });
});

// ============================================
// validateStringArray
// ============================================
describe('validateStringArray', () => {
  it('returns a valid string array as-is', () => {
    const input = ['hello', 'world'];
    expect(validateStringArray(input)).toEqual(['hello', 'world']);
  });

  it('wraps a single string into an array', () => {
    expect(validateStringArray('hello')).toEqual(['hello']);
  });

  it('returns an empty array for null', () => {
    expect(validateStringArray(null)).toEqual([]);
  });

  it('returns an empty array for undefined', () => {
    expect(validateStringArray(undefined)).toEqual([]);
  });

  it('filters out non-string values from a mixed array', () => {
    const input = ['valid', 42, null, 'also-valid', true];
    expect(validateStringArray(input)).toEqual(['valid', 'also-valid']);
  });
});

// ============================================
// repairJson
// ============================================
describe('repairJson', () => {
  it('removes trailing commas before }', () => {
    const input = '{"key": "value",}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('removes trailing commas before ]', () => {
    const input = '{"items": [1, 2, 3,]}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ items: [1, 2, 3] });
  });

  it('escapes unescaped newlines inside string values', () => {
    const input = '{"text": "line1\nline2"}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ text: 'line1\nline2' });
  });

  it('passes through already valid JSON without modification', () => {
    const input = '{"score": 85, "feedback": "Great job!"}';
    const result = repairJson(input);
    expect(JSON.parse(result)).toEqual({ score: 85, feedback: 'Great job!' });
  });
});

// ============================================
// parseJsonResponse
// ============================================
describe('parseJsonResponse', () => {
  it('parses valid JSON in a markdown code block', () => {
    const input = '```json\n{"score": 92}\n```';
    const result = parseJsonResponse<{ score: number }>(input);
    expect(result.score).toBe(92);
  });

  it('parses valid JSON with trailing commas (repairs and parses)', () => {
    const input = '```json\n{"score": 88, "label": "good",}\n```';
    const result = parseJsonResponse<{ score: number; label: string }>(input);
    expect(result.score).toBe(88);
    expect(result.label).toBe('good');
  });

  it('throws when no JSON is present', () => {
    const input = 'No JSON here at all!';
    expect(() => parseJsonResponse(input)).toThrow();
  });
});

// ============================================
// validateSchema
// ============================================
describe('validateSchema', () => {
  const e1Schema = {
    problemClarityScore: { type: 'number' as const, default: 50 },
    solutionClarityScore: { type: 'number' as const, default: 50 },
    overallScore: { type: 'number' as const, default: 50 },
    strengths: { type: 'string[]' as const, default: [] },
    weaknesses: { type: 'string[]' as const, default: [] },
    recommendations: { type: 'string[]' as const, default: [] },
    notes: { type: 'string' as const, required: false, default: '' },
  };

  it('passes through valid data unchanged', () => {
    const input = {
      problemClarityScore: 80,
      solutionClarityScore: 75,
      overallScore: 78,
      strengths: ['Clear problem'],
      weaknesses: ['Needs more data'],
      recommendations: ['Add market size'],
      notes: 'Good start',
    };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.problemClarityScore).toBe(80);
    expect(result.strengths).toEqual(['Clear problem']);
    expect(result.notes).toBe('Good start');
  });

  it('fills missing required number fields with defaults', () => {
    const input = { strengths: [], weaknesses: [], recommendations: [] };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.problemClarityScore).toBe(50);
    expect(result.overallScore).toBe(50);
  });

  it('fixes string values in number fields', () => {
    const input = {
      problemClarityScore: 'high',
      solutionClarityScore: 75,
      overallScore: NaN,
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.problemClarityScore).toBe(50); // default for non-number
    expect(result.overallScore).toBe(50); // default for NaN
    expect(result.solutionClarityScore).toBe(75); // valid number unchanged
  });

  it('wraps single string into string[] field', () => {
    const input = {
      problemClarityScore: 80,
      solutionClarityScore: 80,
      overallScore: 80,
      strengths: 'Just one strength',
      weaknesses: [],
      recommendations: [],
    };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.strengths).toEqual(['Just one strength']);
  });

  it('filters non-string entries from string[] fields', () => {
    const input = {
      problemClarityScore: 80,
      solutionClarityScore: 80,
      overallScore: 80,
      strengths: ['valid', 42, null, 'also-valid'],
      weaknesses: [],
      recommendations: [],
    };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.strengths).toEqual(['valid', 'also-valid']);
  });

  it('handles null and undefined input for optional fields', () => {
    const input = {
      problemClarityScore: 80,
      solutionClarityScore: 80,
      overallScore: 80,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      notes: null,
    };
    const result = validateSchema(input, e1Schema, 'TEST');
    expect(result.notes).toBe(''); // default for optional null field
  });
});
