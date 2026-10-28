import { rateLimit } from "express-rate-limit";

// ==========================================
// LOGIN PROTECTION
// ==========================================

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  // Successful logins do not count toward the limit
  skipSuccessfulRequests: true,

  message: {
    error:
      "Too many login attempts. Try again in 15 minutes.",
  },
});

// ==========================================
// REGISTRATION PROTECTION
// ==========================================

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,

  limit: 5,

  standardHeaders: "draft-8",
  legacyHeaders: false,

  message: {
    error:
      "Too many registration requests. Try again later.",
  },
});
