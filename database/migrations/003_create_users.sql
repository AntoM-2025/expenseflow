-- ==========================================
-- EXPENSEFLOW
-- Migration 003: Creazione tabella users
-- ==========================================

BEGIN;

CREATE TABLE IF NOT EXISTS users (

    -- Identificativo univoco
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    -- Nome visualizzato
    name TEXT NOT NULL
        CHECK (
            LENGTH(TRIM(name)) BETWEEN 1 AND 100
        ),

    -- Username per il login
    username TEXT NOT NULL
        CHECK (
            username ~ '^[a-z0-9_]{3,30}$'
        ),

    -- Email per registrazione e recupero password
    email TEXT NOT NULL
        CHECK (
            LENGTH(TRIM(email)) BETWEEN 3 AND 254
        ),

    -- Hash della password (mai la password originale)
    password_hash TEXT NOT NULL,

    -- Data di verifica dell'email
    email_verified_at TIMESTAMPTZ,

    -- Data di creazione dell'account
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

);

-- Username univoco
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique
ON users (username);

-- Email univoca, ignorando maiuscole e spazi esterni
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique
ON users (LOWER(TRIM(email)));

COMMIT;