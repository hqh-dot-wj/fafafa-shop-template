-- Migration: BUG-5 + BUG-2 idempotency fixes
-- Run BEFORE deploying the corresponding code changes.
--
-- BUG-5: Add partial_refund_sn column to oms_order
--   Replaces fragile remark-string detection for partial refund state.
--   NULL = no partial refund done; non-NULL = the refund SN of the completed partial refund.
--
-- BUG-2: Add unique constraint to fin_transaction
--   Prevents duplicate wallet entries when Bull retries a BATCH_SETTLE job
--   after partial failure. The constraint makes addBalance idempotent per
--   (wallet, relatedId, type) tuple.

-- Safe to run multiple times.

ALTER TABLE oms_order
  ADD COLUMN IF NOT EXISTS partial_refund_sn VARCHAR(100) NULL;

ALTER TABLE fin_transaction
  ADD CONSTRAINT IF NOT EXISTS fin_transaction_wallet_related_type_key
  UNIQUE (wallet_id, related_id, type);
