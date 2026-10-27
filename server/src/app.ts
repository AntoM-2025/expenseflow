import express from "express";
import { z } from "zod";

import { pool } from "./db/pool.ts";
import { authRouter } from "./routes/auth.ts";
import { payersRouter } from "./routes/payers.ts";
import { requireAuth } from "./middleware/requireAuth.ts";

// ==========================================
// CONFIGURAZIONE EXPRESS
// ==========================================

const app = express();
const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

// ==========================================
// AUTENTICAZIONE E PAGATORI
// ==========================================

app.use("/api/auth", authRouter);

app.use("/api/payers", requireAuth, payersRouter);

// ==========================================
// TIPI TYPESCRIPT
// ==========================================

type ExpenseRow = {
  id: string;
  amount_cents: string;
  category: string;
  description: string | null;
  expense_date: string;
  payer_id: string | null;
  payer: string;
  created_at: Date;
};

type ExpenseInsertRow = Omit<ExpenseRow, "payer">;

type PayerRow = {
  id: string;
  name: string;
};

// ==========================================
// VALIDAZIONE SPESE
// ==========================================

const expenseSchema = z.object({
  amountCents: z
    .number()
    .int()
    .positive()
    .max(100_000_000),

  category: z
    .string()
    .trim()
    .min(1)
    .max(100),

  description: z
    .string()
    .trim()
    .max(500)
    .optional(),

  expenseDate: z.iso.date(),

  payerId: z
    .string()
    .regex(/^[1-9]\d*$/, {
      message: "ID pagatore non valido",
    })
    .max(19),
});

// ==========================================
// FUNZIONE DI CONVERSIONE SPESA
// ==========================================

function mapExpense(row: ExpenseRow) {
  return {
    id: row.id,
    amountCents: Number(row.amount_cents),
    category: row.category,
    description: row.description,
    expenseDate: row.expense_date,
    payerId: row.payer_id,
    payer: row.payer,
    createdAt: row.created_at,
  };
}

// ==========================================
// GET /api/health
// ==========================================

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.status(200).json({
      status: "ok",
      message: "ExpenseFlow API online",
      database: "connected",
    });
  } catch (error) {
    console.error("Errore database:", error);

    res.status(503).json({
      status: "error",
      message: "Database non disponibile",
    });
  }
});

// ==========================================
// PROTEZIONE API SPESE
// ==========================================

app.use("/api/expenses", requireAuth);

// ==========================================
// GET /api/expenses
// ==========================================

app.get("/api/expenses", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  try {
    const result = await pool.query<ExpenseRow>(
  `SELECT
    e.id::text,
    e.amount_cents::text,
    e.category,
    e.description,
    e.expense_date::text,
    e.payer_id::text,
    p.name AS payer,
    e.created_at
   FROM expenses e
   JOIN payers p
     ON p.id = e.payer_id
     AND p.user_id = e.user_id
   WHERE e.user_id = $1
   ORDER BY e.expense_date DESC, e.id DESC`,
  [userId]
);
type ExpenseInsertRow = Omit<ExpenseRow, "payer">;
    res.status(200).json(
      result.rows.map(mapExpense)
    );
  } catch (error) {
    console.error(
      "Errore recupero spese:",
      error
    );

    res.status(500).json({
      error: "Impossibile recuperare le spese",
    });
  }
});

// ==========================================
// POST /api/expenses
// Inserimento nuova spesa
// ==========================================

app.post("/api/expenses", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  // 1. Validazione dati
  const validation = expenseSchema.safeParse(
    req.body
  );

  if (!validation.success) {
    res.status(400).json({
      error: "Dati della spesa non validi",
      details: validation.error.issues,
    });

    return;
  }

  const {
    amountCents,
    category,
    description,
    expenseDate,
    payerId,
  } = validation.data;

  try {
    // 2. Verifichiamo che il pagatore
    // appartenga all'utente autenticato.

    const payerResult = await pool.query<{
      id: string;
      name: string;
    }>(
      `SELECT
        id::text,
        name
       FROM payers
       WHERE id = $1
         AND user_id = $2`,
      [payerId, userId]
    );

    const payer = payerResult.rows[0];

    if (!payer) {
      res.status(404).json({
        error: "Pagatore non trovato",
      });

      return;
    }

    // 3. Inseriamo la spesa.
    // Non utilizziamo più la colonna payer.

    const result = await pool.query<ExpenseInsertRow>(
      `INSERT INTO expenses (
        user_id,
        payer_id,
        amount_cents,
        category,
        description,
        expense_date
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id::text,
        amount_cents::text,
        category,
        description,
        expense_date::text,
        payer_id::text,
        created_at`,
      [
        userId,
        payer.id,
        amountCents,
        category,
        description ?? null,
        expenseDate,
      ]
    );

    const expense = result.rows[0];

    if (!expense) {
      throw new Error(
        "Nessuna spesa restituita dal database"
      );
    }

    // 4. Restituiamo la spesa
    // insieme al nome del pagatore.

    res.status(201).json(
      mapExpense({
        ...expense,
        payer: payer.name,
      })
    );
  } catch (error) {
    console.error(
      "Errore salvataggio spesa:",
      error
    );

    res.status(500).json({
      error: "Impossibile salvare la spesa",
    });
  }
});

// ==========================================
// DELETE /api/expenses/:id
// ==========================================

app.delete("/api/expenses/:id", async (req, res) => {
  const userId = req.authenticatedUserId;
  const { id } = req.params;

  if (!userId) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id)
  ) {
    res.status(400).json({
      error: "ID della spesa non valido",
    });

    return;
  }

  try {
    const result = await pool.query<{
      id: string;
    }>(
      `DELETE FROM expenses
       WHERE id = $1
         AND user_id = $2
       RETURNING id::text`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        error: "Spesa non trovata",
      });

      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error(
      "Errore eliminazione spesa:",
      error
    );

    res.status(500).json({
      error: "Impossibile eliminare la spesa",
    });
  }
});

// ==========================================
// AVVIO SERVER
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ExpenseFlow API avviata sulla porta ${PORT}`
  );
});