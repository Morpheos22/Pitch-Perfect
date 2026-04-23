import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @clerk/nextjs/server ──
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// ── Mock @/lib/db (prisma) ──
const mockFindUnique = vi.fn();
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

import { requireAuth } from '@/lib/with-auth';

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================
// requireAuth
// ============================================
describe('requireAuth', () => {
  it('returns 401 when there is no session (no clerkId)', async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const { user, error } = await requireAuth();

    expect(user).toBeNull();
    expect(error).not.toBeNull();
    // NextResponse.json produces a Response; check status
    const errorJson = await error!.json();
    expect(errorJson).toEqual({ error: 'Unauthorized' });
    expect(error!.status).toBe(401);
  });

  it('returns 404 when session exists but user is not found in database', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk-123' });
    mockFindUnique.mockResolvedValue(null);

    const { user, error } = await requireAuth();

    expect(user).toBeNull();
    expect(error).not.toBeNull();
    const errorJson = await error!.json();
    expect(errorJson).toEqual({ error: 'User not found' });
    expect(error!.status).toBe(404);
  });

  it('returns user when session and user are valid', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk-abc' });
    mockFindUnique.mockResolvedValue({ id: 'user-1', clerkId: 'clerk-abc' });

    const { user, error } = await requireAuth();

    expect(error).toBeNull();
    expect(user).toEqual({ id: 'user-1', clerkId: 'clerk-abc' });
  });

  it('passes custom select to prisma and returns requested fields', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk-select' });
    const mockUser = { id: 'user-2', email: 'test@example.com', subscription: { plan: 'STARTER' } };
    mockFindUnique.mockResolvedValue(mockUser);

    const { user, error } = await requireAuth({
      select: { id: true, email: true, subscription: { select: { plan: true } } },
    });

    expect(error).toBeNull();
    expect(user).toEqual(mockUser);
    // Verify findUnique was called with the custom select
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkId: 'clerk-select' },
        select: { id: true, email: true, subscription: { select: { plan: true } } },
      })
    );
  });
});
