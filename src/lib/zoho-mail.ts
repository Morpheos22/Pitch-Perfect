// Zoho Mail Integration Service for Pitch Perfect
// Handles sending PDF reports via Zoho Mail API

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface EmailAttachment {
  filename: string;
  content: Buffer | string; // Buffer for binary, string for base64
  contentType: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  bcc?: string[];
  cc?: string[];
  from?: {
    name: string;
    email: string;
  };
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlTemplate: string;
  variables: string[];
}

// ============================================
// ZOHO MAIL API CONFIGURATION
// ============================================

const ZOHO_MAIL_CONFIG = {
  clientId: process.env.ZOHO_MAIL_CLIENT_ID,
  clientSecret: process.env.ZOHO_MAIL_CLIENT_SECRET,
  refreshToken: process.env.ZOHO_MAIL_REFRESH_TOKEN,
  apiDomain: process.env.ZOHO_MAIL_API_DOMAIN || 'https://mail.zoho.com',
  fromEmail: process.env.ZOHO_MAIL_FROM || 'reports@pitchperfect.ai',
  fromName: process.env.ZOHO_MAIL_FROM_NAME || 'Pitch Perfect',
};

// Token cache
let mailAccessTokenCache: { token: string; expiresAt: number } | null = null;

// ============================================
// AUTHENTICATION
// ============================================

async function getMailAccessToken(): Promise<string> {
  // Check cache
  if (mailAccessTokenCache && mailAccessTokenCache.expiresAt > Date.now()) {
    return mailAccessTokenCache.token;
  }

  const response = await fetch(`https://accounts.zoho.com/oauth/v2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: ZOHO_MAIL_CONFIG.clientId!,
      client_secret: ZOHO_MAIL_CONFIG.clientSecret!,
      refresh_token: ZOHO_MAIL_CONFIG.refreshToken!,
    }),
  });

  if (!response.ok) {
    throw new Error(`Zoho Mail auth failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Cache for 55 minutes
  mailAccessTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + 55 * 60 * 1000,
  };

  return data.access_token;
}

// ============================================
// EMAIL SENDING
// ============================================

export async function sendEmail(options: EmailOptions): Promise<{ messageId: string }> {
  const token = await getMailAccessToken();
  
  // Build multipart form data
  const formData = new FormData();
  formData.append('from', `${ZOHO_MAIL_CONFIG.fromName} <${options.from?.email || ZOHO_MAIL_CONFIG.fromEmail}>`);
  formData.append('to', options.to);
  formData.append('subject', options.subject);
  formData.append('htmlbody', options.htmlBody);
  
  if (options.textBody) {
    formData.append('textbody', options.textBody);
  }
  
  if (options.replyTo) {
    formData.append('replyto', options.replyTo);
  }
  
  if (options.cc && options.cc.length > 0) {
    formData.append('cc', options.cc.join(','));
  }
  
  if (options.bcc && options.bcc.length > 0) {
    formData.append('bcc', options.bcc.join(','));
  }
  
  // Add attachments
  if (options.attachments && options.attachments.length > 0) {
    for (const attachment of options.attachments) {
      const content = attachment.content instanceof Buffer 
        ? attachment.content 
        : Buffer.from(attachment.content, 'base64');
      
      const blob = new Blob([content], { type: attachment.contentType });
      formData.append('attachments', blob, attachment.filename);
    }
  }

  const response = await fetch(`${ZOHO_MAIL_CONFIG.apiDomain}/api/v1/accounts/me/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Zoho Mail API error: ${response.status} - ${error}`);
  }

  const result = await response.json() as { data: { messageId: string } };
  return { messageId: result.data.messageId };
}

// ============================================
// TEMPLATES
// ============================================

