
import pg from "pg";

const { Pool } = pg;

// Leggiamo le variabili d'ambiente
const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
} = process.env;

// Verifichiamo che siano presenti
if (!POSTGRES_USER || !POSTGRES_PASSWORD || !POSTGRES_DB) {
  throw new Error("Configurazione database mancante");
}

// Creiamo il pool di connessioni
export const pool = new Pool({
  host: "127.0.0.1",
  port: 5433,
  user: POSTGRES_USER,
  password: POSTGRES_PASSWORD,
  database: POSTGRES_DB,
  max: 10,
});

pool.on("error", (error) => {
  console.error("Errore connessione PostgreSQL:", error);
});
