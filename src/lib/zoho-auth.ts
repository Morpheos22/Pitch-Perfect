// Shared Zoho CRM OAuth token management.
// Single source of truth for access token caching across all Zoho API consumers
// (zoho-crm.ts, email.ts, etc.). Eliminates duplicate token caches that could
// cause redundant OAuth calls and stale-token drift.

// ============================================
// ZOHO API CONFIGURATION
// ============================================
// Zoho has regional data centers. The OAuth token endpoint and API endpoint
// must match the region where the Zoho account was created:
//   US:  accounts.zoho.com       / www.zohoapis.com
//   EU:  accounts.zoho.eu        / www.zohoapis.eu
//   IN:  accounts.zoho.in        / www.zohoapis.in
//   AU:  accounts.zoho.com.au    / www.zohoapis.com.au
//
// ZOHO_API_DOMAIN env var controls the CRM API base URL (e.g. https://www.zohoapis.eu).
// The OAuth token URL is auto-derived from ZOHO_API_DOMAIN so they always match.

// Derive the OAuth accounts domain from the API domain.
// e.g. "https://www.zohoapis.eu" → "https://accounts.zoho.eu"
function deriveOAuthDomain(apiDomain: string): string {
  try {
    const url = new URL(apiDomain);
    // Replace "www.zohoapis" with "accounts.zoho" in the hostname
    const host = url.hostname.replace('www.zohoapis', 'accounts.zoho');
    return `${url.protocol}//${host}`;
  } catch {
    // Fallback: if URL parsing fails, use US defaults
    return 'https://accounts.zoho.com';
  }
}

const _apiDomain = process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com';

export const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  apiDomain: _apiDomain,
  oAuthDomain: deriveOAuthDomain(_apiDomain),
  orgId: process.env.ZOHO_ORG_ID,
  senderEmail: process.env.ZOHO_SENDER_EMAIL || 'akanimohdavid@yahoo.com',
};

// ============================================
// ACCESS TOKEN CACHE
// ============================================

let accessTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid Zoho CRM access token, using cache when available.
 * Tokens are cached for 55 minutes (they expire after 1 hour).
 *
 * This function is shared across all Zoho API consumers to ensure:
 * - Only one OAuth refresh call per token lifetime (not one per module)
 * - No stale-token drift between modules
 * - Consistent credential validation
 *
 * @throws Error with detailed Zoho error info if auth fails
 */
export async function getAccessToken(): Promise<string> {
  // Return cached token if still valid
  if (accessTokenCache && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  if (!ZOHO_CONFIG.clientId || !ZOHO_CONFIG.clientSecret || !ZOHO_CONFIG.refreshToken) {
    throw new Error(
      'Zoho CRM credentials not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN.'
    );
  }

  // OAuth token endpoint must match the Zoho region (EU, US, IN, AU)
  const tokenUrl = `${ZOHO_CONFIG.oAuthDomain}/oauth/v2/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      refresh_token: ZOHO_CONFIG.refreshToken,
    }),
  });

  const data = await response.json();

  // Zoho sometimes returns HTTP 200 with an error body (e.g., {"error":"invalid_client"})
  // Check both the HTTP status and the response body for errors
  if (!response.ok || data.error) {
    const zohoError = data.error || 'unknown';
    const zohoErrorDesc = data.error_description || '';
    invalidateAccessToken(); // Clear any stale cache
    throw new Error(
      `Zoho auth failed (${ZOHO_CONFIG.oAuthDomain}): ${response.status} — ${zohoError}${zohoErrorDesc ? `: ${zohoErrorDesc}` : ''}`
    );
  }

  // Validate that access_token exists before caching
  if (!data.access_token) {
    invalidateAccessToken();
    throw new Error(
      `Zoho auth succeeded (HTTP ${response.status}) but no access_token in response. ` +
      `Response keys: ${Object.keys(data).join(', ')}. ` +
      `This usually means the refresh token is invalid or revoked.`
    );
  }

  // Cache for 55 minutes (tokens expire in 1 hour)
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return accessTokenCache.token;
}

/**
 * Invalidate the cached access token.
 * Useful when a Zoho API call returns 401 (token may have been revoked),
 * forcing the next call to refresh.
 */
export function invalidateAccessToken(): void {
  accessTokenCache = null;
}