const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  'session-complete': {
    id: 'session-complete',
    name: 'Session Complete',
    subject: 'Your {{sessionType}} Analysis Report',
    htmlTemplate: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Analysis Report</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f8fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #334B79 0%, #263a60 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">
        Pitch<span style="color: #4AAB9A;">Perfect</span>
      </h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px;">
      <h2 style="color: #334B79; margin: 0 0 10px 0;">Your Analysis is Ready!</h2>
      <p style="color: #6b6b85; margin: 0 0 20px 0;">
        Hi {{firstName}},<br><br>
        Your {{sessionType}} analysis has been completed. Here's a quick summary:
      </p>
      
      <!-- Score Card -->
      <div style="background: linear-gradient(135deg, #eef1f8 0%, #f7f8fc 100%); border-radius: 8px; padding: 20px; margin-bottom: 20px; text-align: center;">
        <div style="font-size: 48px; font-weight: bold; color: #334B79;">{{overallScore}}</div>
        <div style="color: #6b6b85; font-size: 14px;">Overall Score</div>
      </div>
      
      <!-- Quick Stats -->
      <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
        <div style="flex: 1; text-align: center; padding: 10px;">
          <div style="font-weight: bold; color: #4AAB9A;">{{strengthCount}}</div>
          <div style="font-size: 12px; color: #6b6b85;">Strengths</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 10px;">
          <div style="font-weight: bold; color: #ED3B65;">{{improvementCount}}</div>
          <div style="font-size: 12px; color: #6b6b85;">Areas to Improve</div>
        </div>
        <div style="flex: 1; text-align: center; padding: 10px;">
          <div style="font-weight: bold; color: #334B79;">{{recommendationCount}}</div>
          <div style="font-size: 12px; color: #6b6b85;">Recommendations</div>
        </div>
      </div>
      
      <!-- CTA -->
      <div style="text-align: center; margin-bottom: 20px;">
        <a href="{{viewReportUrl}}" style="display: inline-block; background: #334B79; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Full Report
        </a>
      </div>
      
      <p style="color: #6b6b85; font-size: 14px; margin: 0;">
        Your detailed PDF report is attached to this email. You can also access your session history anytime in your dashboard.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f7f8fc; padding: 20px; text-align: center; border-top: 1px solid #e8e8f0;">
      <p style="color: #6b6b85; font-size: 12px; margin: 0;">
        © 2026 Pitch Perfect. All rights reserved.<br>
        <a href="{{unsubscribeUrl}}" style="color: #334B79;">Unsubscribe</a> | 
        <a href="{{preferencesUrl}}" style="color: #334B79;">Email Preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['firstName', 'sessionType', 'overallScore', 'strengthCount', 'improvementCount', 'recommendationCount', 'viewReportUrl', 'unsubscribeUrl', 'preferencesUrl'],
  },
  
  'payment-confirmation': {
    id: 'payment-confirmation',
    name: 'Payment Confirmation',
    subject: 'Welcome to Pitch Perfect - Your {{productName}} Access',
    htmlTemplate: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Welcome to Pitch Perfect</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f8fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #334B79 0%, #263a60 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0;">
        Pitch<span style="color: #4AAB9A;">Perfect</span>
      </h1>
    </div>
    
    <div style="padding: 30px;">
      <h2 style="color: #334B79;">Welcome Aboard, {{firstName}}!</h2>
      <p style="color: #6b6b85;">
        Thank you for purchasing <strong>{{productName}}</strong>. Your payment of {{amount}} {{currency}} has been confirmed.
      </p>
      
      <!-- Entitlements -->
      <div style="background: #e8f6f4; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h3 style="color: #338a7b; margin: 0 0 15px 0;">Your Sessions</h3>
        {{#each modules}}
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <span>{{this.name}}</span>
          <span style="font-weight: bold; color: #4AAB9A;">{{this.cycles}} cycles</span>
        </div>
        {{/each}}
      </div>
      
      <div style="text-align: center;">
        <a href="{{dashboardUrl}}" style="display: inline-block; background: #4AAB9A; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Start Your First Session
        </a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['firstName', 'productName', 'amount', 'currency', 'modules', 'dashboardUrl'],
  },
  
  'upsell': {
    id: 'upsell',
    name: 'Session Upsell',
    subject: 'Unlock More Sessions - Special Offer Inside',
    htmlTemplate: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Continue Your Journey</title>
</head>
<body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f7f8fc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden;">
    <div style="background: linear-gradient(135deg, #334B79 0%, #263a60 100%); padding: 30px; text-align: center;">
      <h1 style="color: white; margin: 0;">
        Pitch<span style="color: #4AAB9A;">Perfect</span>
      </h1>
    </div>
    
    <div style="padding: 30px;">
      <h2 style="color: #334B79;">Keep Improving, {{firstName}}!</h2>
      <p style="color: #6b6b85;">
        You've used all your sessions for {{productName}}. But your pitch journey doesn't have to end here!
      </p>
      
      <div style="background: #fffbe6; border: 1px solid #e8c84a; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
        <h3 style="color: #7a5c00; margin: 0 0 10px 0;">Special Add-on Offer</h3>
        <p style="color: #7a5c00; margin: 0;">
          Get {{addonCycles}} additional cycles for just {{addonPrice}}!
        </p>
      </div>
      
      <div style="text-align: center;">
        <a href="{{addonUrl}}" style="display: inline-block; background: #334B79; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Get More Sessions
        </a>
      </div>
    </div>
  </div>
</body>
</html>
    `,
    variables: ['firstName', 'productName', 'addonCycles', 'addonPrice', 'addonUrl'],
  },
};

// ============================================
// TEMPLATE RENDERING
// ============================================

function renderTemplate(template: string, variables: Record<string, unknown>): string {
  let rendered = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    
    if (Array.isArray(value)) {
      // Handle #each loops
      const eachRegex = new RegExp(`{{#each ${key}}}([\\s\\S]*?){{/each}}`, 'g');
      rendered = rendered.replace(eachRegex, (_, innerTemplate) => {
        return value.map(item => {
          let itemHtml = innerTemplate;
          for (const [itemKey, itemValue] of Object.entries(item as Record<string, unknown>)) {
            itemHtml = itemHtml.replace(new RegExp(`{{this\\.${itemKey}}}`, 'g'), String(itemValue));
          }
          return itemHtml;
        }).join('');
      });
    } else {
      rendered = rendered.replace(regex, String(value ?? ''));
    }
  }
  
  // Remove unhandled #each blocks
  rendered = rendered.replace(/{{#each[\s\S]*?{{\/each}}/g, '');
  
  return rendered;
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

export async function sendSessionCompleteEmail(options: {
  to: string;
  firstName: string;
  sessionType: string;
  overallScore: number;
  strengths: string[];
  recommendations: string[];
  viewReportUrl: string;
  pdfBuffer?: Buffer;
  sessionName: string;
}): Promise<{ messageId: string }> {
  const template = EMAIL_TEMPLATES['session-complete'];
  
  const htmlBody = renderTemplate(template.htmlTemplate, {
    firstName: options.firstName,
    sessionType: options.sessionType,
    overallScore: options.overallScore,
    strengthCount: options.strengths.length,
    improvementCount: options.recommendations.filter(r => r.toLowerCase().includes('improve')).length,
    recommendationCount: options.recommendations.length,
    viewReportUrl: options.viewReportUrl,
    unsubscribeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe`,
    preferencesUrl: `${process.env.NEXT_PUBLIC_APP_URL}/email-preferences`,
  });
  
  const attachments: EmailAttachment[] = [];
  
  if (options.pdfBuffer) {
    attachments.push({
      filename: `${options.sessionName.replace(/[^a-zA-Z0-9]/g, '_')}_Report.pdf`,
      content: options.pdfBuffer,
      contentType: 'application/pdf',
    });
  }
  
  return sendEmail({
    to: options.to,
    subject: renderTemplate(template.subject, { sessionType: options.sessionType }),
    htmlBody,
    textBody: `Your ${options.sessionType} analysis is ready! Score: ${options.overallScore}/100. View at ${options.viewReportUrl}`,
    attachments,
  });
}

export async function sendPaymentConfirmationEmail(options: {
  to: string;
  firstName: string;
  productName: string;
  amount: number;
  currency: string;
  modules: Array<{ name: string; cycles: number }>;
}): Promise<{ messageId: string }> {
  const template = EMAIL_TEMPLATES['payment-confirmation'];
  
  const htmlBody = renderTemplate(template.htmlTemplate, {
    ...options,
    dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });
  
  return sendEmail({
    to: options.to,
    subject: renderTemplate(template.subject, { productName: options.productName }),
    htmlBody,
  });
}

export async function sendUpsellEmail(options: {
  to: string;
  firstName: string;
  productName: string;
  addonCycles: number;
  addonPrice: string;
  addonUrl: string;
}): Promise<{ messageId: string }> {
  const template = EMAIL_TEMPLATES['upsell'];
  
  const htmlBody = renderTemplate(template.htmlTemplate, options);
  
  return sendEmail({
    to: options.to,
    subject: template.subject,
    htmlBody,
  });
}
