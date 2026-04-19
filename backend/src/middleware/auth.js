const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET no está definido en .env");
  }
  return secret;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token requerido" });
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, getJwtSecret());
    const sub = payload.sub;
    const rol = payload.rol;
    if (sub == null || rol == null) {
      return res.status(401).json({ message: "Token inválido" });
    }
    req.user = {
      id_usuario: Number(sub),
      id_rol_fk: Number(rol),
    };
    return next();
  } catch {
    return res.status(401).json({ message: "Token inválido o expirado" });
  }
}

function requireRole(...allowedRoleIds) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "No autorizado" });
    }
    if (!allowedRoleIds.includes(req.user.id_rol_fk)) {
      return res.status(403).json({ message: "Permisos insuficientes" });
    }
    return next();
  };
}

module.exports = { authenticate, requireRole, getJwtSecret };
