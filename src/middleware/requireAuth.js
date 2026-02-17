// src/middleware/requireAuth.js
const { getUserById } = require("../utils/storage");

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    if (req.path.startsWith("/api/") || req.xhr || (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html"))) {
      return res.status(401).json({ success: false, error: "Autenticazione richiesta" });
    }
    return res.redirect("/auth/login");
  }

  // Blocca utenti disattivati
  const user = getUserById(req.session.userId);
  if (user && user.disabled) {
    req.session.destroy(() => {});
    if (req.path.startsWith("/api/") || req.xhr) {
      return res.status(403).json({ success: false, error: "Account disattivato. Contatta l'assistenza." });
    }
    return res.redirect("/auth/login");
  }

  next();
}

module.exports = requireAuth;
