import pg from "pg";

const { Pool } = pg;

// ==========================================
// DATABASE CONFIGURATION
// ==========================================

const databaseUrl = process.env.DATABASE_URL;

const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
} = process.env;

// DATABASE_URL is required in production
if (process.env.NODE_ENV === "production" && !databaseUrl) {
  throw new Error(
    "DATABASE_URL is required in production"
  );
}

// Check local credentials
if (
  !databaseUrl &&
  (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB)
) {
  throw new Error(
    "Missing database configuration"
  );
}

// ==========================================
// POOL CREATION
// ==========================================

export const pool = new Pool({
  ...(databaseUrl
    ? {
        // Production: PostgreSQL on Render
        connectionString: databaseUrl,
      }
    : {
        // Development: local PostgreSQL in Docker
        host: process.env.POSTGRES_HOST ?? "127.0.0.1",
        port: Number(process.env.POSTGRES_PORT ?? 5433),
        user: POSTGRES_USER,
        password: POSTGRES_PASSWORD,
        database: POSTGRES_DB,
      }),

  max: 10,
});

// ==========================================
// ERROR HANDLING
// ==========================================

pool.on("error", (error) => {
  console.error(
    "PostgreSQL connection error:",
    error
  );
});
