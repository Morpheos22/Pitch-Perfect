/**
 * Zoho CRM module — no-op stub (Zoho CRM removed).
 * All CRM sync functions are silent no-ops.
 */

export async function syncUserToCRM(_userData: unknown): Promise<{ success: boolean }> {
  return { success: false };
}

export async function createCRMLead(_data: unknown): Promise<{ success: boolean; contactId?: string }> {
  return { success: false };
}

export async function createOrUpdateLead(_data: unknown): Promise<{ success: boolean; id?: string; contactId?: string }> {
  return { success: false };
}

export async function updateCRMContact(_contactId: string, _data: unknown): Promise<{ success: boolean }> {
  return { success: false };
}

export async function completeOnboardingInCRM(_data: unknown): Promise<{ success: boolean }> {
  return { success: false };
}

export function isZohoConfigured(): boolean {
  return false;
}
