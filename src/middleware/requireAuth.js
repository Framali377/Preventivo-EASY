// src/middleware/requireAuth.js
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    // API requests get JSON, browser requests get redirect
    if (req.path.startsWith("/api/") || req.xhr || (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html"))) {
      return res.status(401).json({ success: false, error: "Autenticazione richiesta" });
    }
    return res.redirect("/auth/login");
  }
  next();
}

module.exports = requireAuth;
