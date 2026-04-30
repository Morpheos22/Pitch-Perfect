// Generic email sender with Zoho CRM primary + Resend fallback.
// ALL transactional emails (Kal Protocol notifications, onboarding, etc.)
// are sent through Zoho CRM's SendMail API first. If Zoho CRM fails
// (OAuth issue, API outage, etc.), Resend is used as a fallback to
// ensure emails are never silently dropped.
//
// Onboarding welcome emails use the dedicated `sendOnboardingEmail()` in
// zoho-crm.ts instead, since they're tied to the CRM lead update flow.
// However, `sendOnboardingEmail()` now also falls back to Resend if
// Zoho CRM SendMail fails — see zoho-crm.ts for that implementation.
//
// Zoho CRM SendMail API:
// POST /crm/v2/Leads/{leadId}/actions/send_mail
//
// Requirement: The recipient must have a CRM Lead record. If no lead exists,
// one is created automatically before sending.
//
// FALLBACK: Resend (https://resend.com) is used when Zoho CRM fails.
// Set RESEND_API_KEY in your environment to enable the fallback.
// See src/lib/resend-email.ts for the Resend implementation.

import { ZOHO_CONFIG, getAccessToken } from '@/lib/zoho-auth';
import { createOrUpdateLead } from '@/lib/zoho-crm';
import { sendEmailViaResend } from '@/lib/resend-email';

// ============================================
// GENERIC EMAIL SENDER (Zoho CRM primary → Resend fallback)
// ============================================

/**
 * Send a generic email via Zoho CRM's SendMail API with Resend fallback.
 * Used by Kal Protocol for completion/failure notifications and any other
 * transactional emails. Onboarding welcome emails use the dedicated
 * `sendOnboardingEmail()` in zoho-crm.ts.
 *
 * Flow:
 *   1. Try Zoho CRM SendMail (primary)
 *   2. If Zoho fails → Try Resend (fallback)
 *   3. If both fail → Return error
 *
 * The recipient must exist as a Lead in Zoho CRM. If no lead is found,
 * one is created automatically before sending.
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  // ── PRIMARY: Zoho CRM SendMail ──
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

      // ── FALLBACK: Try Resend ──
      console.log('[Email] Attempting Resend fallback...');
      return await sendEmailViaResend({ to, subject, html });
    }

    console.log(`[Email] Sent via Zoho CRM to ${to}: "${subject}"`);
    return { success: true };
  } catch (error) {
    console.error('[Email] Zoho CRM failed:', error);

    // ── FALLBACK: Try Resend ──
    console.log('[Email] Attempting Resend fallback...');
    const resendResult = await sendEmailViaResend({ to, subject, html });

    if (resendResult.success) {
      return resendResult;
    }

    // Both failed
    return {
      success: false,
      error: `Zoho: ${error instanceof Error ? error.message : String(error)} | Resend: ${resendResult.error}`,
    };
  }
}
