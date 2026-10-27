import type { RequestHandler } from "express";

// Metodi che non devono modificare i dati
const safeMethods = new Set([
  "GET",
  "HEAD",
  "OPTIONS",
]);

// Indirizzi autorizzati, letti dall'ambiente
const allowedOrigins = new Set(
  [
    ...(process.env.APP_ORIGINS ?? "").split(","),

    // URL pubblico fornito automaticamente da Render
    process.env.RENDER_EXTERNAL_URL ?? "",
  ]
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  throw new Error(
    "APP_ORIGINS non configurato"
  );
}

export const requireTrustedOrigin: RequestHandler = (
  req,
  res,
  next
) => {
  // Le richieste di sola lettura sono consentite
  if (safeMethods.has(req.method)) {
    next();
    return;
  }

  // Informazione inviata dai browser moderni
  const fetchSite = req.get("Sec-Fetch-Site");

  // Blocchiamo richieste provenienti da altri siti
  if (fetchSite && fetchSite !== "same-origin") {
    res.status(403).json({
      error: "Origine della richiesta non autorizzata",
    });
    return;
  }

  const origin = req.get("Origin");

  // Se Origin è presente, deve essere autorizzato
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      res.status(403).json({
        error: "Origine della richiesta non autorizzata",
      });
      return;
    }

    next();
    return;
  }

  // Se manca Origin, richiediamo una conferma
  // di provenienza dallo stesso sito
  if (fetchSite !== "same-origin") {
    res.status(403).json({
      error: "Impossibile verificare l'origine",
    });
    return;
  }

  next();
};