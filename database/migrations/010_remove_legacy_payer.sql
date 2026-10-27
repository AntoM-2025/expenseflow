-- ==========================================
-- EXPENSEFLOW
-- Migration 010
-- Rimozione definitiva colonna payer
-- ==========================================

BEGIN;

-- Verifichiamo che tutte le spese abbiano
-- un pagatore valido appartenente allo
-- stesso utente.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM expenses e
        LEFT JOIN payers p
          ON p.id = e.payer_id
          AND p.user_id = e.user_id
        WHERE p.id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Impossibile rimuovere payer: alcune spese non hanno un pagatore valido';
    END IF;
END;
$$;

-- Eliminiamo la vecchia colonna.
-- Il nome del pagatore rimane nella tabella payers.

ALTER TABLE expenses
DROP COLUMN payer;

COMMIT;