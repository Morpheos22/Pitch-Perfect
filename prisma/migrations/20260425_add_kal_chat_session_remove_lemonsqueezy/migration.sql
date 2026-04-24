-- AlterEnum: Remove LEMONSQUEEZY from PaymentProvider
-- PostgreSQL doesn't support removing enum values directly.
-- We must recreate the enum without LEMONSQUEEZY.
ALTER TYPE "PaymentProvider" RENAME TO "PaymentProvider_old";
CREATE TYPE "PaymentProvider" AS ENUM ('PAYSTACK', 'STRIPE', 'ZOHO');
ALTER TABLE "transactions" ALTER COLUMN "provider" TYPE "PaymentProvider" USING "provider"::text::"PaymentProvider";
DROP TYPE "PaymentProvider_old";

-- CreateTable: KalChatSession
CREATE TABLE "kal_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scriptSessionId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "messages" JSONB NOT NULL,
    "inputSummary" TEXT,
    "summary" TEXT,
    "quickFeedback" TEXT,
    "finalDecision" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kal_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kal_chat_sessions_userId_idx" ON "kal_chat_sessions"("userId");
CREATE INDEX "kal_chat_sessions_scriptSessionId_idx" ON "kal_chat_sessions"("scriptSessionId");
CREATE INDEX "kal_chat_sessions_status_idx" ON "kal_chat_sessions"("status");

-- AddForeignKey
ALTER TABLE "kal_chat_sessions" ADD CONSTRAINT "kal_chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
