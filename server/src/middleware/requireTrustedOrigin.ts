import type { RequestHandler } from "express";

// Methods that must not modify data
const safeMethods = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

// Allowed origins read from the environment
const allowedOrigins = new Set(
  [
    ...(process.env.APP_ORIGINS ?? "").split(","),

    // Public URL automatically provided by Render
    process.env.RENDER_EXTERNAL_URL ?? "",
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  throw new Error(
    "APP_ORIGINS is not configured"
  );
}

export const requireTrustedOrigin: RequestHandler = (
  req,
  res,
  next
) => {
  // Read-only requests are allowed
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  // Information sent by modern browsers
  const fetchSite = req.get("Sec-Fetch-Site");

  // Block requests from other sites
  if (fetchSite && fetchSite !== "same-origin") {
    res.status(403).json({
      error: "Request origin not allowed",
    });
    return;
  }

  const origin = req.get("Origin");

  // If Origin is present, it must be allowed
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({
        error: "Request origin not allowed",
      });
      return;
    }

    next();
    return;
  }

  // If Origin is missing, require confirmation
  // that the request comes from the same site
  if (fetchSite !== "same-origin") {
    res.status(403).json({
      error: "Unable to verify the origin",
    });
    return;
  }

  next();
};
