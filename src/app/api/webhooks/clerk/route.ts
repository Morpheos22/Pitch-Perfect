import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import { syncUserToCRM, completeOnboardingInCRM } from "@/lib/zoho-crm";
import { isAdminEmail } from "@/lib/dev-auth";
import { isBlockedEmail } from "@/lib/clerk-config";
export const dynamic = 'force-dynamic';

// Clerk webhook events we handle
// - user.created: Create user record in Supabase, sync bare lead to Zoho CRM
// - user.updated: Update user record, detect email verification, complete CRM onboarding + send welcome email


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
  const email = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address || data.email_addresses[0]?.email_address || '';
  if (!email) return;

  // ── Subdomain/Disposable email check ──
  if (isBlockedEmail(email)) {
    console.warn(`[Clerk Webhook] Blocked user with subdomain/disposable email: ${email}`);
    return;
  }

  // Check if user already exists (idempotency)
  const existingUser = await prisma.user.findUnique({
    where: { clerkId: data.id },
  });


  if (existingUser) return;


  // Check if developer email (single source of truth in dev-auth.ts)
  const isDeveloper = isAdminEmail(email);


  // Check if email is already verified
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  const emailVerified = primaryEmail?.verification?.status === 'verified';


  // Create user in Supabase
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


  // Create subscription (FREE plan, or ENTERPRISE for developers)
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


  // Sync to Zoho CRM — bare lead (no country/useCase yet)
  // This creates the lead in CRM so it exists before onboarding completes.
  // The welcome email will be sent AFTER onboarding completes (user.updated webhook).
  syncUserToCRM({
    email,
    firstName: data.first_name || undefined,
    lastName: data.last_name || undefined,
    country: data.public_metadata?.country as string || undefined,
    clerkId: data.id,
  }).catch((crmErr) => {
    console.warn(`[Clerk Webhook] CRM sync failed for ${email}:`, crmErr instanceof Error ? crmErr.message : crmErr);
  });
}


async function handleUserUpdated(data: ClerkWebhookEvent["data"]) {
  const email = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  )?.email_address || data.email_addresses[0]?.email_address || '';
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


  // Build update data with only non-null fields from Clerk
  const updateData: Record<string, string | boolean | undefined> = {
    email,
    emailVerified,
    onboardingCompleted: data.public_metadata?.onboardingCompleted === true,
    country: data.public_metadata?.country as string || undefined,
    primaryUseCase: data.public_metadata?.primaryUseCase as string || undefined,
  };
  if (data.first_name != null) updateData.firstName = data.first_name;
  if (data.last_name != null) updateData.lastName = data.last_name;
  if (data.image_url != null) updateData.avatarUrl = data.image_url;


  // Update user in Supabase
  await prisma.user.update({
    where: { clerkId: data.id },
    data: updateData,
  });


  // ── CRM onboarding completion + welcome email ──
  // When onboarding data (country, primaryUseCase) appears in public_metadata,
  // update the CRM lead with the complete profile AND send the welcome email
  // via Zoho CRM's SendMail API. This handles the case where the onboarding
  // API's fire-and-forget CRM call fails — the Clerk metadata update triggers
  // this user.updated webhook as a reliable retry.
  const onboardingJustCompleted = data.public_metadata?.onboardingCompleted === true
    && existingUser && !existingUser.onboardingCompleted;

  if (onboardingJustCompleted) {
    const country = data.public_metadata?.country as string || undefined;
    const primaryUseCase = data.public_metadata?.primaryUseCase as string || undefined;

    completeOnboardingInCRM({
      email,
      firstName: data.first_name || undefined,
      lastName: data.last_name || undefined,
      country,
      clerkId: data.id,
      primaryUseCase,
    }).catch((crmErr) => {
      console.warn(`[Clerk Webhook] CRM onboarding completion failed for ${email}:`, crmErr instanceof Error ? crmErr.message : crmErr);
    });
  }
}
