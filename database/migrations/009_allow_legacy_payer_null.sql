-- ==========================================
-- EXPENSEFLOW
-- Migration 009
-- Preparazione rimozione campo payer
-- ==========================================

BEGIN;

ALTER TABLE expenses
ALTER COLUMN payer DROP NOT NULL;

COMMIT;