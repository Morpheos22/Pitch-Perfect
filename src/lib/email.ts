// Generic email sender via Zoho CRM SendMail API.
// ALL transactional emails (Kal Protocol notifications, etc.) are sent
// through Zoho CRM's SendMail API. This keeps all communications within Zoho
// CRM, providing email tracking, CRM activity history, and template management.
//
// Onboarding welcome emails use the dedicated `sendOnboardingEmail()` in
// zoho-crm.ts instead, since they're tied to the CRM lead update flow.
//
// Zoho CRM SendMail API:
// POST /crm/v2/Leads/{leadId}/actions/send_mail
//
// Requirement: The recipient must have a CRM Lead record. If no lead exists,
// one is created automatically before sending the email.

import { ZOHO_CONFIG, getAccessToken } from '@/lib/zoho-auth';
import { createOrUpdateLead } from '@/lib/zoho-crm';

// ============================================
// GENERIC EMAIL SENDER
// ============================================

/**
 * Send a generic email via Zoho CRM's SendMail API.
 * Used by Kal Protocol for completion/failure notifications and any other
 * transactional emails. Onboarding welcome emails use the dedicated
 * `sendOnboardingEmail()` in zoho-crm.ts.
 *
 * The recipient must exist as a Lead in Zoho CRM. If no lead is found,
 * one is created automatically before sending.
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  try {
    // Step 1: Find or create a CRM Lead for the recipient
    const leadResult = await createOrUpdateLead({
      email: to,
      leadSource: 'App Notification',
      leadStatus: 'Contacted',
    });

    // Step 2: Send email via Zoho CRM SendMail API
    const token = await getAccessToken();

    const response = await fetch(
      `${ZOHO_CONFIG.apiDomain}/crm/v2/Leads/${leadResult.id}/actions/send_mail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: [{
            from: ZOHO_CONFIG.senderEmail,
            to,
            subject,
            content: html,
            mail_format: 'html',
          }],
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Email] Zoho CRM SendMail failed: ${response.status}`, errorText);
      return { success: false, error: `Zoho CRM SendMail: ${response.status}` };
    }

    console.log(`[Email] Sent via Zoho CRM to ${to}: "${subject}"`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
