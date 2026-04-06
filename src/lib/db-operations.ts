// Database Operations for Pitch Perfect × Automagikal
// Only contains functions actively used by API routes

import { prisma } from './db';
import { auth } from '@clerk/nextjs/server';

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('Unauthorized');
  }

  // Get user from database by clerkId
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
    include: {
      subscription: true,
      usage: true,
    },
  });

  // If user doesn't exist, we need to create them
  // This should normally be handled by the /api/user/sync webhook
  if (!user) {
    throw new Error('User not found in database. Please sync user first.');
  }

  return user;
}
