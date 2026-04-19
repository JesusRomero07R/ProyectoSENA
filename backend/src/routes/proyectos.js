const express = require("express");
const { getPool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { ADMIN, LIDER, OPERARIO } = require("../constants/roles");

const router = express.Router();
router.use(authenticate);

const baseSelect = `
  SELECT p.id_proyecto, p.nombre, p.descripcion, p.ciudad, p.direccion, p.presupuesto,
         p.fecha_inicio, p.fecha_fin, p.avance_general, p.estado, p.id_lider_fk,
         u.nombre AS lider_nombre, u.apellido AS lider_apellido, u.correo AS lider_correo
  FROM proyectos p
  INNER JOIN usuarios u ON u.id_usuario = p.id_lider_fk
`;

router.get("/", async (req, res) => {
  try {
    const pool = getPool();
    const rol = req.user.id_rol_fk;
    const uid = req.user.id_usuario;

    let sql = baseSelect + " WHERE 1=1";
    const params = [];

    if (rol === LIDER) {
      sql += " AND p.id_lider_fk = ?";
      params.push(uid);
    } else if (rol === OPERARIO) {
      sql += ` AND EXISTS (
        SELECT 1 FROM tareas t
        WHERE t.id_proyecto_fk = p.id_proyecto AND t.id_operario_fk = ?
      )`;
      params.push(uid);
    } else if (rol !== ADMIN) {
      return res.status(403).json({ message: "Rol no permitido" });
    }

    sql += " ORDER BY p.nombre ASC";

    const [rows] = await pool.query(sql, params);
    return res.json({ proyectos: rows });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error del servidor" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "id inválido" });
    }

    const pool = getPool();
    const [rows] = await pool.query(
      `${baseSelect} WHERE p.id_proyecto = ? LIMIT 1`,
      [id]
    );
    const proyecto = rows[0];
    if (!proyecto) {
      return res.status(404).json({ message: "Proyecto no encontrado" });
    }

    const rol = req.user.id_rol_fk;
    const uid = req.user.id_usuario;

    if (rol === LIDER && proyecto.id_lider_fk !== uid) {
      return res.status(403).json({ message: "No tienes acceso a este proyecto" });
    }

    if (rol === OPERARIO) {
      const [t] = await pool.query(
        `SELECT 1 FROM tareas WHERE id_proyecto_fk = ? AND id_operario_fk = ? LIMIT 1`,
        [id, uid]
      );
      if (!t.length) {
        return res.status(403).json({ message: "No tienes acceso a este proyecto" });
      }
    }

    if (rol !== ADMIN && rol !== LIDER && rol !== OPERARIO) {
      return res.status(403).json({ message: "Rol no permitido" });
    }

    return res.json({ proyecto });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error del servidor" });
  }
});

module.exports = router;
