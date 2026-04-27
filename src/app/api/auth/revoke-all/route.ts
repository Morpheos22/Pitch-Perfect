import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createLogger } from "@/lib/logger";

const logger = createLogger("revoke-all");

/**
 * POST /api/auth/revoke-all
 *
 * Revokes ALL active Clerk sessions for ALL users.
 * Admin-only endpoint — only developer emails can trigger it.
 * Used for emergency logout (e.g., security incident, stale sessions).
 *
 * Rate limited via middleware (auth tier: 5 req/min).
 */
async function handler(request: NextRequest) {
  // Auth check — must be signed in
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check — only developer emails can revoke all sessions
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const email = user.emailAddresses[0]?.emailAddress;

  const developerEmails = (process.env.DEVELOPER_EMAILS || "")
    .split(",")
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !developerEmails.includes(email.toLowerCase())) {
    return NextResponse.json(
      { error: "Forbidden — admin access required" },
      { status: 403 }
    );
  }

  try {
    // Get all users and revoke their sessions
    const users = await client.users.getUserList({ limit: 100 });
    let revokedCount = 0;

    for (const u of users.data) {
      try {
        // Revoke all sessions for this user
        const sessions = await client.sessions.getSessionList({ userId: u.id, status: "active" });
        for (const session of sessions.data) {
          await client.sessions.revokeSession(session.id);
        }
        revokedCount++;
      } catch {
        // Individual user session revocation failure — continue
      }
    }

    logger.info(`Revoked sessions for ${revokedCount} of ${users.data.length} users`);

    return NextResponse.json({
      success: true,
      message: `Revoked sessions for ${revokedCount} users`,
      userCount: users.data.length,
    });
  } catch (error) {
    logger.error("Error revoking sessions:", error);
    return NextResponse.json(
      { error: "Failed to revoke sessions" },
      { status: 500 }
    );
  }
}

export const POST = handler;
