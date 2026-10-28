import path from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import express from "express";
import { z } from "zod";
import { pool } from "./db/pool.ts";
import { authRouter } from "./routes/auth.ts";
import { payersRouter } from "./routes/payers.ts";
import { requireAuth } from "./middleware/requireAuth.ts";
import { requireTrustedOrigin } from "./middleware/requireTrustedOrigin.ts";

// ==========================================
// EXPRESS CONFIGURATION
// ==========================================

const app = express();

// ==========================================
// RENDER PROXY CONFIGURATION
// ==========================================

if (process.env.RENDER === "true") {
  const proxyHops = Number(
    process.env.TRUST_PROXY_HOPS ?? "1"
  );

  if (
    !Number.isInteger(proxyHops) ||
    proxyHops < 1 ||
    proxyHops > 3
  ) {
    throw new Error(
      "Invalid TRUST_PROXY_HOPS"
    );
  }

  app.set("trust proxy", proxyHops);
}


const PORT = Number(process.env.PORT ?? 3000);

app.use(express.json());

app.use("/api", requireTrustedOrigin);

// ==========================================
// AUTHENTICATION AND PAYERS
// ==========================================

app.use("/api/auth", authRouter);

app.use("/api/payers", requireAuth, payersRouter);

// ==========================================
// TYPESCRIPT TYPES
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
// EXPENSE VALIDATION
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
      message: "Invalid payer ID",
    })
    .max(19),
});

// ==========================================
// EXPENSE CONVERSION FUNCTION
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
// HEALTH CHECK RENDER
// ==========================================

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "expenseflow",
  });
});

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
    console.error("Database error:", error);

    res.status(503).json({
      status: "error",
      message: "Database unavailable",
    });
  }
});

// ==========================================
// EXPENSE API PROTECTION
// ==========================================

app.use("/api/expenses", requireAuth);

// ==========================================
// GET /api/expenses
// ==========================================

app.get("/api/expenses", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Authentication required",
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
      "Error retrieving expenses:",
      error
    );

    res.status(500).json({
      error: "Unable to retrieve expenses",
    });
  }
});

// ==========================================
// POST /api/expenses
// Insert a new expense
// ==========================================

app.post("/api/expenses", async (req, res) => {
  const userId = req.authenticatedUserId;

  if (!userId) {
    res.status(401).json({
      error: "Authentication required",
    });

    return;
  }

  // 1. Validate data
  const validation = expenseSchema.safeParse(
    req.body
  );

  if (!validation.success) {
    res.status(400).json({
      error: "Invalid expense data",
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
    // 2. Verify that the payer
    // belongs to the authenticated user.

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
        error: "Payer not found",
      });

      return;
    }

    // 3. Insert the expense.
    // The payer column is no longer used.

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
        "No expense returned by the database"
      );
    }

    // 4. Return the expense
    // along with the payer name.

    res.status(201).json(
      mapExpense({
        ...expense,
        payer: payer.name,
      })
    );
  } catch (error) {
    console.error(
      "Error saving expense:",
      error
    );

    res.status(500).json({
      error: "Unable to save the expense",
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
      error: "Authentication required",
    });

    return;
  }

  if (
    typeof id !== "string" ||
    !/^[1-9]\d*$/.test(id)
  ) {
    res.status(400).json({
      error: "Invalid expense ID",
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
        error: "Expense not found",
      });

      return;
    }

    res.status(204).send();
  } catch (error) {
    console.error(
      "Error deleting expense:",
      error
    );

    res.status(500).json({
      error: "Unable to delete the expense",
    });
  }
});

// ==========================================
// FRONTEND REACT
// ==========================================

// Directory of the currently running file
const currentDir = path.dirname(
  fileURLToPath(import.meta.url)
);

// React build path
const clientDistPath = path.resolve(
  currentDir,
  "../../client/dist"
);

// React entry file
const indexHtmlPath = path.join(
  clientDistPath,
  "index.html"
);

// Check that React has been built
if (existsSync(indexHtmlPath)) {

  // Serve CSS, JavaScript, and other assets
  app.use(express.static(clientDistPath));

  // Handle React routes
  app.get("/{*splat}", (req, res, next) => {

    // API requests must stay on the backend
    if (
      req.path === "/api" ||
      req.path.startsWith("/api/")
    ) {
      next();
      return;
    }

    // Return the React dashboard
    res.sendFile(indexHtmlPath);
  });

} else if (process.env.NODE_ENV === "production") {

  // React must be available in production
  throw new Error(
    `React build not found: ${indexHtmlPath}`
  );
}

// ==========================================
// SERVER STARTUP
// ==========================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `ExpenseFlow API started on port ${PORT}`
  );
});
