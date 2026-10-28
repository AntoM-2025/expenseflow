CREATE TABLE incomes (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payer_id BIGINT NOT NULL,
    amount_cents BIGINT NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 100000000),
    category TEXT NOT NULL CHECK (LENGTH(TRIM(category)) BETWEEN 1 AND 100),
    description TEXT CHECK (LENGTH(description) <= 500),
    income_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT incomes_user_payer_fk FOREIGN KEY (user_id, payer_id)
        REFERENCES payers(user_id, id) ON DELETE CASCADE
);
CREATE INDEX idx_incomes_user_payer_date ON incomes(user_id, payer_id, income_date DESC);
