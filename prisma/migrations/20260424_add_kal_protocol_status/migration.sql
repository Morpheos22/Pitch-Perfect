-- Add KAL_PENDING and KAL_FAILED to AnalysisStatus enum
-- These support the Kal Protocol graceful degradation system

ALTER TYPE "AnalysisStatus" ADD VALUE IF NOT EXISTS 'KAL_PENDING';
ALTER TYPE "AnalysisStatus" ADD VALUE IF NOT EXISTS 'KAL_FAILED';
