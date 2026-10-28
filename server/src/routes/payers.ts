import { Router } from "express";
import { z } from "zod";

import { pool } from "../db/pool.ts";

export const payersRouter = Router();

// ==========================================
// TYPESCRIPT TYPES
// ==========================================

type PayerRow = {
  id: string;
  name: string;
  created_at: Date;
};

// ==========================================
// PAYER VALIDATION
// ==========================================

const payerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "Maximum 100 characters"),
});

// ==========================================
// GET /api/payers
// Retrieve the user payers
// ==========================================

payersRouter.get("/", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Authentication required",
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
      "Error retrieving payers:",
      error
    );

    res.status(500).json({
      error: "Unable to retrieve payers",
    });
  }
});

// ==========================================
// POST /api/payers
// Create a new payer
// ==========================================

payersRouter.post("/", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Authentication required",
    });

    return;
  }

  // 1. Validate the name
  const validation = payerSchema.safeParse(
    req.body
  );

  if (!validation.success) {
    res.status(400).json({
      error: "Invalid payer name",
      details: validation.error.issues,
    });

    return;
  }

  const { name } = validation.data;

  try {
    // 2. Insert into the database
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
        "No payer returned by the database"
      );
    }

    // 3. Return the created payer
    res.status(201).json({
      id: payer.id,
      name: payer.name,
      createdAt: payer.created_at,
    });
  } catch (error: unknown) {
    // PostgreSQL: duplicate name
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "You already have a payer with this name",
      });

      return;
    }

    console.error(
      "Error creating payer:",
      error
    );

    res.status(500).json({
      error: "Unable to create the payer",
    });
  }
});
