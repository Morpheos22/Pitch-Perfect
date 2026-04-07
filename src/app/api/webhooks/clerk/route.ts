import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email";
import { syncUserToCRM } from "@/lib/zoho-crm";

// Clerk webhook events we handle
// - user.created: Create user record
// - user.updated: Update user record, detect email verification, trigger welcome email

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses: Array<{
      id: string;
      email_address: string;
      verification?: {
        status: string;
      };
    }>;
    primary_email_address_id?: string;
    first_name?: string;
    last_name?: string;
    image_url?: string;
    public_metadata?: Record<string, unknown>;
  };
  object: string;
}

export async function POST(req: NextRequest) {
  // Verify webhook signature
  if (!WEBHOOK_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const wh = new Webhook(WEBHOOK_SECRET);

  let event: ClerkWebhookEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  const { type, data } = event;

  try {
    switch (type) {
      case "user.created":
        await handleUserCreated(data);
        break;

      case "user.updated":
        await handleUserUpdated(data);
        break;

      default:
        // Unhandled event — silently ignore
    }

    return NextResponse.json({ success: true, type });
  } catch (error) {
    console.error(`Error handling webhook ${type}:`, error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleUserCreated(data: ClerkWebhookEvent["data"]) {
  const email = data.email_addresses[0]?.email_address;
  if (!email) return;

  // Check if user already exists (idempotency)
  const existingUser = await prisma.user.findUnique({
    where: { clerkId: data.id },
  });

  if (existingUser) return;

  // Developer emails for full access (configurable via env var)
  const DEVELOPER_EMAILS = (process.env.DEVELOPER_EMAILS || 'helloautomagikal@gmail.com,morphylee22@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  const isDeveloper = DEVELOPER_EMAILS.includes(email.toLowerCase());

  // Check if email is already verified
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  const emailVerified = primaryEmail?.verification?.status === 'verified';

  // Create user
  const user = await prisma.user.create({
    data: {
      clerkId: data.id,
      email,
      firstName: data.first_name,
      lastName: data.last_name,
      avatarUrl: data.image_url,
      emailVerified,
    },
  });

  // Create subscription
  await prisma.subscription.create({
    data: {
      userId: user.id,
      plan: isDeveloper ? 'ENTERPRISE' : 'FREE',
      status: 'ACTIVE',
    },
  });

  // Create usage record
  await prisma.usage.create({
    data: { userId: user.id },
  });

  // Sync to Zoho CRM (fire-and-forget — non-blocking)
  syncUserToCRM({
    email,
    firstName: data.first_name || undefined,
    lastName: data.last_name || undefined,
    country: data.public_metadata?.country as string || undefined,
    clerkId: data.id,
  }).catch((crmErr) => {
    console.warn(`CRM sync failed for ${email}:`, crmErr instanceof Error ? crmErr.message : crmErr);
  });

  // If email is already verified (e.g., Google SSO), trigger welcome email
  if (emailVerified) {
    await sendWelcomeEmail({ email, firstName: data.first_name });
  }
}

async function handleUserUpdated(data: ClerkWebhookEvent["data"]) {
  const email = data.email_addresses[0]?.email_address;
  if (!email) return;

  // Get existing user to compare email verification status
  const existingUser = await prisma.user.findUnique({
    where: { clerkId: data.id },
  });

  // Check email verification status
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  const emailVerified = primaryEmail?.verification?.status === 'verified';

  // Detect if email was just verified
  const wasJustVerified = existingUser &&
    !existingUser.emailVerified &&
    emailVerified;

  // Update user
  await prisma.user.update({
    where: { clerkId: data.id },
    data: {
      email,
      firstName: data.first_name,
      lastName: data.last_name,
      avatarUrl: data.image_url,
      emailVerified,
      onboardingCompleted: data.public_metadata?.onboardingCompleted === true,
      country: data.public_metadata?.country as string || undefined,
      primaryUseCase: data.public_metadata?.primaryUseCase as string || undefined,
    },
  });

  // If email was just verified, trigger welcome email
  if (wasJustVerified) {
    await sendWelcomeEmail({ email, firstName: data.first_name });
  }
}
