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

import {
  loginRateLimiter,
  registerRateLimiter,
} from "../middleware/authRateLimit.ts";

// ==========================================
// ROUTER CONFIGURATION
// ==========================================

export const authRouter = Router();

// ==========================================
// TYPESCRIPT TYPES
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
// REGISTRATION VALIDATION
// ==========================================

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),

  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, {
      message:
        "Username must contain 3–30 characters: lowercase letters, numbers, or underscores",
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
// LOGIN VALIDATION
// ==========================================

const loginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

// ==========================================
// POST /api/auth/register
// Register a new user
// ==========================================

authRouter.post(
  "/register",
  registerRateLimiter,
  async (req, res) => {
  const validation = registerSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: "Invalid registration data",
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
    // 1. Generate the password hash
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    // 2. Insert the user into the database
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
        "No user returned by the database"
      );
    }

    // 3. Respond without the password or hash
    res.status(201).json({
      message: "Sign upon complete",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        createdAt: user.created_at,
      },
    });
  } catch (error: unknown) {
    // PostgreSQL: UNIQUE constraint violation
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      res.status(409).json({
        error: "Username or email already in use",
      });

      return;
    }

    console.error("Sign upon error:", error);

    res.status(500).json({
      error: "Unable to complete registration",
    });
  }
});

// ==========================================
// POST /api/auth/login
// ==========================================

authRouter.post(
  "/login",
  loginRateLimiter,
  async (req, res) => {
  const validation = loginSchema.safeParse(req.body);

  if (!validation.success) {
    res.status(400).json({
      error: "Invalid login data",
    });

    return;
  }

  const { username, password } = validation.data;

  try {
    // 1. Retrieve the user from the database
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
        error: "Invalid username or password",
      });

      return;
    }

    // 2. Verify the password
    const validPassword = await argon2.verify(
      user.password_hash,
      password
    );

    if (!validPassword) {
      res.status(401).json({
        error: "Invalid username or password",
      });

      return;
    }

    // 3. Generate a random token
    const sessionToken = randomBytes(32).toString("hex");

    // 4. Store only the token hash
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

    // 5. Send the cookie to the browser
    res.cookie(SESSION_COOKIE_NAME, sessionToken, {
      ...sessionCookieOptions,
      maxAge: SESSION_DURATION_MS,
    });

    // 6. Return the public user data
    res.status(200).json({
      message: "Logged in successfully",
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        emailVerified: user.email_verified_at !== null,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Unable to log in",
    });
  }
});

// ==========================================
// GET /api/auth/me
// Retrieve the authenticated user
// ==========================================

authRouter.get("/me", async (req, res) => {
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    res.status(401).json({
      error: "User not authenticated",
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
        error: "Invalid or expired session",
      });

      return;
    }

    res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Session error:", error);

    res.status(500).json({
      error: "Unable to verify the session",
    });
  }
});

// ==========================================
// POST /api/auth/logout
// Close the session
// ==========================================

authRouter.post("/logout", async (req, res) => {
  const sessionToken = getSessionToken(req);

  try {
    if (sessionToken) {
      const tokenHash = hashSessionToken(sessionToken);

      // Delete the session from the database
      await pool.query(
        `DELETE FROM user_sessions
         WHERE token_hash = $1`,
        [tokenHash]
      );
    }

    // Delete the cookie from the browser
    res.clearCookie(
      SESSION_COOKIE_NAME,
      sessionCookieOptions
    );

    res.status(204).send();
  } catch (error) {
    console.error("Logout error:", error);

    res.status(500).json({
      error: "Unable to complete logout",
    });
  }
});
