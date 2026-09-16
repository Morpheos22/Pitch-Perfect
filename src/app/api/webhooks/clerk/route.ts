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

const ATHENA_WARMUP_TTL_MS = 60_000;
const athenaWarmups = new Map<string, number>();

function shouldWarmup(clerkUserId: string): boolean {
  if (!clerkUserId) return false;
  const now = Date.now();
  for (const [id, timestamp] of athenaWarmups) {
    if (now - timestamp >= ATHENA_WARMUP_TTL_MS) athenaWarmups.delete(id);
  }
  const previous = athenaWarmups.get(clerkUserId);
  if (previous !== undefined && now - previous < ATHENA_WARMUP_TTL_MS) return false;
  athenaWarmups.set(clerkUserId, now);
  return true;
}


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
    user_id?: string;
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
    }) as unknown as ClerkWebhookEvent;
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

      case "session.created":
        const clerkUserId = data.user_id || data.id;
        if (shouldWarmup(clerkUserId)) {
          await fireAthenaWarmup(clerkUserId, data.email_addresses?.[0]?.email_address || "");
        }
        break;

      default:
        // Unhandled event â silently ignore
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

  // ââ Subdomain/Disposable email check ââ
  // BUG FIX: Previously, isBlockedEmail() returned early WITHOUT creating any DB record.
  // This left a "zombie user" â the user exists in Clerk but has no DB row, causing
  // errors on all authenticated pages (middleware finds no subscription/usage).
  // Fix: Instead of silently returning, we still create the user + subscription + usage,
  // but mark the account as blocked via onboardingCompleted=false and skip CRM sync.
  // The user will be stuck at onboarding and can be deleted from Clerk Dashboard.
  const blocked = isBlockedEmail(email);
  if (blocked) {
    console.warn(`[Clerk Webhook] Blocked user with subdomain/disposable email: ${email}`);
    // Don't return â continue to create DB record so the user isn't a zombie.
  }

  // ââ Idempotency: check by clerkId FIRST, then by email ââ
  // BUG FIX: Previously only checked clerkId. If a user was deleted from the DB
  // (e.g., manual cleanup) but re-signed-up with the same email, the clerkId would
  // be different but the email unique constraint would cause a Prisma error.
  // Fix: Check both clerkId and email; upsert by email if clerkId not found.
  const existingByClerkId = await prisma.user.findUnique({
    where: { clerkId: data.id },
  });

  if (existingByClerkId) return; // Already exists â idempotent

  const existingByEmail = await prisma.user.findUnique({
    where: { email },
  });

  if (existingByEmail) {
    // User re-signed-up with same email but new clerkId â update the clerkId
    console.log(`[Clerk Webhook] Re-signup detected: updating clerkId for ${email}`);
    await prisma.user.update({
      where: { email },
      data: { clerkId: data.id },
    });
    // Ensure subscription + usage exist
    await prisma.$transaction([
      prisma.subscription.upsert({
        where: { userId: existingByEmail.id },
        create: { userId: existingByEmail.id },
        update: {},
      }),
      prisma.usage.upsert({
        where: { userId: existingByEmail.id },
        create: { userId: existingByEmail.id },
        update: {},
      }),
    ]);
    return;
  }

  // Check if developer email (single source of truth in dev-auth.ts)
  const isDeveloper = isAdminEmail(email);

  // Check if email is already verified
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  const emailVerified = primaryEmail?.verification?.status === 'verified';

  // ââ Create user + subscription + usage in a single transaction ââ
  // BUG FIX: Previously, subscription.create() was a separate call after user.create().
  // If the onboarding API ran concurrently (race condition), both would try to create
  // a subscription for the same userId, hitting the unique constraint and crashing one.
  // Fix: Use a $transaction with upsert for subscription and usage â safe to run in parallel.
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

  await prisma.$transaction([
    prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        // PERMANENT_FOUNDER_EMAILS + DEVELOPER_EMAILS â FOUNDER tier.
        // This fires on user.created â morphylee22@gmail.com gets
        // FOUNDER at signup, before the first page load.
        plan: isDeveloper ? 'FOUNDER' : 'FREE',
        status: 'ACTIVE',
      },
      update: {}, // no-op if already exists from onboarding race
    }),
    prisma.usage.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {}, // no-op if already exists
    }),
  ]);

  // Sync to CRM â bare lead (no country/useCase yet)
  // Skip CRM sync for blocked emails â no point creating a lead for a spammer.
  if (!blocked) {
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

  // ââ Send welcome email via Supabase SMTP ââ
  // Primary: Nodemailer SMTP (Supabase SMTP, from hello@pitchcoachai.tech)
  // Fallback: Cloudflare Email Routing (hello@pitchcoachai.tech â Metron@Athenagentic.app)
  // If SMTP fails, Cloudflare Email Routing ensures the user can still reach us.
  if (!blocked) {
    import("@/lib/email")
      .then(({ sendWelcomeEmail }) => {
        return sendWelcomeEmail(email, data.first_name || undefined);
      })
      .then(() => {
        console.log(`[Clerk Webhook] Welcome email sent to ${email}`);
      })
      .catch((emailErr) => {
        console.warn(`[Clerk Webhook] Welcome email failed for ${email}:`, emailErr instanceof Error ? emailErr.message : emailErr);
      });
  }
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


  // ââ Email verification trigger ââââââââââââââââââââââââââââââââââââââââââ
  // When the user's email transitions from unverified â verified, send a
  // confirmation email. This is separate from the welcome email (which
  // fires on user.created) and the onboarding email (which fires when
  // onboarding completes).
  const emailJustVerified = emailVerified
    && existingUser
    && !existingUser.emailVerified;

  if (emailJustVerified) {
    import("@/lib/email")
      .then(({ sendEmailVerifiedConfirmation }) => {
        return sendEmailVerifiedConfirmation(email, data.first_name || undefined);
      })
      .then(() => {
        console.log(`[Clerk Webhook] Email verification confirmation sent to ${email}`);
      })
      .catch((emailErr) => {
        console.warn(`[Clerk Webhook] Email verification confirmation failed for ${email}:`, emailErr instanceof Error ? emailErr.message : emailErr);
      });
  }


  // ââ CRM onboarding completion + welcome email ââ
  // When onboarding data (country, primaryUseCase) appears in public_metadata,
  // update the CRM lead with the complete profile AND send the welcome email
  // via Zoho CRM's SendMail API. This handles the case where the onboarding
  // API's fire-and-forget CRM call fails â the Clerk metadata update triggers
  // this user.updated webhook as a reliable retry.
  const onboardingJustCompleted = data.public_metadata?.onboardingCompleted === true
    && existingUser && !existingUser.onboardingCompleted;

  if (onboardingJustCompleted) {
    const country = data.public_metadata?.country as string || undefined;
    const primaryUseCase = data.public_metadata?.primaryUseCase as string || undefined;
    const firstName = data.first_name || undefined;

    // ââ Send onboarding welcome email via Supabase SMTP ââ
    // Primary: Nodemailer SMTP (Supabase SMTP)
    // Fallback: Cloudflare Email Routing (hello@pitchcoachai.tech forwards to Metron@Athenagentic.app)
    import("@/lib/email")
      .then(({ sendOnboardingEmail }) => {
        return sendOnboardingEmail(email, { firstName, plan: primaryUseCase });
      })
      .then(() => {
        console.log(`[Clerk Webhook] Onboarding email sent to ${email}`);
      })
      .catch((emailErr) => {
        console.warn(`[Clerk Webhook] Email send failed for ${email}:`, emailErr instanceof Error ? emailErr.message : emailErr);
        // Fallback: Cloudflare Email Routing is always active â
        // if SMTP fails, the user can still email hello@pitchcoachai.tech
        // and it will forward to Metron@Athenagentic.app via Cloudflare
      });

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

// ââ Athena warm-up ping âââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Fires the moment Clerk registers auth (user.created or session.created).
// Syncs Supabase + pokes Poke API + pre-warms MCP DurableObject.
// Fire-and-forget â max 3s, never blocks the webhook response.
async function fireAthenaWarmup(clerkId: string, email: string) {
  const tasks: Promise<void>[] = [];

  // 0. Mark AI service as 'warming' in DB (prevents session dehydration)
  tasks.push(
    (async () => {
      try {
        const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
        if (user) {
          await prisma.$executeRaw`
            INSERT INTO public.ai_service_health ("userId", "clerkId", status, "warmedAt", "lastPingAt")
            VALUES (${user.id}, ${clerkId}, 'warming', now(), now())
            ON CONFLICT ("userId") DO UPDATE
            SET status = 'warming', "warmedAt" = now(), "lastPingAt" = now(), "updatedAt" = now()
          `;
        }
      } catch (e) { /* non-fatal — DB trigger handles it */ }
    })(),
  );

  // 1. Hit the preload endpoint (primes the route + Poke bridge)
  tasks.push(
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://pitchcoachai.tech"}/api/athena/preload`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.ATHENA_SECRET_KEY || ""}` },
    }).then(() => {}).catch(() => {}),
  );

  // 2. Ping Poke API — warm up agent context
  const POKE_API_KEY = process.env.POKE_API_KEY;
  let pokeWarmed = false;
  if (POKE_API_KEY && email) {
    tasks.push(
      fetch("https://poke.com/api/v1/inbound/api-message", {
        method: "POST",
        headers: { "Authorization": `Bearer ${POKE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `System: User ${email} just authenticated on PitchCoach Ai. Warm up your context. Use db_query tool for their Supabase data.`,
        }),
      }).then(() => { pokeWarmed = true; }).catch(() => {}),
    );
  }

  // 3. Pre-warm the MCP DurableObject + capture session ID
  let mcpSessionId: string | null = null;
  tasks.push(
    fetch("https://athena-mcp-server.morphylee22.workers.dev/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "initialize", params: { protocolVersion: "2025-01-01", capabilities: {}, clientInfo: { name: "warmup", version: "1.0" } }, id: 1 }),
    }).then(async (res) => {
      mcpSessionId = res.headers.get("mcp-session-id");
    }).catch(() => {}),
  );

  await Promise.race([
    Promise.allSettled(tasks),
    new Promise(resolve => setTimeout(resolve, 5000)),
  ]);

  // 4. Mark Athena as 'warm' in the DB
  try {
    const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (user) {
      await prisma.$executeRaw`SELECT public.mark_athena_warm(${user.id}, ${mcpSessionId}, ${pokeWarmed})`;
    }
  } catch (e) { /* non-fatal */ }

  console.log(`[Clerk Webhook] Athena warm-up complete for ${email || clerkId} (mcp=${!!mcpSessionId}, poke=${pokeWarmed})`);
}
