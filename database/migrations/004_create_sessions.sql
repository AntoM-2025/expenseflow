-- ==========================================
-- EXPENSEFLOW
-- Migration 004: Sessioni utente
-- ==========================================

BEGIN;

CREATE TABLE IF NOT EXISTS user_sessions (

    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Utente proprietario della sessione
    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    -- Hash del token di sessione
    token_hash TEXT NOT NULL UNIQUE
        CHECK (
            token_hash ~ '^[0-9a-f]{64}$'
        ),

    -- Data di creazione
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Data di scadenza
    expires_at TIMESTAMPTZ NOT NULL,

    CONSTRAINT session_expiry_check
        CHECK (expires_at > created_at)

);

-- Ricerca delle sessioni di un utente
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
ON user_sessions (user_id);

-- Ricerca delle sessioni scadute
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
ON user_sessions (expires_at);

COMMIT;