const express = require("express");
const { getPool } = require("../config/db");
const { authenticate } = require("../middleware/auth");
const { ADMIN, LIDER, OPERARIO } = require("../constants/roles");

const router = express.Router();
router.use(authenticate);

const listSelect = `
  SELECT t.id_tarea, t.titulo, t.descripcion, t.estado, t.prioridad, t.fecha_limite,
         t.id_proyecto_fk, t.id_operario_fk,
         p.nombre AS proyecto_nombre, p.id_lider_fk,
         o.nombre AS operario_nombre, o.apellido AS operario_apellido
  FROM tareas t
  INNER JOIN proyectos p ON p.id_proyecto = t.id_proyecto_fk
  INNER JOIN usuarios o ON o.id_usuario = t.id_operario_fk
`;

router.get("/", async (req, res) => {
  try {
    const idProyecto = req.query.id_proyecto != null && req.query.id_proyecto !== ""
      ? Number(req.query.id_proyecto)
      : null;
    if (req.query.id_proyecto != null && req.query.id_proyecto !== "" && (!Number.isInteger(idProyecto) || idProyecto < 1)) {
      return res.status(400).json({ message: "id_proyecto inválido" });
    }

    const pool = getPool();
    const rol = req.user.id_rol_fk;
    const uid = req.user.id_usuario;

    let sql = listSelect + " WHERE 1=1";
    const params = [];

    if (idProyecto != null) {
      sql += " AND t.id_proyecto_fk = ?";
      params.push(idProyecto);
    }

    if (rol === OPERARIO) {
      sql += " AND t.id_operario_fk = ?";
      params.push(uid);
    } else if (rol === LIDER) {
      sql += " AND p.id_lider_fk = ?";
      params.push(uid);
    } else if (rol !== ADMIN) {
      return res.status(403).json({ message: "Rol no permitido" });
    }

    sql += " ORDER BY t.fecha_limite ASC, t.id_tarea ASC";

    const [rows] = await pool.query(sql, params);
    return res.json({ tareas: rows });
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
      `${listSelect} WHERE t.id_tarea = ? LIMIT 1`,
      [id]
    );
    const tarea = rows[0];
    if (!tarea) {
      return res.status(404).json({ message: "Tarea no encontrada" });
    }

    const rol = req.user.id_rol_fk;
    const uid = req.user.id_usuario;

    if (rol === OPERARIO && tarea.id_operario_fk !== uid) {
      return res.status(403).json({ message: "No tienes acceso a esta tarea" });
    }

    if (rol === LIDER && tarea.id_lider_fk !== uid) {
      return res.status(403).json({ message: "No tienes acceso a esta tarea" });
    }

    if (rol !== ADMIN && rol !== LIDER && rol !== OPERARIO) {
      return res.status(403).json({ message: "Rol no permitido" });
    }

    return res.json({ tarea });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Error del servidor" });
  }
});

module.exports = router;
