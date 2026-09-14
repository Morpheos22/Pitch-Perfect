/**
 * Job Queue Helper — creates + updates Job records for AI analysis tasks.
 *
 * This is the "DB job record" half of the queue. The actual queue
 * transport (QStash, BullMQ, or synchronous in-request processing) is
 * pluggable — this module only manages the database state.
 *
 * Current usage pattern (synchronous):
 *   const job = await createJob({ userId, type: "DECK_ANALYSIS", payload });
 *   await markJobProcessing(job.id);
 *   try {
 *     const result = await doAnalysis(payload);
 *     await markJobCompleted(job.id, result);
 *   } catch (err) {
 *     await markJobFailed(job.id, err);
 *   }
 *
 * Future usage pattern (async queue):
 *   const job = await createJob({ userId, type: "DECK_ANALYSIS", payload });
 *   await qstash.publish({ url: "/api/worker/process-job", body: { jobId: job.id } });
 *   // Worker picks it up, calls markJobProcessing → markJobCompleted/Failed.
 */

import { prisma } from "@/lib/db";
import type { JobType, JobStatus } from "@prisma/client";

export interface CreateJobInput {
  userId: string;
  type: JobType;
  sessionType?: string;
  sessionId?: string;
  payload?: unknown;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export async function createJob(input: CreateJobInput) {
  return prisma.job.create({
    data: {
      userId: input.userId,
      type: input.type,
      sessionType: input.sessionType,
      sessionId: input.sessionId,
      payload: input.payload as any,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: input.maxAttempts ?? 3,
      status: "PENDING",
    },
  });
}

export async function markJobProcessing(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });
}

export async function markJobCompleted(jobId: string, result?: unknown) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "COMPLETED",
      finishedAt: new Date(),
      result: result as any,
      lastError: null,
    },
  });
}

export async function markJobFailed(jobId: string, error: unknown) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { attempts: true, maxAttempts: true, errorHistory: true },
  });

  if (!job) return;

  const newErrorEntry = {
    attempt: job.attempts,
    error: errorMessage.slice(0, 1000),
    at: new Date().toISOString(),
  };

  const errorHistory = Array.isArray(job.errorHistory)
    ? [...job.errorHistory, newErrorEntry]
    : [newErrorEntry];

  // If we've exhausted retries, move to dead-letter
  const shouldDeadLetter = job.attempts >= job.maxAttempts;

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: shouldDeadLetter ? "DEAD_LETTER" : "FAILED",
      finishedAt: shouldDeadLetter ? new Date() : null,
      deadLetterAt: shouldDeadLetter ? new Date() : null,
      lastError: errorMessage.slice(0, 1000),
      lastErrorAt: new Date(),
      errorHistory: errorHistory as any,
    },
  });
}

export async function markJobCancelled(jobId: string) {
  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "CANCELLED",
      finishedAt: new Date(),
    },
  });
}

/**
 * Retry a dead-lettered job by resetting its attempts and status.
 * Used by the admin dashboard's "retry failed jobs" button.
 */
export async function retryDeadLetteredJob(jobId: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job || job.status !== "DEAD_LETTER") {
    throw new Error("Job is not in dead-letter state");
  }

  return prisma.job.update({
    where: { id: jobId },
    data: {
      status: "PENDING",
      attempts: 0,
      startedAt: null,
      finishedAt: null,
      deadLetterAt: null,
      lastError: null,
      lastErrorAt: null,
    },
  });
}

/**
 * List dead-lettered jobs for the admin dashboard.
 */
export async function listDeadLetteredJobs(limit = 50) {
  return prisma.job.findMany({
    where: { status: "DEAD_LETTER" },
    orderBy: { deadLetterAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      userId: true,
      attempts: true,
      maxAttempts: true,
      lastError: true,
      deadLetterAt: true,
      sessionType: true,
      sessionId: true,
    },
  });
}

/**
 * Check if a job with the given idempotency key already exists.
 * Used to prevent duplicate job creation on double-click.
 */
export async function findJobByIdempotencyKey(idempotencyKey: string) {
  return prisma.job.findUnique({
    where: { idempotencyKey },
  });
}

/**
 * Generate an idempotency key from user + type + payload hash.
 * Two identical requests from the same user within a short window
 * get the same key, preventing duplicate AI calls.
 */
export function generateIdempotencyKey(
  userId: string,
  type: JobType,
  payload: unknown,
): string {
  const payloadStr = JSON.stringify(payload ?? {});
  return `${userId}:${type}:${payloadStr.slice(0, 200)}`;
}
