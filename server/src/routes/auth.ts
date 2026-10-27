import { Router } from "express";
import { z } from "zod";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";

import { pool } from "../db/pool.ts";

import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  sessionCookieOptions,
  hashSessionToken,
  getSessionToken,
} from "../auth/session.ts";

// ==========================================
// CONFIGURAZIONE ROUTER
// ==========================================

export const authRouter = Router();

// ==========================================
// TIPI TYPESCRIPT
// ==========================================

type UserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  created_at: Date;
};

type LoginUserRow = {
  id: string;
  name: string;
  username: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | null;
};

// ==========================================
// VALIDAZIONE REGISTRAZIONE
// ==========================================

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),

  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, {
      message:
        "Lo username deve contenere 3-30 caratteri: lettere minuscole, numeri o underscore",
    }),

  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(254)
    .pipe(z.email()),

  password: z.string().min(8).max(128),
});

// ==========================================
// VALIDAZIONE LOGIN
// ==========================================

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

// ==========================================
// POST /api/auth/register
// Registrazione nuovo utente
// ==========================================

authRouter.post("/register", async (req, res) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: "Dati di registrazione non validi",
      details: validation.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });

    return;
  }

  const { name, username, email, password } =
    validation.data;

  try {
    // 1. Generazione hash della password
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // 2. Inserimento utente nel database
    const result = await pool.query<UserRow>(
      `INSERT INTO users (
        name,
        username,
        email,
        password_hash
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id::text,
        name,
        username,
        email,
        created_at`,
      [name, username, email, passwordHash]
    );

    const user = result.rows[0];

    if (!user) {
      throw new Error(
        "Nessun utente restituito dal database"
      );
    }

    // 3. Risposta senza password o hash
    res.status(201).json({
      message: "Registrazione completata",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error: unknown) {
    // PostgreSQL: violazione vincolo UNIQUE
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "Username o email già utilizzati",
      });

      return;
    }

    console.error("Errore registrazione:", error);

    res.status(500).json({
      error: "Impossibile completare la registrazione",
    });
  }
});

// ==========================================
// POST /api/auth/login
// ==========================================

authRouter.post("/login", async (req, res) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: "Dati di accesso non validi",
    });

    return;
  }

  const { username, password } = validation.data;

  try {
    // 1. Recuperiamo l'utente dal database
    const result = await pool.query<LoginUserRow>(
      `SELECT
        id::text,
        name,
        username,
        email,
        password_hash,
        email_verified_at
       FROM users
       WHERE username = $1`,
      [username]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(401).json({
        error: "Username o password non validi",
      });

      return;
    }

    // 2. Verifichiamo la password
    const validPassword = await argon2.verify(
      user.password_hash,
      password
    );

    if (!validPassword) {
      res.status(401).json({
        error: "Username o password non validi",
      });

      return;
    }

    // 3. Generiamo un token casuale
    const sessionToken = randomBytes(32).toString("hex");

    // 4. Salviamo soltanto l'hash del token
    const tokenHash = hashSessionToken(sessionToken);

    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_MS
    );

    await pool.query(
      `INSERT INTO user_sessions (
        user_id,
        token_hash,
        expires_at
      )
      VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt]
    );

    // 5. Inviamo il cookie al browser
    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      ...sessionCookieOptions,
      maxAge: SESSION_DURATION_MS,
    });

    // 6. Restituiamo i dati pubblici dell'utente
    res.status(200).json({
      message: "Login effettuato",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified_at !== null,
      },
    });
  } catch (error) {
    console.error("Errore login:", error);

    res.status(500).json({
      error: "Impossibile effettuare il login",
    });
  }
});

// ==========================================
// GET /api/auth/me
// Recupero utente autenticato
// ==========================================

authRouter.get("/me", async (req, res) => {
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    res.status(401).json({
      error: "Utente non autenticato",
    });

    return;
  }

  try {
    const tokenHash = hashSessionToken(sessionToken);

    const result = await pool.query<{
      id: string;
      name: string;
      username: string;
      email: string;
    }>(
      `SELECT
        u.id::text,
        u.name,
        u.username,
        u.email
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()`,
      [tokenHash]
    );

    const user = result.rows[0];

    if (!user) {
      res.status(401).json({
        error: "Sessione non valida o scaduta",
      });

      return;
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Errore sessione:", error);

    res.status(500).json({
      error: "Impossibile verificare la sessione",
    });
  }
});

// ==========================================
// POST /api/auth/logout
// Chiusura della sessione
// ==========================================

authRouter.post("/logout", async (req, res) => {
  const sessionToken = getSessionToken(req);

  try {
    if (sessionToken) {
      const tokenHash = hashSessionToken(sessionToken);

      // Eliminiamo la sessione dal database
      await pool.query(
        `DELETE FROM user_sessions
         WHERE token_hash = $1`,
        [tokenHash]
      );
    }

    // Eliminiamo il cookie dal browser
    res.clearCookie(
      SESSION_COOKIE_NAME,
      sessionCookieOptions
    );

    res.status(204).send();
  } catch (error) {
    console.error("Errore logout:", error);

    res.status(500).json({
      error: "Impossibile completare il logout",
    });
  }
});