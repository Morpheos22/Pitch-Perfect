// Shared Zod Validation Schemas for PitchCoach Ai API Routes
// Centralises input validation to prevent malformed/malicious payloads.

import { z } from 'zod';

// ── Common ──

export const sessionIdSchema = z.object({
  id: z.string().min(1).max(100),
});

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

// ── E1: Pitch Deck Analyser ──

export const deckIterateSchema = z.object({
  id: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
  feedback: z.string().max(5000).optional(),
  focusArea: z.string().max(200).optional(),
});

// ── E2: Script Coach ──

export const scriptInputSchema = z.object({
  content: z.string().min(20).max(50000).optional(),
  inputType: z.enum(['text', 'pdf', 'docx']).optional(),
  targetAudience: z.string().max(100).optional(),
  pitchDuration: z.coerce.number().int().min(10).max(600).optional(),
  sessionName: z.string().max(200).optional(),
});

export const scriptIterateSchema = z.object({
  id: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
  feedback: z.string().max(5000).optional(),
  focusElement: z.string().max(200).optional(),
  // New file upload fields (Blob URL flow)
  script: z.string().max(50000).optional(),      // Revised script text
  fileUrl: z.string().url().max(2000).optional(), // Blob URL for uploaded file
  fileName: z.string().max(500).optional(),        // Original file name
});

// ── E3: Live Pitch ──

export const liveNotesSchema = z.object({
  id: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
});

// ── E4: Full Pitch Session ──

export const fullPitchIterateSchema = z.object({
  id: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
  feedback: z.string().max(5000).optional(),
  focusArea: z.string().max(200).optional(),
});

// ── E5: Founder ──

export const founderInputSchema = z.object({
  moduleType: z.enum([
    'FOUNDER_READINESS',
    'PATHWAY_RECOMMENDATION',
    'INVESTOR_RESEARCH',
    'COHORT_MATCHING',
    'NETWORK_PROFILE',
    'PATHWAY_NARRATION',
  ]),
  input: z.record(z.string(), z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'Input object must not be empty' }
  ),
});

// ── Drills ──

export const drillsSchema = z.object({
  sessionId: z.string().min(1).max(100),
  moduleType: z.enum(['e1', 'e2', 'e3', 'e4', 'e5']),
  drillType: z.string().max(100).optional(),
});

// ── Video ──

export const videoNotesSchema = z.object({
  id: z.string().min(1).max(100),
  notes: z.string().max(2000).optional(),
});

// ── Blob Upload ──

export const blobUploadSchema = z.object({
  fileName: z.string().min(1).max(500),
  fileType: z.string().max(200).optional(),
  category: z.enum(['deck', 'script', 'video']),
});

// ── Payment ──

export const createSessionSchema = z.object({
  productId: z.enum([
    'pitch-deck',
    'elevator-script',
    'elevator-live',
    'pitch-deck-live',
    'master',
  ]),
  provider: z.enum(['stripe', 'paystack']).optional(),
  modules: z.array(z.string().max(50)).max(10).optional(),
  successUrl: z.string().url().max(500).optional(),
  cancelUrl: z.string().url().max(500).optional(),
  country: z.string().regex(/^[A-Z]{2}$/, 'Must be a 2-letter ISO country code').optional(),
});

// ── User ──

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z.string().min(6).max(128)
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Must contain at least one number')
    .regex(/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/, 'Must contain at least one special character'),
});

export const onboardingSchema = z.object({
  country: z.string().regex(/^[A-Z]{2}$/, 'Must be a 2-letter ISO country code (e.g. NG, US, GB)').optional(),
  primaryUseCase: z.string().max(200).optional(),
  onboardingCompleted: z.boolean().optional(),
});

// ── Contact ──

export const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().max(200),
  subject: z.string().min(1).max(300),
  message: z.string().min(10).max(5000),
});

// ── Dev Tools ──

export const devSetModeSchema = z.object({
  mode: z.enum(['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE']),
});

export const devImpersonateSchema = z.object({
  email: z.string().email().max(200),
});
