-- Migration: Add DEBT_RECOVERY to TransType enum
-- Run this script BEFORE deploying the code changes for Problem 4 fix.
-- PostgreSQL ALTER TYPE ADD VALUE is append-only and cannot be rolled back.
-- Safe to run multiple times due to IF NOT EXISTS.
--
-- Related code change: apps/backend/src/module/finance/settlement/settlement.scheduler.ts
-- When a commission settlement has pendingRecovery deducted, a DEBT_RECOVERY transaction
-- is now written alongside COMMISSION_IN so that totalIncome always equals sum(COMMISSION_IN)
-- and the debt deduction has an explicit ledger entry.

ALTER TYPE "TransType" ADD VALUE IF NOT EXISTS 'DEBT_RECOVERY';
