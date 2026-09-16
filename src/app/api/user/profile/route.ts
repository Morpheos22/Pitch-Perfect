import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { syncUserToCRM } from '@/lib/zoho-crm';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { firstName, lastName, username, organization, role, socialUrl } = body;

    // Validate inputs
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      return NextResponse.json({ error: 'Invalid username format' }, { status: 400 });
    }
    if (socialUrl && !/^https?:\/\/.+/.test(socialUrl)) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Update Clerk metadata
    const client = await clerkClient();
    await client.users.updateUser(userId, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      unsafeMetadata: {
        username: username || undefined,
        organization: organization || undefined,
        role: role || undefined,
        socialUrl: socialUrl || undefined,
      },
    });

    // Update database
    await prisma.user.update({
      where: { clerkId: userId },
      data: {
        firstName: firstName || null,
        lastName: lastName || null,
      },
    });

    // Sync to Zoho CRM as a lead
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: { id: true, email: true, firstName: true, lastName: true, country: true },
    });

    if (user) {
      syncUserToCRM({
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        country: user.country || undefined,
        company: organization || undefined,
        clerkId: userId,
        username: username || undefined,
        role: role || undefined,
        socialUrl: socialUrl || undefined,
      }).catch((crmErr) => {
        console.warn('[Profile] CRM sync failed:', crmErr instanceof Error ? crmErr.message : crmErr);
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
