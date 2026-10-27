-- ==========================================
-- EXPENSEFLOW
-- Migration 006: Creazione tabella payers
-- ==========================================

BEGIN;

CREATE TABLE IF NOT EXISTS payers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    name TEXT NOT NULL
        CHECK (
            LENGTH(name) BETWEEN 1 AND 100
            AND name = TRIM(name)
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ogni utente può avere pagatori con nomi diversi.
-- Lo stesso utente non può registrare due volte
-- lo stesso nome, ignorando maiuscole/minuscole.

CREATE UNIQUE INDEX IF NOT EXISTS
    idx_payers_user_name_unique
ON payers (user_id, LOWER(name));

-- Conserviamo gli eventuali pagatori delle spese
-- già esistenti, senza crearne per gli account vuoti.

INSERT INTO payers (user_id, name)
SELECT DISTINCT
    user_id,
    TRIM(payer)
FROM expenses
WHERE user_id IS NOT NULL
  AND payer IS NOT NULL
  AND LENGTH(TRIM(payer)) > 0
ON CONFLICT DO NOTHING;

COMMIT;