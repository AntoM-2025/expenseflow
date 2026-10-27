import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.ts";

export const payersRouter = Router();

// ==========================================
// TIPI TYPESCRIPT
// ==========================================

type PayerRow = {
  id: string;
  name: string;
  created_at: Date;
};

// ==========================================
// VALIDAZIONE PAGATORE
// ==========================================

const payerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Il nome è obbligatorio")
    .max(100, "Massimo 100 caratteri"),
});

// ==========================================
// GET /api/payers
// Recupera i pagatori dell'utente
// ==========================================

payersRouter.get("/", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  try {
    const result = await pool.query<PayerRow>(
      `SELECT
        id::text,
        name,
        created_at
       FROM payers
       WHERE user_id = $1
       ORDER BY LOWER(name) ASC`,
      [userId]
    );

    const payers = result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
    }));

    res.status(200).json(payers);
  } catch (error) {
    console.error(
      "Errore recupero pagatori:",
      error
    );

    res.status(500).json({
      error: "Impossibile recuperare i pagatori",
    });
  }
});

// ==========================================
// POST /api/payers
// Creazione di un nuovo pagatore
// ==========================================

payersRouter.post("/", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  // 1. Validazione nome
  const validation = payerSchema.safeParse(
    req.body
  );

  if (!validation.success) {
    res.status(400).json({
      error: "Nome del pagatore non valido",
      details: validation.error.issues,
    });

    return;
  }

  const { name } = validation.data;

  try {
    // 2. Inserimento nel database
    const result = await pool.query<PayerRow>(
      `INSERT INTO payers (
        user_id,
        name
      )
      VALUES ($1, $2)
      RETURNING
        id::text,
        name,
        created_at`,
      [userId, name]
    );

    const payer = result.rows[0];

    if (!payer) {
      throw new Error(
        "Nessun pagatore restituito dal database"
      );
    }

    // 3. Restituzione pagatore creato
    res.status(201).json({
      id: payer.id,
      name: payer.name,
      createdAt: payer.created_at,
    });
  } catch (error: unknown) {
    // PostgreSQL: nome duplicato
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "Hai già un pagatore con questo nome",
      });

      return;
    }

    console.error(
      "Errore creazione pagatore:",
      error
    );

    res.status(500).json({
      error: "Impossibile creare il pagatore",
    });
  }
});