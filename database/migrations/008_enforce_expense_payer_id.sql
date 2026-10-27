-- ==========================================
-- EXPENSEFLOW
-- Migration 008: payer_id obbligatorio
-- ==========================================

BEGIN;

-- 1. Recuperiamo eventuali pagatori
-- presenti nelle vecchie spese.

INSERT INTO payers (user_id, name)
SELECT DISTINCT
    user_id,
    TRIM(payer)
FROM expenses
WHERE payer_id IS NULL
  AND user_id IS NOT NULL
  AND payer IS NOT NULL
  AND LENGTH(TRIM(payer)) > 0
ON CONFLICT DO NOTHING;

-- 2. Colleghiamo eventuali spese rimaste
-- senza payer_id.

UPDATE expenses AS e
SET payer_id = p.id
FROM payers AS p
WHERE e.payer_id IS NULL
  AND e.user_id = p.user_id
  AND LOWER(TRIM(e.payer)) = LOWER(p.name);

-- 3. Controlliamo che tutte le spese
-- abbiano un pagatore valido.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM expenses
        WHERE payer_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Impossibile completare la migration: alcune spese non hanno un pagatore';
    END IF;
END;
$$;

-- 4. Rendiamo payer_id obbligatorio.

ALTER TABLE expenses
ALTER COLUMN payer_id SET NOT NULL;

COMMIT;