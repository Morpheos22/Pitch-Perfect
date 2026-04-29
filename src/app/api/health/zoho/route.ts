// Zoho CRM Health Check — dedicated endpoint for Zoho OAuth + CRM API diagnostics.
// Tests token refresh against BOTH EU and US Zoho regions to determine where
// credentials are registered, then tests CRM API access if auth succeeds.
//
// This is separate from /api/health because:
// 1. Zoho auth can take 5-10s per region test (no timeout shortcut)
// 2. We test multiple regions sequentially
// 3. We test CRM API calls after auth (lead search)
// 4. Failure is non-fatal — the app works without Zoho CRM

import { NextRequest, NextResponse } from 'next/server';
import { ZOHO_CONFIG, invalidateAccessToken } from '@/lib/zoho-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Zoho regional OAuth endpoints
const ZOHO_REGIONS = {
  eu: { oauth: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
  us: { oauth: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
  in: { oauth: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
  au: { oauth: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
} as const;

interface RegionTestResult {
  region: string;
  oauthEndpoint: string;
  apiEndpoint: string;
  authStatus: 'success' | 'invalid_client' | 'invalid_refresh_token' | 'error' | 'skipped';
  authError?: string;
  accessTokenObtained: boolean;
  apiReachable?: boolean;
  apiError?: string;
  latencyMs: number;
}

export async function GET(request: NextRequest) {
  // Require internal auth token
  const token = request.headers.get('x-health-token');
  if (token !== process.env.HEALTH_CHECK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const results: RegionTestResult[] = [];
  const warnings: string[] = [];
  const clientId = ZOHO_CONFIG.clientId;
  const clientSecret = ZOHO_CONFIG.clientSecret;
  const refreshToken = ZOHO_CONFIG.refreshToken;
  const configuredDomain = ZOHO_CONFIG.apiDomain;
  const derivedOAuthDomain = ZOHO_CONFIG.oAuthDomain;

  // Config check
  if (!clientId || !clientSecret || !refreshToken) {
    return NextResponse.json({
      status: 'not_configured',
      configuredDomain,
      derivedOAuthDomain,
      missing: [
        !clientId && 'ZOHO_CLIENT_ID',
        !clientSecret && 'ZOHO_CLIENT_SECRET',
        !refreshToken && 'ZOHO_REFRESH_TOKEN',
      ].filter(Boolean),
      timestamp: new Date().toISOString(),
    });
  }

  // Invalidate any cached token so we test fresh auth
  invalidateAccessToken();

  // Test each region that might be relevant
  const regionsToTest: Array<keyof typeof ZOHO_REGIONS> = ['eu', 'us', 'in', 'au'];

  let workingRegion: RegionTestResult | null = null;

  for (const regionKey of regionsToTest) {
    const region = ZOHO_REGIONS[regionKey];
    const testStart = Date.now();
    const result: RegionTestResult = {
      region: regionKey,
      oauthEndpoint: region.oauth,
      apiEndpoint: region.api,
      authStatus: 'skipped',
      accessTokenObtained: false,
      latencyMs: 0,
    };

    try {
      // Test OAuth token refresh
      const tokenUrl = `${region.oauth}/oauth/v2/token`;
      const authResponse = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      const authData = await authResponse.json();

      if (authData.error) {
        result.authStatus = authData.error === 'invalid_client'
          ? 'invalid_client'
          : authData.error === 'invalid_code' || authData.error === 'invalid_grant'
            ? 'invalid_refresh_token'
            : 'error';
        result.authError = `${authData.error}${authData.error_description ? `: ${authData.error_description}` : ''}`;
      } else if (authData.access_token) {
        result.authStatus = 'success';
        result.accessTokenObtained = true;

        // Test CRM API access with the token
        try {
          const crmResponse = await fetch(`${region.api}/crm/v2/Leads?per_page=1`, {
            method: 'GET',
            headers: {
              'Authorization': `Zoho-oauthtoken ${authData.access_token}`,
              'Content-Type': 'application/json',
            },
            signal: AbortSignal.timeout(10_000),
          });

          if (crmResponse.ok || crmResponse.status === 200 || crmResponse.status === 204) {
            result.apiReachable = true;
          } else {
            const crmError = await crmResponse.text();
            result.apiReachable = false;
            result.apiError = `HTTP ${crmResponse.status}: ${crmError.slice(0, 200)}`;
          }
        } catch (crmErr: unknown) {
          result.apiReachable = false;
          result.apiError = crmErr instanceof Error ? crmErr.message : String(crmErr);
        }

        // Found working region
        if (!workingRegion) {
          workingRegion = result;
        }
      } else {
        result.authStatus = 'error';
        result.authError = `HTTP ${authResponse.status} — no access_token and no error in response. Keys: ${Object.keys(authData).join(', ')}`;
      }
    } catch (err: unknown) {
      result.authStatus = 'error';
      result.authError = err instanceof Error ? err.message : String(err);
    }

    result.latencyMs = Date.now() - testStart;
    results.push(result);
  }

  // Determine overall status
  const configuredRegionKey = configuredDomain.includes('zohoapis.eu') ? 'eu'
    : configuredDomain.includes('zohoapis.in') ? 'in'
    : configuredDomain.includes('zohoapis.com.au') ? 'au'
    : 'us';

  const configuredResult = results.find(r => r.region === configuredRegionKey);
  const isConfiguredRegionWorking = configuredResult?.authStatus === 'success';
  const hasAnyWorkingRegion = workingRegion !== null;

  // Build warnings
  if (!isConfiguredRegionWorking && hasAnyWorkingRegion) {
    warnings.push(
      `ZOHO_API_DOMAIN is set to ${configuredDomain} (${configuredRegionKey.toUpperCase()}), but credentials only work in ${workingRegion.region.toUpperCase()}. ` +
      `Change ZOHO_API_DOMAIN to ${workingRegion.apiEndpoint} on Vercel.`
    );
  } else if (!isConfiguredRegionWorking && !hasAnyWorkingRegion) {
    warnings.push(
      `Zoho CRM credentials are invalid in ALL regions (EU, US, IN, AU). ` +
      `The client ID/secret/refresh token may be revoked, expired, or incorrectly set. ` +
      `Regenerate credentials at the correct Zoho API Console for your region.`
    );
  }

  if (isConfiguredRegionWorking && configuredResult && !configuredResult.apiReachable) {
    warnings.push(
      `Zoho OAuth succeeds in ${configuredRegionKey.toUpperCase()} but CRM API is unreachable. ` +
      `This usually means the CRM scope was not granted during OAuth authorization. ` +
      `Re-authorize with scope: ZohoCRM.modules.ALL,ZohoCRM.users.READ`
    );
  }

  // If a working region was found that's NOT the configured one, suggest the fix
  let fixSuggestion: string | undefined;
  if (!isConfiguredRegionWorking && hasAnyWorkingRegion) {
    fixSuggestion = `Update ZOHO_API_DOMAIN from "${configuredDomain}" to "${workingRegion.apiEndpoint}" on Vercel. This will auto-derive the correct OAuth domain (${workingRegion.oauthEndpoint}).`;
  } else if (!hasAnyWorkingRegion) {
    fixSuggestion = `Go to the Zoho API Console for your region (e.g. https://api-console.zoho.eu for EU) and: 1) Verify the client is active, 2) If not, create a new client, 3) Generate a new refresh token with CRM scopes, 4) Update ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_REFRESH_TOKEN on Vercel.`;
  }

  return NextResponse.json({
    status: isConfiguredRegionWorking
      ? (configuredResult?.apiReachable ? 'healthy' : 'degraded')
      : (hasAnyWorkingRegion ? 'misconfigured' : 'unhealthy'),
    configuredDomain,
    derivedOAuthDomain,
    configuredRegion: configuredRegionKey,
    workingRegion: workingRegion?.region || null,
    regionMismatch: !isConfiguredRegionWorking && hasAnyWorkingRegion,
    results,
    warnings: warnings.length > 0 ? warnings : undefined,
    fixSuggestion,
    responseTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  });
}
