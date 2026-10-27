-- ==========================================
-- EXPENSEFLOW
-- Migration 005: Collegamento spese-utenti
-- ==========================================

BEGIN;

-- Ogni spesa appartiene obbligatoriamente
-- a un utente

ALTER TABLE expenses
ADD COLUMN user_id BIGINT NOT NULL;

-- Chiave esterna verso users

ALTER TABLE expenses
ADD CONSTRAINT expenses_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES users(id)
ON DELETE RESTRICT;

-- Indice per le ricerche delle spese
-- appartenenti a un determinato utente

CREATE INDEX idx_expenses_user_date
ON expenses (
    user_id,
    expense_date DESC,
    id DESC
);

COMMIT;