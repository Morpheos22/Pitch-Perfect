/**
 * Safe fetch response parsing utility.
 *
 * PROBLEM: Vercel Hobby plan has a 4.5MB request body limit. When a file
 * upload exceeds this, Vercel returns "Request Entity Too Large" as PLAIN TEXT
 * (not JSON). Calling response.json() on that crashes with:
 *   "Unexpected token 'R', "Request En"... is not valid JSON"
 *
 * This utility safely handles both JSON and non-JSON error responses.
 */

export class FetchError extends Error {
  /** HTTP status code */
  status: number;
  /** Parsed error data if response was JSON, null otherwise */
  data: any;

  constructor(status: number, data: any, message: string) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'FetchError';
  }
}

/**
 * Parse a fetch Response as JSON with full error handling.
 *
 * - For error responses (!response.ok): extracts error message from JSON body
 *   if available, or falls back to raw text (for Vercel platform errors).
 * - For successful responses: parses JSON normally.
 *
 * @throws {FetchError} On any HTTP error, with .status, .data, and .message
 */
export async function safeJson<T = any>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let data: any = null;

    const ct = response.headers.get('content-type') || '';
    try {
      if (ct.includes('application/json')) {
        data = await response.json();
        message = data.error || data.message || data.details?.join('. ') || message;
      } else {
        const text = await response.text();
        if (text) message = text.slice(0, 300);
      }
    } catch {
      // Response body already consumed or unreadable — use default message
    }

    throw new FetchError(response.status, data, message);
  }

  return response.json() as Promise<T>;
}
