import type { RequestHandler } from "express";

import { pool } from "../db/pool.ts";

import {
  getSessionToken,
  hashSessionToken,
} from "../auth/session.ts";

// ==========================================
// ESTENSIONE REQUEST EXPRESS
// ==========================================

declare global {
  namespace Express {
    interface Request {
      authenticatedUserId?: string;
    }
  }
}

// ==========================================
// MIDDLEWARE AUTENTICAZIONE
// ==========================================

export const requireAuth: RequestHandler = async (
  req,
  res,
  next
) => {
  // 1. Recuperiamo il token dal cookie
  const sessionToken = getSessionToken(req);

  if (!sessionToken) {
    res.status(401).json({
      error: "Autenticazione richiesta",
    });

    return;
  }

  try {
    // 2. Calcoliamo l'hash del token
    const tokenHash = hashSessionToken(sessionToken);

    // 3. Cerchiamo una sessione valida
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
        error: "Sessione non valida o scaduta",
      });

      return;
    }

    // 4. Rendiamo disponibile l'ID utente
    req.authenticatedUserId = session.user_id;

    // 5. Continuiamo verso la route richiesta
    next();
  } catch (error) {
    console.error("Errore autenticazione:", error);

    res.status(500).json({
      error: "Impossibile verificare l'autenticazione",
    });
  }
};