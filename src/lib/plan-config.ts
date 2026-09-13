// src/lib/plan-config.ts
// Shared plan configuration constants used across the dashboard.
//
// Previously, PLAN_LIMITS was duplicated in 4+ files and formatPlanName/getScoreColor
// were duplicated in 3+ files. This module is the single source of truth for all
// plan-related configuration used in the frontend.

// ═══════════════════════════════════════════════════════════════════════════
// PLAN LIMITS — per-module session limits by plan tier
// ═══════════════════════════════════════════════════════════════════════════

export interface PlanModuleLimits {
  e1: number; // Pitch Deck Analyser
  e2: number; // Elevator Script Coach
  e3: number; // Live Elevator Pitch
  e4: number; // Full Pitch Session
  e5: number; // Founder Coaching
}

export const PLAN_LIMITS: Record<string, PlanModuleLimits> = {
  JJC: { e1: 2, e2: 2, e3: 0, e4: 0, e5: 0 },
  NEWBIE: { e1: 10, e2: 10, e3: 0, e4: 0, e5: 0 },
  COFOUNDER: { e1: 25, e2: 25, e3: 5, e4: 1, e5: 3 },
  FOUNDER: { e1: 999, e2: 999, e3: 999, e4: 5, e5: 999 },
  // Legacy aliases for backward compatibility with existing DB rows
  FREE: { e1: 2, e2: 2, e3: 0, e4: 0, e5: 0 },
  STARTER: { e1: 10, e2: 10, e3: 0, e4: 0, e5: 0 },
  PROFESSIONAL: { e1: 25, e2: 25, e3: 5, e4: 1, e5: 3 },
  ENTERPRISE: { e1: 999, e2: 999, e3: 999, e4: 5, e5: 999 },
};

// Convenience: per-module subsets (for pages that only need one module)
export const E1_PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([plan, limits]) => [plan, limits.e1])
);
export const E2_PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([plan, limits]) => [plan, limits.e2])
);
export const E3_PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([plan, limits]) => [plan, limits.e3])
);
export const E4_PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([plan, limits]) => [plan, limits.e4])
);
export const E5_PLAN_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(PLAN_LIMITS).map(([plan, limits]) => [plan, limits.e5])
);

// ═══════════════════════════════════════════════════════════════════════════
// PLAN NAME FORMATTING
// ═══════════════════════════════════════════════════════════════════════════

export function formatPlanName(plan: string): string {
  const names: Record<string, string> = {
    JJC: "JJC",
    NEWBIE: "Newbie",
    COFOUNDER: "Cofounder",
    FOUNDER: "Founder",
    // Legacy aliases
    FREE: "JJC",
    STARTER: "Newbie",
    PROFESSIONAL: "Cofounder",
    ENTERPRISE: "Founder",
  };
  return names[plan] || plan;
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORE COLOR — consistent color classes for score display
// ═══════════════════════════════════════════════════════════════════════════

export function getScoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 70) return "text-emerald-500";
  if (score >= 50) return "text-amber-500";
  return "text-destructive";
}

export function getScoreBgClass(score: number | null): string {
  if (score == null) return "bg-muted";
  if (score >= 70) return "bg-emerald-500/10";
  if (score >= 50) return "bg-amber-500/10";
  return "bg-destructive/10";
}
