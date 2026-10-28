import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.ts";

export const incomesRouter = Router();
const idSchema = z.string().max(19).regex(/^[1-9]\d*$/).refine(value => BigInt(value) <= 9223372036854775807n);
const incomeSchema = z.object({
  payerId: idSchema,
  amountCents: z.number().int().positive().max(100_000_000),
  category: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  incomeDate: z.iso.date(),
});

type IncomeRow = {
  id: string; payer_id: string; payer: string; amount_cents: string;
  category: string; description: string | null; income_date: string; created_at: Date;
};
const mapIncome = (row: IncomeRow) => ({
  id: row.id, payerId: row.payer_id, payer: row.payer,
  amountCents: Number(row.amount_cents), category: row.category,
  description: row.description, incomeDate: row.income_date, createdAt: row.created_at,
});

incomesRouter.get("/", async (req, res) => {
  try {
    const result = await pool.query<IncomeRow>(
      `SELECT i.id::text, i.payer_id::text, p.name AS payer, i.amount_cents::text,
       i.category, i.description, i.income_date::text, i.created_at
       FROM incomes i JOIN payers p ON p.id = i.payer_id AND p.user_id = i.user_id
       WHERE i.user_id = $1 ORDER BY i.income_date DESC, i.id DESC`,
      [req.authenticatedUserId],
    );
    res.json(result.rows.map(mapIncome));
  } catch (error) {
    console.error("Error retrieving incomes:", error);
    res.status(500).json({ error: "Unable to retrieve incomes" });
  }
});

incomesRouter.post("/", async (req, res) => {
  const parsed = incomeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid income data", details: parsed.error.issues });
    return;
  }
  const { payerId, amountCents, category, description, incomeDate } = parsed.data;
  try {
    // A single statement checks ownership and inserts the movement.
    const result = await pool.query<IncomeRow>(
      `WITH inserted AS (
        INSERT INTO incomes (user_id, payer_id, amount_cents, category, description, income_date)
        SELECT user_id, id, $3, $4, $5, $6 FROM payers WHERE user_id = $1 AND id = $2
        RETURNING *
       ) SELECT i.id::text, i.payer_id::text, p.name AS payer, i.amount_cents::text,
         i.category, i.description, i.income_date::text, i.created_at
         FROM inserted i JOIN payers p ON p.id = i.payer_id AND p.user_id = i.user_id`,
      [req.authenticatedUserId, payerId, amountCents, category, description ?? null, incomeDate],
    );
    if (!result.rows[0]) {
      res.status(404).json({ error: "Payer not found" });
      return;
    }
    res.status(201).json(mapIncome(result.rows[0]));
  } catch (error) {
    console.error("Error saving income:", error);
    res.status(500).json({ error: "Unable to save the income" });
  }
});

incomesRouter.delete("/:id", async (req, res) => {
  const parsed = idSchema.safeParse(req.params.id);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid income ID" });
    return;
  }
  try {
    const result = await pool.query(
      "DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING id",
      [parsed.data, req.authenticatedUserId],
    );
    if (!result.rowCount) {
      res.status(404).json({ error: "Income not found" });
      return;
    }
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting income:", error);
    res.status(500).json({ error: "Unable to delete the income" });
  }
});
