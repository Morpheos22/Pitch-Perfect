import { Resend } from 'resend';

// Lazy-load Resend to avoid build-time errors
let resend: Resend | null = null;

function getResend(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured');
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

interface WelcomeEmailProps {
  email: string;
  firstName?: string;
}

export async function sendWelcomeEmail({ email, firstName }: WelcomeEmailProps) {
  const displayName = escapeHtml(firstName || 'there');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Pitch Perfect</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0f172a; color: #ffffff;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1e293b; border-radius: 16px; overflow: hidden;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px; text-align: center;">
                  <h1 style="margin: 0; font-size: 32px; font-weight: 700; color: #ffffff;">
                    🎤 Welcome to Pitch Perfect!
                  </h1>
                  <p style="margin: 10px 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">
                    Your AI-powered pitch coaching journey begins now
                  </p>
                </td>
              </tr>

              <!-- Main Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="font-size: 18px; line-height: 1.6; color: #e2e8f0; margin: 0 0 20px;">
                    Hi ${displayName},
                  </p>
                  <p style="font-size: 16px; line-height: 1.6; color: #cbd5e1; margin: 0 0 30px;">
                    Welcome aboard! You've just unlocked access to your personal AI pitch coach.
                    Whether you're preparing for investor meetings, sales presentations, or startup competitions,
                    we're here to help you deliver pitches that captivate and convert.
                  </p>

                  <!-- Features Grid -->
                  <h2 style="font-size: 20px; color: #ffffff; margin: 0 0 20px; border-left: 4px solid #6366f1; padding-left: 15px;">
                    Your 5 Powerful Modules
                  </h2>

                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 30px;">
                    <tr>
                      <td style="padding: 15px; background-color: #334155; border-radius: 8px; margin-bottom: 10px;">
                        <h3 style="margin: 0 0 5px; font-size: 16px; color: #a5b4fc;">📊 Pitch Deck Analyser</h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Upload your deck and get AI-powered feedback on structure, design, and investor appeal</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px; background-color: #334155; border-radius: 8px; margin-bottom: 10px;">
                        <h3 style="margin: 0 0 5px; font-size: 16px; color: #a5b4fc;">📝 Script Check</h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Refine your pitch script with AI suggestions for clarity, persuasion, and impact</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px; background-color: #334155; border-radius: 8px; margin-bottom: 10px;">
                        <h3 style="margin: 0 0 5px; font-size: 16px; color: #a5b4fc;">🚀 Elevator Live</h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Practice your elevator pitch in real-time with instant AI feedback</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px; background-color: #334155; border-radius: 8px; margin-bottom: 10px;">
                        <h3 style="margin: 0 0 5px; font-size: 16px; color: #a5b4fc;">🎯 Full Pitch Session</h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Complete pitch practice with comprehensive AI analysis and recommendations</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 15px; background-color: #334155; border-radius: 8px;">
                        <h3 style="margin: 0 0 5px; font-size: 16px; color: #a5b4fc;">🧠 Master Pitch Analyzer</h3>
                        <p style="margin: 0; font-size: 14px; color: #94a3b8;">Advanced analysis combining all modules for the ultimate pitch optimization</p>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding: 10px 0 30px;">
                        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://pitchperfect.ai'}"
                           style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                                  color: #ffffff; text-decoration: none; padding: 16px 40px;
                                  border-radius: 8px; font-size: 16px; font-weight: 600;">
                          Start Your First Pitch Analysis
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Tips Section -->
                  <div style="background-color: #1e293b; border: 1px solid #475569; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                    <h3 style="margin: 0 0 15px; font-size: 16px; color: #fbbf24;">💡 Quick Start Tips</h3>
                    <ul style="margin: 0; padding-left: 20px; color: #cbd5e1; font-size: 14px; line-height: 1.8;">
                      <li>Start with the Pitch Deck Analyser to get baseline feedback</li>
                      <li>Use Script Check to refine your narrative before practicing</li>
                      <li>Try Elevator Live for quick, iterative practice sessions</li>
                      <li>Graduate to Full Pitch Session when you're ready for the real deal</li>
                    </ul>
                  </div>
                </td>
              </tr>

              <!-- Contact Section -->
              <tr>
                <td style="padding: 30px 40px; background-color: #0f172a; border-top: 1px solid #334155;">
                  <p style="margin: 0 0 15px; font-size: 14px; color: #94a3b8;">
                    Questions? We're here to help!
                  </p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding-right: 20px;">
                        <a href="mailto:sherwyn@automagikal.co.za" style="color: #a5b4fc; text-decoration: none; font-size: 14px;">
                          📧 sherwyn@automagikal.co.za
                        </a>
                      </td>
                      <td>
                        <a href="https://x.com/sherwynsingh" style="color: #a5b4fc; text-decoration: none; font-size: 14px;">
                          🐦 @sherwynsingh
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px; background-color: #0f172a; text-align: center; border-top: 1px solid #1e293b;">
                  <p style="margin: 0; font-size: 12px; color: #64748b;">
                    Built by <a href="https://automagikal.co.za/" style="color: #a5b4fc; text-decoration: none;">AutomagiKal</a>
                  </p>
                  <p style="margin: 10px 0 0; font-size: 12px; color: #475569;">
                    © ${new Date().getFullYear()} Pitch Perfect. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  try {
    const { data, error } = await getResend().emails.send({
      from: 'Pitch Perfect <noreply@pitchperfect.ai>',
      to: email,
      subject: '🎤 Welcome to Pitch Perfect - Your AI Pitch Coach Awaits!',
      html,
    });

    if (error) {
      console.error('Failed to send welcome email:', error);
      return { success: false, error };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return { success: false, error };
  }
}
