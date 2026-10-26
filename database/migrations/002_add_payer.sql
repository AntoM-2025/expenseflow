ALTER TABLE expenses
ADD COLUMN payer TEXT NOT NULL DEFAULT 'Antonio'
CONSTRAINT expenses_payer_check
CHECK (payer IN ('Antonio', 'Marta'));