import express from "express";
import { z } from "zod";
import { pool } from "./db/pool.ts";

// ==========================================
// CONFIGURAZIONE EXPRESS
// ==========================================

const app = express();
const PORT: number = 3000;

app.use(express.json());

// ==========================================
// TIPI TYPESCRIPT
// ==========================================

type Payer = "Antonio" | "Marta";

type ExpenseRow = {
  id: string;
  amount_cents: string;
  category: string;
  description: string | null;
  expense_date: string;
  payer: Payer;
  created_at: Date;
};

// ==========================================
// VALIDAZIONE CON ZOD
// ==========================================

const expenseSchema = z.object({
  amountCents: z.number().int().positive().max(100_000_000),

  category: z.string().trim().min(1).max(100),

  description: z.string().trim().max(500).optional(),

  expenseDate: z.iso.date(),

  payer: z.enum(["Antonio", "Marta"]).default("Antonio"),
});

// ==========================================
// GET /api/health
// Controllo server e database
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
    console.error("Errore connessione database:", error);

    res.status(503).json({
      status: "error",
      message: "Database non disponibile",
    });
  }
});

// ==========================================
// GET /api/expenses
// Recupero di tutte le spese
// ==========================================

app.get("/api/expenses", async (_req, res) => {
  try {
    const result = await pool.query<ExpenseRow>(
      `SELECT
        id::text,
        amount_cents::text,
        category,
        description,
        expense_date::text,
        payer,
        created_at
       FROM expenses
       ORDER BY expense_date DESC, id DESC`
    );

    const expenses = result.rows.map((row) => ({
      id: row.id,
      amountCents: Number(row.amount_cents),
      category: row.category,
      description: row.description,
      expenseDate: row.expense_date,
      payer: row.payer,
      createdAt: row.created_at,
    }));

    res.status(200).json(expenses);
  } catch (error) {
    console.error("Errore recupero spese:", error);

    res.status(500).json({
      error: "Impossibile recuperare le spese",
    });
  }
});

// ==========================================
// POST /api/expenses
// Inserimento di una nuova spesa
// ==========================================

app.post("/api/expenses", async (req, res) => {
  // Validazione dei dati ricevuti
  const validation = expenseSchema.safeParse(req.body);

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
    payer,
  } = validation.data;

  try {
    // Salvataggio nel database
    const result = await pool.query<ExpenseRow>(
      `INSERT INTO expenses (
        amount_cents,
        category,
        description,
        expense_date,
        payer
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id::text,
        amount_cents::text,
        category,
        description,
        expense_date::text,
        payer,
        created_at`,
      [
        amountCents,
        category,
        description ?? null,
        expenseDate,
        payer,
      ]
    );

    const expense = result.rows[0];

    if (!expense) {
      throw new Error("Nessuna spesa restituita dal database");
    }

    res.status(201).json({
      id: expense.id,
      amountCents: Number(expense.amount_cents),
      category: expense.category,
      description: expense.description,
      expenseDate: expense.expense_date,
      payer: expense.payer,
      createdAt: expense.created_at,
    });
  } catch (error) {
    console.error("Errore salvataggio spesa:", error);

    res.status(500).json({
      error: "Impossibile salvare la spesa",
    });
  }
});

// ==========================================
// DELETE /api/expenses/:id
// Eliminazione di una spesa
// ==========================================

app.delete("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  // Controlliamo che l'ID sia un intero positivo
  if (typeof id !== "string" || !/^[1-9]\d*$/.test(id)) {
    res.status(400).json({
      error: "ID della spesa non valido",
    });

    return;
  }

  try {
    const result = await pool.query<{ id: string }>(
      `DELETE FROM expenses
       WHERE id = $1
       RETURNING id::text`,
      [id]
    );

    // Nessuna spesa trovata con quell'ID
    if (result.rowCount === 0) {
      res.status(404).json({
        error: "Spesa non trovata",
      });

      return;
    }

    // Eliminazione completata
    res.status(204).send();
  } catch (error) {
    console.error("Errore eliminazione spesa:", error);

    res.status(500).json({
      error: "Impossibile eliminare la spesa",
    });
  }
});

// ==========================================
// AVVIO SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Server avviato su http://localhost:${PORT}`);
});