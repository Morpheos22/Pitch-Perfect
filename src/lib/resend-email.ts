// Resend Email Fallback Provider
// Used as a BACKUP when Zoho CRM SendMail API is unavailable.
// Zoho CRM remains the PRIMARY email provider (provides CRM activity
// tracking, email logging, and template management). Resend only
// fires when Zoho fails — ensuring onboarding emails always reach users.
//
// Flow: Zoho CRM SendMail (PRIMARY) → Resend (FALLBACK)
//
// Resend is NOT used for CRM-tracked communications — those must go
// through Zoho CRM to maintain the activity history.

import { Resend } from 'resend';

// Lazy-load Resend to avoid build-time errors when API key is missing
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY not configured — email fallback disabled');
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Default "from" address for Resend emails.
// Resend requires a verified domain or their onboarding domain.
// Format: "Pitch Perfect <onboarding@pitchcoachai.tech>" or the Resend default.
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'Pitch Perfect <onboarding@pitchcoachai.tech>';

// ============================================
// ONBOARDING WELCOME EMAIL (Resend fallback)
// ============================================

export async function sendOnboardingEmailViaResend(userData: {
  email: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  const displayName = userData.firstName || 'there';

  const html = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #ffffff; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff;">Welcome to Pitch Perfect!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">Your AI-powered pitch coaching journey begins now</p>
        </div>
        <div style="padding: 40px;">
          <p style="font-size: 18px; line-height: 1.6; color: #e2e8f0;">Hi ${displayName},</p>
          <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Welcome aboard! You've just unlocked access to your personal AI pitch coach. Whether you're preparing for investor meetings, sales presentations, or startup competitions, we're here to help you deliver pitches that captivate and convert.</p>
          <div style="background-color: #4f46e5; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 8px; font-size: 18px; color: #ffffff;">Your Free Explorer Sessions</h3>
            <p style="margin: 0; font-size: 14px; color: rgba(255,255,255,0.9);">You get <strong>2 free sessions</strong> each on Pitch Deck Analyser and Script Check to test and explore the platform. To unlock Live Pitch, Full Pitch Session, and Founder Coaching, upgrade to a paid plan.</p>
          </div>
          <h2 style="font-size: 20px; color: #ffffff; border-left: 4px solid #6366f1; padding-left: 15px;">Your 5 Powerful Modules</h2>
          <ul style="color: #cbd5e1; font-size: 14px; line-height: 2;">
            <li><strong style="color: #a5b4fc;">Pitch Deck Analyser</strong> — Upload your deck for content and visual analysis <span style=\"color: #fbbf24; font-size: 12px;\">(2 FREE sessions)</span></li>
            <li><strong style="color: #a5b4fc;">Script Check</strong> — Refine your pitch script with AI suggestions <span style=\"color: #fbbf24; font-size: 12px;\">(2 FREE sessions)</span></li>
            <li><strong style="color: #a5b4fc;">Elevator Live</strong> — Practice your elevator pitch with instant feedback <span style=\"color: #94a3b8; font-size: 12px;\">(Starter+)</span></li>
            <li><strong style="color: #a5b4fc;">Full Pitch Session</strong> — Complete 30-min session with deck + video analysis <span style=\"color: #94a3b8; font-size: 12px;\">(Professional+)</span></li>
            <li><strong style="color: #a5b4fc;">Founder Coaching</strong> — Readiness, pathway, research, and narration <span style=\"color: #94a3b8; font-size: 12px;\">(Starter+/Professional+)</span></li>
          </ul>
          <a href="https://pitchcoachai.tech/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Start Your First Pitch Analysis</a>
          <div style="background-color: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="margin: 0 0 15px; font-size: 16px; color: #fbbf24;">Quick Start Tips</h3>
            <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.8;">
              <li>Start with the Pitch Deck Analyser to get baseline feedback</li>
              <li>Use Script Check to refine your narrative before practicing</li>
              <li>Upgrade to Starter to unlock Live Pitch and Founder modules</li>
              <li>Graduate to Professional when you're ready for Full Pitch Sessions</li>
            </ul>
          </div>
          <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 20px; margin-top: 20px;">
            <h3 style="margin: 0 0 10px; font-size: 16px; color: #a5b4fc;">Pricing at a Glance</h3>
            <table style="width: 100%; color: #cbd5e1; font-size: 13px;">
              <tr><td style="padding: 4px 0; color: #94a3b8;">Free</td><td style="padding: 4px 0; text-align: right;">$0/mo — 2 deck + 2 script sessions</td></tr>
              <tr><td style="padding: 4px 0; color: #94a3b8;">Starter</td><td style="padding: 4px 0; text-align: right;">$29/mo — Deck, Script, Live, Founder</td></tr>
              <tr style="background-color: rgba(99,102,241,0.15);"><td style="padding: 4px 0; color: #a5b4fc; font-weight: 600;">Professional</td><td style="padding: 4px 0; text-align: right; color: #a5b4fc; font-weight: 600;">$79/mo — Most popular, all modules</td></tr>
              <tr><td style="padding: 4px 0; color: #94a3b8;">Enterprise</td><td style="padding: 4px 0; text-align: right;">$199/mo — Unlimited everything</td></tr>
            </table>
          </div>
        </div>
        <div style="padding: 30px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
          <p style="margin: 0; font-size: 14px; color: #94a3b8;">Questions? We're here to help!</p>
          <p style="margin: 5px 0 0; font-size: 14px;"><a href="mailto:support@pitchcoachai.tech" style="color: #a5b4fc; text-decoration: none;">support@pitchcoachai.tech</a></p>
        </div>
        <div style="padding: 20px 40px; background-color: #0f172a; text-align: center; border-top: 1px solid #1e293b;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Built by <a href="https://automagikal.co.za/" style="color: #a5b4fc; text-decoration: none;">AutomagiKal</a></p>
          <p style="margin: 10px 0 0; font-size: 12px; color: #475569;">&copy; ${new Date().getFullYear()} Pitch Perfect. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to: userData.email,
      subject: 'Welcome to Pitch Perfect - Your AI Pitch Coach Awaits!',
      html,
    });

    if (error) {
      console.error('[Resend] Onboarding email failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Resend] Onboarding email sent to ${userData.email} (id: ${data?.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Resend] Onboarding email exception:', message);
    return { success: false, error: message };
  }
}

// ============================================
// GENERIC EMAIL (Resend fallback)
// ============================================

export async function sendEmailViaResend({ to, subject, html }: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const resend = getResend();
  if (!resend) {
    return { success: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: RESEND_FROM,
      to,
      subject,
      html,
    });

    if (error) {
      console.error('[Resend] Email failed:', error.message);
      return { success: false, error: error.message };
    }

    console.log(`[Resend] Email sent to ${to}: "${subject}" (id: ${data?.id})`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Resend] Email exception:', message);
    return { success: false, error: message };
  }
}

// ============================================
// HEALTH CHECK
// ============================================

/**
 * Check if Resend is configured and reachable.
 * Returns true if RESEND_API_KEY is set (does NOT send a test email).
 */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}
