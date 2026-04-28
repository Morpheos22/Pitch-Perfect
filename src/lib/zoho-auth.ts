// Shared Zoho CRM OAuth token management.
// Single source of truth for access token caching across all Zoho API consumers
// (zoho-crm.ts, email.ts, etc.). Eliminates duplicate token caches that could
// cause redundant OAuth calls and stale-token drift.

// ============================================
// ZOHO API CONFIGURATION
// ============================================

export const ZOHO_CONFIG = {
  clientId: process.env.ZOHO_CLIENT_ID,
  clientSecret: process.env.ZOHO_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_API_DOMAIN || 'https://www.zohoapis.com',
  orgId: process.env.ZOHO_ORG_ID,
  senderEmail: process.env.ZOHO_SENDER_EMAIL || 'sherwyn@automagikal.co.za',
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

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_CONFIG.clientId,
      client_secret: ZOHO_CONFIG.clientSecret,
      refresh_token: ZOHO_CONFIG.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho auth failed: ${response.status}`);
  }

  const data = await response.json();

  // Cache for 55 minutes (tokens expire in 1 hour)
  accessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return data.access_token;
}

/**
 * Invalidate the cached access token.
 * Useful when a Zoho API call returns 401 (token may have been revoked),
 * forcing the next call to refresh.
 */
export function invalidateAccessToken(): void {
  accessTokenCache = null;
}
