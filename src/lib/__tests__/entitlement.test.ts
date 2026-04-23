import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock @/lib/dev-auth ──
const mockIsAdminEmail = vi.fn();
vi.mock('@/lib/dev-auth', () => ({
  isAdminEmail: (email: string) => mockIsAdminEmail(email),
}));

// ── Mock @/lib/db (prisma) ──
const mockUserFindUnique = vi.fn();
const mockSubscriptionUpdateMany = vi.fn();
const mockUsageUpsert = vi.fn();
const mockUsageFindUnique = vi.fn();
const mockUsageUpdateMany = vi.fn();
const mockUsageUpdate = vi.fn();
const mockUsageCreate = vi.fn();
const mockModuleAccessFindFirst = vi.fn();
const mockModuleAccessUpdateMany = vi.fn();
const mockModuleAccessUpdate = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    subscription: {
      updateMany: (...args: unknown[]) => mockSubscriptionUpdateMany(...args),
    },
    usage: {
      upsert: (...args: unknown[]) => mockUsageUpsert(...args),
      findUnique: (...args: unknown[]) => mockUsageFindUnique(...args),
      updateMany: (...args: unknown[]) => mockUsageUpdateMany(...args),
      update: (...args: unknown[]) => mockUsageUpdate(...args),
      create: (...args: unknown[]) => mockUsageCreate(...args),
    },
    moduleAccess: {
      findFirst: (...args: unknown[]) => mockModuleAccessFindFirst(...args),
      updateMany: (...args: unknown[]) => mockModuleAccessUpdateMany(...args),
      update: (...args: unknown[]) => mockModuleAccessUpdate(...args),
    },
  },
}));

import { requireModuleAccess } from '@/lib/entitlement';

beforeEach(() => {
  vi.clearAllMocks();
  // Default: non-admin
  mockIsAdminEmail.mockReturnValue(false);
});

// ============================================
// requireModuleAccess
// ============================================
describe('requireModuleAccess', () => {
  it('always grants access for admin email', async () => {
    mockIsAdminEmail.mockReturnValue(true);
    mockUserFindUnique.mockResolvedValue({
      email: 'admin@example.com',
      subscription: { plan: 'STARTER', status: 'ACTIVE', creditsRemaining: 0, currentPeriodEnd: null },
    });
    mockSubscriptionUpdateMany.mockResolvedValue({ count: 1 });

    const result = await requireModuleAccess('user-admin', 'e1');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('ENTERPRISE');
  });

  it('denies access for FREE plan (no paid subscription)', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'free@example.com',
      subscription: null,
    });

    const result = await requireModuleAccess('user-free', 'e1');

    expect(result.allowed).toBe(false);
    expect(result.plan).toBe('FREE');
  });

  it('grants access for STARTER plan within limits', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'starter@example.com',
      subscription: { plan: 'STARTER', status: 'ACTIVE', creditsRemaining: 0, currentPeriodEnd: null },
    });
    mockUsageUpsert.mockResolvedValue({});
    mockUsageFindUnique.mockResolvedValue({ month: new Date() }); // same month
    // Atomic increment succeeds (count=1 means one row was updated)
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });

    const result = await requireModuleAccess('user-starter', 'e1');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('STARTER');
  });

  it('denies access for STARTER plan at limit', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'starter-limit@example.com',
      subscription: { plan: 'STARTER', status: 'ACTIVE', creditsRemaining: 0, currentPeriodEnd: null },
    });
    mockUsageUpsert.mockResolvedValue({});
    mockUsageFindUnique.mockResolvedValue({ month: new Date() });
    // Atomic increment fails (count=0 means no row was updated — at limit)
    mockUsageUpdateMany.mockResolvedValue({ count: 0 });
    mockUsageFindUnique.mockResolvedValue({ e1DeckAnalyses: 5 }); // at STARTER limit

    const result = await requireModuleAccess('user-starter-limit', 'e1');

    expect(result.allowed).toBe(false);
    expect(result.plan).toBe('STARTER');
    expect(result.reason).toContain('limit');
  });

  it('grants access for E5 with active subscription within limits', async () => {
    mockUserFindUnique.mockResolvedValue({
      email: 'sub-e5@example.com',
      subscription: { plan: 'STARTER', status: 'ACTIVE', creditsRemaining: 0, currentPeriodEnd: null },
    });
    mockUsageUpsert.mockResolvedValue({});
    mockUsageFindUnique.mockResolvedValue({ month: new Date() });
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });

    const result = await requireModuleAccess('user-e5-sub', 'e5');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('STARTER');
  });

  it('grants access for E5 with one-time ModuleAccess e5Access=true', async () => {
    // No paid subscription → falls through to ModuleAccess check
    mockUserFindUnique.mockResolvedValue({
      email: 'e5-onetime@example.com',
      subscription: null,
    });
    // ModuleAccess found with e5Access=true and no limit
    mockModuleAccessFindFirst.mockResolvedValue({
      id: 'ma-1',
      e5Access: true,
      e5Limit: null,
      e5Used: 0,
      createdAt: new Date(),
    });
    mockModuleAccessUpdate.mockResolvedValue({ id: 'ma-1', e5Used: 1 });

    const result = await requireModuleAccess('user-e5-onetime', 'e5');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('FREE');
  });
});
