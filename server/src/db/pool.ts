import pg from "pg";

const { Pool } = pg;

// ==========================================
// CONFIGURAZIONE DATABASE
// ==========================================

const databaseUrl = process.env.DATABASE_URL;

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
} = process.env;

// In produzione DATABASE_URL è obbligatoria
if (process.env.NODE_ENV === "production" && !databaseUrl) {
  throw new Error(
    "DATABASE_URL obbligatoria in produzione"
  );
}

// Controlliamo le credenziali in locale
if (
  !databaseUrl &&
  (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB)
) {
  throw new Error(
    "Configurazione database mancante"
  );
}

// ==========================================
// CREAZIONE POOL
// ==========================================

export const pool = new Pool({
  ...(databaseUrl
    ? {
        // Produzione: PostgreSQL su Render
        connectionString: databaseUrl,
      }
    : {
        // Sviluppo: PostgreSQL locale in Docker
        host: process.env.POSTGRES_HOST ?? "127.0.0.1",
        port: Number(process.env.POSTGRES_PORT ?? 5433),
        user: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        database: POSTGRES_DB,
      }),

  max: 10,
});

// ==========================================
// GESTIONE ERRORI
// ==========================================

pool.on("error", (error) => {
  console.error(
    "Errore connessione PostgreSQL:",
    error
  );
});