// src/middleware/csrf.js
const crypto = require("crypto");

/**
 * CSRF protection middleware (synchronizer token pattern).
 *
 * - Generates a per-session token stored in req.session._csrf
 * - Sets XSRF-TOKEN cookie (readable by JS) on every response
 * - Validates X-CSRF-Token header or _csrf body field on mutating requests
 * - Skips paths listed in excludePaths (e.g. Stripe webhook)
 */
function csrfProtection({ excludePaths = [] } = {}) {
  return (req, res, next) => {
    // Skip excluded paths (e.g. /stripe/webhook)
    if (excludePaths.some(p => req.originalUrl.startsWith(p))) {
      return next();
    }

    // Ensure session has a CSRF token
    if (!req.session._csrf) {
      req.session._csrf = crypto.randomBytes(32).toString("hex");
    }

    // Expose token getter for server-rendered forms
    req.csrfToken = () => req.session._csrf;

    // Set cookie so client JS can read it (non-httpOnly)
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("XSRF-TOKEN", req.session._csrf, {
      httpOnly: false,
      sameSite: isProd ? "strict" : "lax",
      secure: isProd,
      path: "/"
    });

    // Safe methods — skip validation
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      return next();
    }

    // Validate token on mutating requests
    const submitted =
      req.headers["x-csrf-token"] ||
      (req.body && req.body._csrf);

    if (!submitted || submitted !== req.session._csrf) {
      const wantsJson =
        req.path.startsWith("/api/") ||
        req.xhr ||
        (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html"));

      if (wantsJson) {
        return res.status(403).json({
          success: false,
          error: "Token CSRF non valido o mancante. Ricarica la pagina e riprova."
        });
      }
      return res.status(403).send(
        "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>403</title></head>" +
        "<body style='font-family:sans-serif;text-align:center;padding:60px'>" +
        "<h1>403 — Richiesta non valida</h1>" +
        "<p>Token CSRF non valido o mancante. <a href='javascript:location.reload()'>Ricarica la pagina</a> e riprova.</p>" +
        "</body></html>"
      );
    }

    next();
  };
}

module.exports = csrfProtection;
