// Dual-provider email sender: Zoho CRM (PRIMARY) → Resend (FALLBACK).
//
// ALL transactional emails attempt Zoho CRM SendMail first (for CRM
// activity tracking, email logging, and template management). If Zoho
// fails, Resend fires as a guaranteed-delivery fallback.
//
// Onboarding welcome emails use the dedicated `sendOnboardingEmail()`
// in zoho-crm.ts (which has its own Resend fallback) since they're
// tied to the CRM lead update flow.
//
// Email provider priority:
//   1. Zoho CRM SendMail API (PRIMARY — CRM-tracked, logged against lead)
//   2. Resend (FALLBACK — guaranteed delivery when Zoho is down)
//
// Zoho CRM SendMail API:
// POST /crm/v2/Leads/{leadId}/actions/send_mail
//
// Requirement: The recipient must have a CRM Lead record. If no lead exists,
// one is created automatically before sending the email.

import { ZOHO_CONFIG, getAccessToken } from '@/lib/zoho-auth';
import { createOrUpdateLead } from '@/lib/zoho-crm';
import { sendEmailViaResend } from '@/lib/resend-email';

// ============================================
// GENERIC EMAIL SENDER (DUAL-PROVIDER)
// ============================================

/**
 * Send a generic email via Zoho CRM's SendMail API, with Resend fallback.
 * Used by Kal Protocol for completion/failure notifications and any other
 * transactional emails. Onboarding welcome emails use the dedicated
 * `sendOnboardingEmail()` in zoho-crm.ts.
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
      throw new Error(`Zoho CRM SendMail: ${response.status} — ${errorText.substring(0, 200)}`);
    }

    console.log(`[Email] Sent via Zoho CRM to ${to}: "${subject}"`);
    return { success: true };
  } catch (zohoError) {
    const zohoMessage = zohoError instanceof Error ? zohoError.message : String(zohoError);
    console.warn(`[Email] Zoho CRM failed for ${to}: ${zohoMessage}`);

    // ── FALLBACK: Resend ──
    console.log(`[Email] Attempting Resend fallback for ${to}...`);
    const resendResult = await sendEmailViaResend({ to, subject, html });

    if (resendResult.success) {
      console.log(`[Email] Resend fallback delivered to ${to}: "${subject}"`);
      return { success: true };
    }

    console.error(`[Email] Both providers failed for ${to}. Zoho: ${zohoMessage}; Resend: ${resendResult.error}`);
    return { success: false, error: `Zoho: ${zohoMessage}; Resend: ${resendResult.error}` };
  }
}
