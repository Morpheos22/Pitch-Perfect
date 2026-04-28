// Zoho CRM Integration Service for Pitch Perfect
// Handles lead management, contact sync, and onboarding email
//
// The onboarding welcome email is sent via Zoho CRM's SendMail API.
// Zoho CRM can send template-based emails to leads, which ensures
// the CRM is the single source of truth for all user-facing
// communications during onboarding.

import { ZOHO_CONFIG, getAccessToken } from '@/lib/zoho-auth';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface ZohoLead {
  id?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  country?: string;
  phone?: string;
  leadSource?: string;
  leadStatus?: 'New' | 'Contacted' | 'Qualified' | 'Unqualified';
  description?: string;
  // Custom fields
  Product_Purchased?: string;
  Total_Sessions_Used?: number;
  Last_Session_Date?: string;
  Last_Session_Score?: number;
  Customer_Type?: 'Free' | 'Paid' | 'Gifted';
}

async function zohoApiRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: object
): Promise<unknown> {
  const token = await getAccessToken();
  
  const response = await fetch(`${ZOHO_CONFIG.apiDomain}/crm/v2${endpoint}`, {
    method,
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoho API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================
// LEAD MANAGEMENT
// ============================================

export async function createOrUpdateLead(lead: ZohoLead): Promise<{ id: string; created: boolean }> {
  // First, search for existing lead by email
  const existingLeads = await zohoApiRequest(
    `/Leads/search?email=${encodeURIComponent(lead.email)}`
  ) as { data?: Array<{ id: string }> };

  if (existingLeads.data && existingLeads.data.length > 0) {
    // Update existing lead
    const leadId = existingLeads.data[0].id;
    await zohoApiRequest(`/Leads/${leadId}`, 'PUT', {
      data: [lead],
    });
    return { id: leadId, created: false };
  }

  // Create new lead
  const result = await zohoApiRequest('/Leads', 'POST', {
    data: [lead],
  }) as { data?: Array<{ details?: { id?: string } }> };

  // Null-safe access — Zoho API may return unexpected format
  const leadId = result.data?.[0]?.details?.id;
  if (!leadId) {
    throw new Error(`Zoho CRM create lead returned unexpected format: ${JSON.stringify(result).slice(0, 200)}`);
  }
  return { id: leadId, created: true };
}

// ============================================
// SYNC USER TO CRM
// ============================================

export async function syncUserToCRM(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  company?: string;
  clerkId: string;
  primaryUseCase?: string;
}): Promise<{ leadId: string; isNew: boolean }> {
  const lead: ZohoLead = {
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    country: userData.country,
    company: userData.company,
    leadSource: 'App Registration',
    leadStatus: 'New',
    description: `Clerk ID: ${userData.clerkId}${userData.primaryUseCase ? ` | Use Case: ${userData.primaryUseCase}` : ''}`,
    Customer_Type: 'Free',
  };

  const result = await createOrUpdateLead(lead);
  return { leadId: result.id, isNew: result.created };
}

// ============================================
// ONBOARDING EMAIL VIA ZOHO CRM
// ============================================
//
// When a new user completes onboarding, we update the CRM lead with
// full profile data (country, useCase, leadStatus='Contacted') and
// then send the onboarding welcome email via Zoho CRM's SendMail API.
// This keeps all email communications within Zoho CRM, which provides:
// - Email tracking (opens, clicks, bounces)
// - CRM activity history (every email logged against the lead)
// - Template management (update email content without code changes)
// - Deliverability via Zoho's email infrastructure
//
// Zoho CRM SendMail API:
// POST /crm/v2/Leads/{leadId}/actions/send_mail

export async function sendOnboardingEmail(leadId: string, userData: {
  email: string;
  firstName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const displayName = userData.firstName || 'there';

  const emailHtml = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #ffffff; padding: 40px 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff;">Welcome to Pitch Perfect!</h1>
          <p style="margin: 10px 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">Your AI-powered pitch coaching journey begins now</p>
        </div>
        <div style="padding: 40px;">
          <p style="font-size: 18px; line-height: 1.6; color: #e2e8f0;">Hi ${displayName},</p>
          <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1;">Welcome aboard! You've just unlocked access to your personal AI pitch coach. Whether you're preparing for investor meetings, sales presentations, or startup competitions, we're here to help you deliver pitches that captivate and convert.</p>
          <h2 style="font-size: 20px; color: #ffffff; border-left: 4px solid #6366f1; padding-left: 15px;">Your 5 Powerful Modules</h2>
          <ul style="color: #cbd5e1; font-size: 14px; line-height: 2;">
            <li><strong style="color: #a5b4fc;">Pitch Deck Analyser</strong> — Upload your deck for content and visual analysis</li>
            <li><strong style="color: #a5b4fc;">Script Check</strong> — Refine your pitch script with AI suggestions</li>
            <li><strong style="color: #a5b4fc;">Elevator Live</strong> — Practice your elevator pitch with instant feedback</li>
            <li><strong style="color: #a5b4fc;">Full Pitch Session</strong> — Complete 30-min session with deck + video analysis</li>
            <li><strong style="color: #a5b4fc;">Founder Coaching</strong> — Readiness, pathway, research, and narration</li>
          </ul>
          <a href="https://pitchcoachai.tech/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600;">Start Your First Pitch Analysis</a>
          <div style="background-color: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 20px; margin-top: 30px;">
            <h3 style="margin: 0 0 15px; font-size: 16px; color: #fbbf24;">Quick Start Tips</h3>
            <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.8;">
              <li>Start with the Pitch Deck Analyser to get baseline feedback</li>
              <li>Use Script Check to refine your narrative before practicing</li>
              <li>Try Elevator Live for quick, iterative practice sessions</li>
              <li>Graduate to Full Pitch Session when you're ready for the real deal</li>
            </ul>
          </div>
        </div>
        <div style="padding: 30px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
          <p style="margin: 0; font-size: 14px; color: #94a3b8;">Questions? We're here to help!</p>
          <p style="margin: 5px 0 0; font-size: 14px;"><a href="mailto:${ZOHO_CONFIG.senderEmail}" style="color: #a5b4fc; text-decoration: none;">${ZOHO_CONFIG.senderEmail}</a></p>
        </div>
        <div style="padding: 20px 40px; background-color: #0f172a; text-align: center; border-top: 1px solid #1e293b;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">Built by <a href="https://automagikal.co.za/" style="color: #a5b4fc; text-decoration: none;">AutomagiKal</a></p>
          <p style="margin: 10px 0 0; font-size: 12px; color: #475569;">&copy; ${new Date().getFullYear()} Pitch Perfect. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  try {
    await zohoApiRequest(`/Leads/${leadId}/actions/send_mail`, 'POST', {
      data: [{
        from: ZOHO_CONFIG.senderEmail,
        to: userData.email,
        subject: 'Welcome to Pitch Perfect - Your AI Pitch Coach Awaits!',
        content: emailHtml,
        mail_format: 'html',
      }],
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Zoho CRM] Send onboarding email failed for ${userData.email}:`, message);
    return { success: false, error: message };
  }
}

// ============================================
// SYNC + EMAIL: COMPLETE ONBOARDING TO CRM
// ============================================
// Single function that updates the CRM lead with full onboarding data
// AND sends the welcome email. Used by both the onboarding API and
// the Clerk webhook as a reliable retry mechanism.

export async function completeOnboardingInCRM(userData: {
  email: string;
  firstName?: string;
  lastName?: string;
  country?: string;
  clerkId: string;
  primaryUseCase?: string;
}): Promise<{ leadId: string; isNew: boolean; emailSent: boolean }> {
  // 1. Update CRM lead with complete profile
  const lead: ZohoLead = {
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    country: userData.country,
    leadSource: 'App Registration',
    leadStatus: 'Contacted', // Upgraded from 'New' — user has completed onboarding
    description: `Clerk ID: ${userData.clerkId}${userData.primaryUseCase ? ` | Use Case: ${userData.primaryUseCase}` : ''}`,
    Customer_Type: 'Free',
  };

  const result = await createOrUpdateLead(lead);

  // 2. Send onboarding welcome email via Zoho CRM
  const emailResult = await sendOnboardingEmail(result.id, {
    email: userData.email,
    firstName: userData.firstName,
  });

  return { leadId: result.id, isNew: result.created, emailSent: emailResult.success };
}
