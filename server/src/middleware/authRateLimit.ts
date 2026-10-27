import { rateLimit } from "express-rate-limit";

// ==========================================
// PROTEZIONE LOGIN
// ==========================================

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  // I login riusciti non consumano tentativi
  skipSuccessfulRequests: true,

  message: {
    error:
      "Troppi tentativi di accesso. Riprova tra 15 minuti.",
  },
});

// ==========================================
// PROTEZIONE REGISTRAZIONE
// ==========================================

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error:
      "Troppe richieste di registrazione. Riprova più tardi.",
  },
});