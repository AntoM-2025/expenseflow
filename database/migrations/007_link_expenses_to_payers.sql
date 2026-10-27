-- ==========================================
-- EXPENSEFLOW
-- Migration 007: Collegamento spese-pagatori
-- ==========================================

BEGIN;

-- 1. Aggiungiamo il riferimento al pagatore.
-- Per ora è nullable per mantenere compatibilità
-- con il frontend esistente.

ALTER TABLE expenses
ADD COLUMN payer_id BIGINT;

-- 2. Prepariamo un vincolo che permetta di
-- verificare contemporaneamente utente e pagatore.

ALTER TABLE payers
ADD CONSTRAINT payers_user_id_id_unique
UNIQUE (user_id, id);

-- 3. Recuperiamo eventuali pagatori presenti
-- nelle spese ma non ancora nella tabella payers.

INSERT INTO payers (user_id, name)
SELECT DISTINCT
    user_id,
    TRIM(payer)
FROM expenses
WHERE user_id IS NOT NULL
  AND payer IS NOT NULL
  AND LENGTH(TRIM(payer)) > 0
ON CONFLICT DO NOTHING;

-- 4. Colleghiamo le spese esistenti ai pagatori.

UPDATE expenses AS e
SET payer_id = p.id
FROM payers AS p
WHERE p.user_id = e.user_id
  AND LOWER(p.name) = LOWER(TRIM(e.payer))
  AND e.payer_id IS NULL;

-- 5. Interrompiamo la migration se qualche
-- spesa esistente non è stata collegata.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM expenses
        WHERE payer_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Esistono spese senza un pagatore associato';
    END IF;
END;
$$;

-- 6. Impediamo di collegare una spesa
-- al pagatore di un altro account.

ALTER TABLE expenses
ADD CONSTRAINT expenses_user_payer_fk
FOREIGN KEY (user_id, payer_id)
REFERENCES payers (user_id, id)
ON DELETE RESTRICT;

-- 7. Indice per recuperare le spese
-- di un pagatore appartenente a un utente.

CREATE INDEX idx_expenses_user_payer_date
ON expenses (
    user_id,
    payer_id,
    expense_date DESC
);

-- 8. Eliminiamo il vecchio vincolo che
-- permetteva solo Antonio e Marta.

ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_payer_check;

-- 9. Eliminiamo il pagatore predefinito
-- a livello di database.

ALTER TABLE expenses
ALTER COLUMN payer DROP DEFAULT;

COMMIT;