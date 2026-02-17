// src/middleware/requireAdmin.js
const { getUserById } = require("../utils/storage");

function requireAdmin(req, res, next) {
  const user = getUserById(req.session.userId);
  if (!user || user.role !== "admin") {
    return res.status(403).send("Accesso negato");
  }
  next();
}

module.exports = requireAdmin;
