// Zoho Analytics Integration Service for Pitch Perfect × Automagikal
// Business intelligence dashboards — user growth, module usage, revenue metrics

// ============================================
// TYPE DEFINITIONS
// ============================================

/** Supported export formats */
export type ExportFormat = 'CSV' | 'JSON' | 'PDF' | 'HTML';

/** Column metadata from an Analytics table/view */
export interface ColumnMetadata {
  columnName: string;
  dataType: string;
  displayFormat?: string;
  description?: string;
}

/** Result of an analytics view query */
export interface QueryResult {
  rows: Record<string, unknown>[];
  columnNames: string[];
  totalCount: number;
}

/** Import data row */
export type ImportRow = Record<string, string | number | boolean | null>;

/** Import result */
export interface ImportResult {
  importId: string;
  status: 'SUCCESS' | 'FAILURE' | 'PARTIAL';
  successCount: number;
  failureCount: number;
  errorMessage?: string;
}

// ============================================
// ZOHO ANALYTICS API CONFIGURATION
// ============================================

const ZOHO_ANALYTICS_CONFIG = {
  clientId: process.env.ZOHO_ANALYTICS_CLIENT_ID,
  clientSecret: process.env.ZOHO_ANALYTICS_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_ANALYTICS_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_ANALYTICS_API_DOMAIN || 'https://www.zohoapis.com/analytics',
};

// Independent token cache for Analytics
let analyticsTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getAccessToken(): Promise<string> {
  if (analyticsTokenCache && analyticsTokenCache.expiresAt > Date.now()) {
    return analyticsTokenCache.token;
  }

  const response = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_ANALYTICS_CONFIG.clientId!,
      client_secret: ZOHO_ANALYTICS_CONFIG.clientSecret!,
      refresh_token: ZOHO_ANALYTICS_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Analytics auth failed: ${response.status}`);
  }

  const data = await response.json();
  analyticsTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };
  return data.access_token;
}

async function analyticsRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object,
): Promise<unknown> {
  const token = await getAccessToken();
  const url = `${ZOHO_ANALYTICS_CONFIG.apiDomain}/api/v2${endpoint}`;

  const headers: Record<string, string> = {
    'Authorization': `Zoho-oauthtoken ${token}`,
  };
  if (data) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Zoho Analytics API error (${method} ${endpoint}): ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

// ============================================
// QUERY & METADATA
// ============================================

/**
 * Query an analytics view with optional criteria filters.
 * Returns raw rows and column names for flexible data processing.
 * @param workspaceId - The workspace containing the view
 * @param viewId - The view (report/chart/table) to query
 * @param criteria - Optional SQL-like criteria string (e.g. "Score > 80")
 */
export async function queryView(
  workspaceId: string,
  viewId: string,
  criteria?: string,
): Promise<QueryResult> {
  const params = new URLSearchParams();
  if (criteria) params.set('criteria', criteria);

  const result = await analyticsRequest(
    `/workspaces/${workspaceId}/views/${viewId}/data?${params.toString()}`,
  ) as {
    rows: Array<Array<unknown>>;
    columnNames: string[];
    totalCount: number;
  };

  const columnNames = result.columnNames || [];
  const rows = (result.rows || []).map((row) => {
    const record: Record<string, unknown> = {};
    row.forEach((value, index) => {
      record[columnNames[index]] = value;
    });
    return record;
  });

  return {
    rows,
    columnNames,
    totalCount: result.totalCount || rows.length,
  };
}

/**
 * Get column-level metadata for a specific table in a workspace.
 * Useful for understanding available fields and their types.
 * @param workspaceId - The workspace containing the table
 * @param tableId - The table to inspect
 */
export async function getColumnMetadata(
  workspaceId: string,
  tableId: string,
): Promise<ColumnMetadata[]> {
  const result = await analyticsRequest(
    `/workspaces/${workspaceId}/tables/${tableId}/columns`,
  ) as {
    columns: ColumnMetadata[];
  };
  return result.columns || [];
}

// ============================================
// DATA IMPORT / EXPORT
// ============================================

/**
 * Export data from a table in the specified format.
 * @param workspaceId - The workspace containing the table
 * @param tableId - The table to export
 * @param format - Desired export format (CSV, JSON, PDF, HTML)
 * @returns Raw Response for streaming / blob handling
 */
export async function exportData(
  workspaceId: string,
  tableId: string,
  format: ExportFormat = 'JSON',
): Promise<Response> {
  const token = await getAccessToken();
  const url = `${ZOHO_ANALYTICS_CONFIG.apiDomain}/api/v2/workspaces/${workspaceId}/tables/${tableId}/data?format=${format}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Authorization': `Zoho-oauthtoken ${token}` },
  });

  if (!response.ok) {
    throw new Error(`Zoho Analytics export error: ${response.status}`);
  }

  return response;
}

/**
 * Import (push) data rows into a Zoho Analytics table.
 * Used for syncing usage/revenue metrics from the app.
 * @param workspaceId - The workspace containing the target table
 * @param tableId - The target table for insertion
 * @param data - Array of row objects matching the table schema
 */
export async function importData(
  workspaceId: string,
  tableId: string,
  data: ImportRow[],
): Promise<ImportResult> {
  const result = await analyticsRequest(
    `/workspaces/${workspaceId}/tables/${tableId}/import`,
    'POST',
    {
      data: {
        rows: data,
      },
      config: {
        skipMatching: true,
        onConflict: 'updatedata',
      },
    },
  ) as {
    result: {
      importId: string;
      status: string;
      successCount: number;
      failureCount: number;
      errorMessage?: string;
    };
  };

  return {
    importId: result.result.importId,
    status: result.result.status as ImportResult['status'],
    successCount: result.result.successCount,
    failureCount: result.result.failureCount,
    errorMessage: result.result.errorMessage,
  };
}
