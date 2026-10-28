import type { Request } from "express";
import { createHash } from "node:crypto";
import { parseCookie } from "cookie";

// ==========================================
// SESSION CONFIGURATION
// ==========================================

export const SESSION_COOKIE_NAME = "expenseflow_session";

export const SESSION_DURATION_MS =
  7 * 24 * 60 * 60 * 1000;

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

// ==========================================
// TOKEN HASH
// ==========================================

export function hashSessionToken(token: string): string {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

// ==========================================
// READ COOKIE
// ==========================================

export function getSessionToken(
  req: Request
): string | undefined {
  const cookies = parseCookie(req.headers.cookie ?? "");

  const token = cookies[SESSION_COOKIE_NAME];

  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{64}$/.test(token)
  ) {
    return undefined;
  }

  return token;
}
