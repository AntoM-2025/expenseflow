-- ==========================================
-- EXPENSEFLOW
-- Migration 001: Creazione tabella expenses
-- ==========================================

CREATE TABLE IF NOT EXISTS expenses (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    amount_cents BIGINT NOT NULL
        CHECK (amount_cents > 0),

    category TEXT NOT NULL
        CHECK (LENGTH(TRIM(category)) > 0),

    description TEXT,

    expense_date DATE NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indice per migliorare le ricerche
-- e l'ordinamento delle spese per data

CREATE INDEX IF NOT EXISTS idx_expenses_date
ON expenses (expense_date DESC);