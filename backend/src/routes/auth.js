const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { getPool } = require("../config/db");
const { authenticate, getJwtSecret } = require("../middleware/auth");

const router = express.Router();

function signToken(user) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "8h";
  return jwt.sign(
    { sub: String(user.id_usuario), rol: user.id_rol_fk },
    getJwtSecret(),
    { expiresIn }
  );
}

router.post("/login", async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.status(400).json({ message: "Correo y contraseña son obligatorios" });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id_usuario, nombre, apellido, correo, telefono, estado, id_rol_fk, id_oficio_fk, password_hash
       FROM usuarios
       WHERE correo = ?
       LIMIT 1`,
      [email]
    );

    const row = rows[0];
    if (!row || row.estado !== "activo") {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const token = signToken(row);

    const user = {
      id_usuario: row.id_usuario,
      nombre: row.nombre,
      apellido: row.apellido,
      correo: row.correo,
      telefono: row.telefono,
      estado: row.estado,
      id_rol_fk: row.id_rol_fk,
      id_oficio_fk: row.id_oficio_fk,
    };

    return res.json({ token, user });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error del servidor" });
  }
});

router.get("/me", authenticate, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.correo, u.telefono, u.estado,
              u.id_rol_fk, u.id_oficio_fk, r.nombre_rol
       FROM usuarios u
       INNER JOIN roles r ON r.id_rol = u.id_rol_fk
       WHERE u.id_usuario = ?
       LIMIT 1`,
      [req.user.id_usuario]
    );

    const row = rows[0];
    if (!row || row.estado !== "activo") {
      return res.status(401).json({ message: "Usuario no válido" });
    }

    return res.json({
      user: {
        id_usuario: row.id_usuario,
        nombre: row.nombre,
        apellido: row.apellido,
        correo: row.correo,
        telefono: row.telefono,
        estado: row.estado,
        id_rol_fk: row.id_rol_fk,
        id_oficio_fk: row.id_oficio_fk,
        nombre_rol: row.nombre_rol,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error del servidor" });
  }
});

module.exports = router;
