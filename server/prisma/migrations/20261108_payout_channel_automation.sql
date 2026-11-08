-- ============================================================================
-- SUPERTOM PAYOUT CHANNEL AUTOMATION MIGRATION SCRIPT
-- Destination: Supabase PostgreSQL
-- ============================================================================

-- 1. Payout Channel Configuration Table
CREATE TABLE IF NOT EXISTS "PayoutChannelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "referenceChannel" TEXT DEFAULT '@ReferencePayoutChannel',
    "destinationChannel" TEXT NOT NULL DEFAULT '@SuperTomPayouts',
    "referenceStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "destinationStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "publishingMode" TEXT NOT NULL DEFAULT 'MANUAL_APPROVAL',
    "activeTemplateId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastPublishedAt" TIMESTAMP(3),
    "lastPublishedTxHash" TEXT,
    "lastPublishedAmount" DECIMAL(18, 4),
    "failedAttemptsCount" INTEGER NOT NULL DEFAULT 0,
    "totalPublishedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Payout Message Templates Table
CREATE TABLE IF NOT EXISTS "PayoutMessageTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "heading" TEXT NOT NULL DEFAULT '✅ SuperTom Withdrawal Complete',
    "successMessage" TEXT NOT NULL DEFAULT 'Payment successfully sent to user on-chain!',
    "footer" TEXT NOT NULL DEFAULT '🐱 Thank you for mining with SuperTom! Join @SuperTomCare for support.',
    "emojis" TEXT NOT NULL DEFAULT '💎,💰,🚀,🐱,✅,🔗',
    "currencyDisplay" TEXT NOT NULL DEFAULT 'USDT',
    "showUsd" BOOLEAN NOT NULL DEFAULT true,
    "showPoops" BOOLEAN NOT NULL DEFAULT true,
    "showExplorerLink" BOOLEAN NOT NULL DEFAULT true,
    "maskUserAddress" BOOLEAN NOT NULL DEFAULT true,
    "rawTemplate" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Payout Announcements Table
CREATE TABLE IF NOT EXISTS "PayoutAnnouncement" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "withdrawalId" TEXT NOT NULL UNIQUE,
    "userId" TEXT NOT NULL,
    "templateId" TEXT,
    "network" TEXT NOT NULL DEFAULT 'TRC20',
    "currency" TEXT NOT NULL DEFAULT 'USDT',
    "amountCrypto" DECIMAL(18, 4) NOT NULL,
    "amountUsdt" DECIMAL(18, 4) NOT NULL,
    "amountPoops" BIGINT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "explorerUrl" TEXT,
    "recipientMasked" TEXT NOT NULL,
    "renderedMessage" TEXT NOT NULL,
    "telegramMessageId" BIGINT,
    "telegramChatId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
    "failureReason" TEXT,
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutAnnouncement_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "Withdrawal"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayoutAnnouncement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PayoutMessageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes for PayoutAnnouncement
CREATE INDEX IF NOT EXISTS "PayoutAnnouncement_status_idx" ON "PayoutAnnouncement"("status");
CREATE INDEX IF NOT EXISTS "PayoutAnnouncement_createdAt_idx" ON "PayoutAnnouncement"("createdAt");
CREATE INDEX IF NOT EXISTS "PayoutAnnouncement_txHash_idx" ON "PayoutAnnouncement"("txHash");

-- 4. Payout Automation Activity & Audit Logs Table
CREATE TABLE IF NOT EXISTS "PayoutAutomationLog" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
    "eventType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "details" JSONB,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for PayoutAutomationLog
CREATE INDEX IF NOT EXISTS "PayoutAutomationLog_eventType_idx" ON "PayoutAutomationLog"("eventType");
CREATE INDEX IF NOT EXISTS "PayoutAutomationLog_createdAt_idx" ON "PayoutAutomationLog"("createdAt");

-- Seed Initial Default Templates if none exist
INSERT INTO "PayoutMessageTemplate" ("id", "name", "description", "heading", "successMessage", "footer", "emojis", "currencyDisplay", "showUsd", "showPoops", "showExplorerLink", "maskUserAddress", "isDefault", "createdAt", "updatedAt")
VALUES 
    (gen_random_uuid()::text, 'SuperTom Classic Gold', 'Official high-trust format with network badge, masked recipient, and blockchain verification button.', '✅ SuperTom Withdrawal Complete', 'Transaction successfully finalized on-chain!', '🐱 Keep mining with King Tom! Questions? Contact @SuperTomCare', '💎,💰,🚀,🐱,✅,🔗', 'USDT', true, true, true, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Royal Feline Celebration', 'High energy announcement celebrating King Tom payouts with community mining stats.', '👑 King Tom Royal Payout Disbursed! 🎉', 'A fellow feline has received their verified rewards!', '🐱 Feed King Tom biscuits to multiply your hourly Poops! Support: @SuperTomCare', '👑,🎉,💎,💰,🐱,⚡', 'USDT', true, true, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Proof of Reserves Minimal', 'Sleek, transparent receipt design with explicit transaction ID and zero fluff.', '⚡ Verified Withdrawal Sent', 'Instant on-chain transfer confirmed.', 'Join official chat & support: @SuperTomCare', '⚡,🔗,🛡️,✅', 'USDT', false, false, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
