import pg from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing DATABASE_URL");
}

const migrationsDir = fileURLToPath(
  new URL("../../database/migrations/", import.meta.url)
);

async function migrate() {
  const client = new pg.Client({
    connectionString: databaseUrl,
  });

  await client.connect();

  try {
    // Avoid applying migrations from scratch
    // to a populated database without migration history.
    const state = await client.query<{
      history: string | null;
      expenses: string | null;
    }>(
      `SELECT
         to_regclass('public.schema_migrations')::text AS history,
         to_regclass('public.expenses')::text AS expenses`
    );

    if (state.rows[0]?.expenses && !state.rows[0]?.history) {
      throw new Error(
        "Database already initialized without migration history"
      );
    }

    // Record of applied migrations
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((name) => /^\d{3}_.*\.sql$/.test(name))
      .sort();

    if (files.length === 0) {
      throw new Error("No migrations found");
    }

    for (const filename of files) {
      const originalSql = await readFile(
        path.join(migrationsDir, filename),
        "utf8"
      );

      const checksum = createHash("sha256")
        .update(originalSql)
        .digest("hex");

      const existing = await client.query<{
        checksum: string;
      }>(
        `SELECT checksum
         FROM schema_migrations
         WHERE filename = $1`,
        [filename]
      );

      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(
            `Previously applied migration has been modified: ${filename}`
          );
        }

        console.log(`SKIP ${filename}`);
        continue;
      }

      // Some scripts contain BEGIN/COMMIT.
      // Handle them here to also include
      // saving the migration history.
      const sql = originalSql
        .split(/\r?\n/)
        .filter(
          (line) =>
            !/^\s*(BEGIN|COMMIT);\s*$/i.test(line)
        )
        .join("\n");

      await client.query("BEGIN");

      try {
        await client.query(sql);

        await client.query(
          `INSERT INTO schema_migrations
             (filename, checksum)
           VALUES ($1, $2)`,
          [filename, checksum]
        );

        await client.query("COMMIT");

        console.log(`OK ${filename}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    console.log("Migrations complete");
  } finally {
    await client.end();
  }
}

migrate().catch((error) => {
  console.error("Error running migrations:", error);
  process.exitCode = 1;
});
