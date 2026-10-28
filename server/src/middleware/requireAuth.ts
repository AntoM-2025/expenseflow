import type { RequestHandler } from "express";

import { pool } from "../db/pool.ts";

import {
  getSessionToken,
  hashSessionToken,
} from "../auth/session.ts";

// ==========================================
// EXPRESS REQUEST EXTENSION
// ==========================================

declare global {
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
    }
  }
}

// ==========================================
// AUTHENTICATION MIDDLEWARE
// ==========================================

export const requireAuth: RequestHandler = async (
  req,
  res,
  next
) => {
  // 1. Retrieve the token from the cookie
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    res.status(401).json({
      error: "Authentication required",
    });

    return;
  }

  try {
    // 2. Compute the token hash
    const tokenHash = hashSessionToken(sessionToken);

    // 3. Find a valid session
    const result = await pool.query<{
      user_id: string;
    }>(
      `SELECT user_id::text
       FROM user_sessions
       WHERE token_hash = $1
         AND expires_at > NOW()`,
      [tokenHash]
    );

    const session = result.rows[0];

    if (!session) {
      res.status(401).json({
        error: "Invalid or expired session",
      });

      return;
    }

    // 4. Make the user ID available
    req.authenticatedUserId = session.user_id;

    // 5. Continue to the requested route
    next();
  } catch (error) {
    console.error("Authentication error:", error);

    res.status(500).json({
      error: "Unable to verify authentication",
    });
  }
};
