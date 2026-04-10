// Database Operations
// Helper functions for user management with Clerk authentication

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * Get the current authenticated user from Clerk, or create them in the database if they don't exist.
 * Throws an Error with message 'Unauthorized' if no user is authenticated.
 */
export async function getOrCreateUser() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw new Error('Unauthorized');
  }

  let user = await prisma.user.findUnique({
    where: { clerkId },
  });

  if (!user) {
    // Get Clerk user details for creation
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkId);

    const email = clerkUser.emailAddresses.find(
      (e: any) => e.verification?.status === 'verified'
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress || '';
    const firstName = clerkUser.firstName || '';
    const lastName = clerkUser.lastName || '';

    user = await prisma.user.create({
      data: {
        clerkId,
        email,
        firstName,
        lastName,
      },
    });
  }

  return user;
}
