/**
 * Email Service — PitchCoach Ai
 *
 * Uses Nodemailer with Supabase SMTP for transactional email.
 * Supabase provides an SMTP relay for custom domain email.
 *
 * Env vars required:
 *   - SMTP_HOST (smtp.supabase.com)
 *   - SMTP_PORT (587 for TLS)
 *   - SMTP_USER (Supabase SMTP username)
 *   - SMTP_PASS (Supabase SMTP password)
 *   - SMTP_FROM_EMAIL (sender address, e.g., hello@pitchcoachai.tech)
 *   - SMTP_FROM_NAME (sender name, e.g., "PitchCoach Ai")
 *
 * All functions are no-ops if SMTP is not configured.
 */

import nodemailer, { type Transporter } from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || "noreply@pitchcoachai.tech";
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || "PitchCoach Ai";

let _transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (_transporter) return _transporter;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  _transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return _transporter;
}

export function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

export interface EmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
}

export async function sendEmail(opts: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn("[email] SMTP not configured — email not sent to", opts.to);
    return { success: false, error: "SMTP not configured" };
  }

  try {
    const info = await transporter.sendMail({
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] Failed to send email:", err);
    return { success: false, error: String(err).slice(0, 200) };
  }
}

// ── Templated emails ─────────────────────────────────────────────────────

export async function sendWelcomeEmail(email: string, firstName?: string): Promise<void> {
  const name = firstName || "there";
  await sendEmail({
    to: email,
    subject: "Welcome to PitchCoach Ai — Let's Master Your Pitch",
    html: `
      <div style="font-family: 'Nunito Sans', sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B12; color: #F8FAFC; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #A78BFA; font-size: 28px; margin: 0;">Pitch<span style="color: #7C3AED;">Coach</span> Ai</h1>
        </div>
        <h2 style="color: #F8FAFC;">Welcome, ${name}!</h2>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 16px;">
          You're officially part of PitchCoach Ai — the AI-powered pitch coaching platform
          built for founders, by founders. Whether you're preparing for a seed round,
          a demo day, or your first investor meeting, we're here to help you put your
          best foot forward.
        </p>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 16px;">
          <strong style="color: #A78BFA;">What is PitchCoach Ai?</strong><br/>
          We use cutting-edge AI (Cloudflare Workers AI — Llama models) to analyze your
          pitch deck, elevator script, and live delivery. You get instant, actionable
          feedback with scores across multiple dimensions — content clarity, visual design,
          delivery effectiveness, and investor readiness.
        </p>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 16px;">
          <strong style="color: #A78BFA;">What you can do:</strong>
        </p>
        <ul style="color: #9CA3AF; line-height: 1.8; font-size: 15px;">
          <li>Upload your pitch deck for AI-powered analysis and scoring</li>
          <li>Submit your elevator pitch script for element-by-element feedback</li>
          <li>Record a live pitch video and get delivery + body language analysis</li>
          <li>Get a full 30-minute pitch session analyzed for investor readiness</li>
          <li>Access founder coaching — pathway recommendations, investor research, and cohort matching</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://pitchcoachai.tech/dashboard" style="background: #7C3AED; color: #FFFFFF; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Go to Your Dashboard
          </a>
        </div>
        <p style="color: #9CA3AF; line-height: 1.6; font-size: 15px;">
          Complete your onboarding to unlock personalized coaching tailored to your
          startup stage, industry, and goals. The more we know about you, the better
          our AI can help.
        </p>
        <p style="color: #6B7280; font-size: 13px; margin-top: 40px; border-top: 1px solid #2D2D44; padding-top: 20px;">
          PitchCoach Ai — Built by Athena Agentic<br/>
          Abuja, Nigeria<br/>
          <a href="mailto:Metron@Athenagentic.app" style="color: #A78BFA;">Metron@Athenagentic.app</a>
        </p>
      </div>
    `,
    text: `Welcome to PitchCoach Ai, ${name}!\n\nYou're officially part of the AI-powered pitch coaching platform built for founders. We use cutting-edge AI to analyze your pitch deck, script, and live delivery with instant, actionable feedback.\n\nWhat you can do:\n- Upload your pitch deck for AI analysis and scoring\n- Submit your elevator script for feedback\n- Record a live pitch for delivery analysis\n- Get full 30-minute pitch session analyzed for investor readiness\n- Access founder coaching modules\n\nVisit https://pitchcoachai.tech/dashboard to get started.\n\nPitchCoach Ai — Built by Athena Agentic\nAbuja, Nigeria\nMetron@Athenagentic.app`,
  });
}

export async function sendOnboardingEmail(email: string, data?: { firstName?: string; plan?: string }): Promise<void> {
  const name = data?.firstName || "there";
  await sendEmail({
    to: email,
    subject: "Your PitchCoach Ai onboarding is complete",
    html: `
      <div style="font-family: 'Nunito Sans', sans-serif; max-width: 600px; margin: 0 auto; background: #0B0B12; color: #F8FAFC; padding: 40px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #A78BFA; font-size: 28px; margin: 0;">Pitch<span style="color: #7C3AED;">Coach</span> Ai</h1>
        </div>
        <h2 style="color: #F8FAFC;">You're ready to start, ${name}!</h2>
        <p style="color: #9CA3AF; line-height: 1.6;">
          Your onboarding is complete. You now have access to all coaching modules:
        </p>
        <ul style="color: #9CA3AF; line-height: 1.8;">
          <li>Pitch Deck Analyser — AI-powered deck analysis</li>
          <li>Script Check — Elevator pitch script coaching</li>
          <li>Live Pitch — Video delivery analysis</li>
          <li>Full Pitch Session — 30-min investor readiness</li>
          <li>Founder Coaching — Conversion layer</li>
        </ul>
        <div style="text-align: center; margin: 30px 0;">
          <a href="https://pitchcoachai.tech/dashboard" style="background: #7C3AED; color: #FFFFFF; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            Start Coaching
          </a>
        </div>
        <p style="color: #6B7280; font-size: 12px; margin-top: 40px;">
          PitchCoach Ai — Developed by Athena Agentic
        </p>
      </div>
    `,
    text: `Hi ${name}, your onboarding is complete. Visit https://pitchcoachai.tech/dashboard to start coaching.`,
  });
}

export async function sendContactNotification(data: { name: string; email: string; message: string }): Promise<void> {
  await sendEmail({
    to: "Metron@Athenagentic.app",
    subject: `New contact form submission from ${data.name}`,
    replyTo: data.email,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Message:</strong></p>
        <p style="background: #f4f5f7; padding: 15px; border-radius: 8px;">${data.message}</p>
      </div>
    `,
    text: `Name: ${data.name}\nEmail: ${data.email}\nMessage: ${data.message}`,
  });
}
