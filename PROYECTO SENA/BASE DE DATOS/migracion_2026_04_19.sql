-- ============================================================
--  MIGRACIÓN: 2026-04-19
--  Descripción: Actualización del esquema para coincidir con frontend
-- ============================================================

USE constructora_gg;

-- ============================================
-- 1. AGREGAR CAMPO disponibilidad A USUARIOS
-- ============================================
ALTER TABLE usuarios
ADD COLUMN disponibilidad ENUM('disponible', 'ocupado', 'de_baja') DEFAULT 'disponible'
AFTER estado;

-- ============================================
-- 2. AGREGAR CAMPO foto_url A REPORTES_AVANCE
-- ============================================
ALTER TABLE reportes_avance
ADD COLUMN foto_url VARCHAR(500) NULL
AFTER observaciones;

-- ============================================
-- 3. AGREGAR CAMPO unidad_medida A MATERIALES
-- ============================================
ALTER TABLE materiales
ADD COLUMN unidad_medida VARCHAR(20) DEFAULT 'unidades'
AFTER stock_minimo;

-- ============================================
-- 4. CREAR TABLA archivos_proyecto
-- ============================================
CREATE TABLE IF NOT EXISTS archivos_proyecto (
    id_archivo INT AUTO_INCREMENT PRIMARY KEY,
    id_proyecto_fk INT NULL,
    id_tarea_fk INT NULL,
    id_reporte_fk INT NULL,
    id_usuario_fk INT NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_mime VARCHAR(50) NOT NULL,
    ruta_url VARCHAR(500) NOT NULL,
    tamanio_bytes INT NOT NULL,
    fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_tarea_fk) REFERENCES tareas(id_tarea) ON DELETE CASCADE,
    FOREIGN KEY (id_reporte_fk) REFERENCES reportes_avance(id_reporte) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_fk) REFERENCES usuarios(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_archivos_proyecto ON archivos_proyecto(id_proyecto_fk);
CREATE INDEX IF NOT EXISTS idx_archivos_tarea ON archivos_proyecto(id_tarea_fk);
CREATE INDEX IF NOT EXISTS idx_archivos_reporte ON archivos_proyecto(id_reporte_fk);

-- ============================================
-- 5. CREAR VISTAS UTIL PARA FRONTEND
-- ============================================

-- Eliminar vistas si existen para recrearlas
DROP VIEW IF EXISTS v_equipo_disponibilidad;
DROP VIEW IF EXISTS v_proyectos_resumen;
DROP VIEW IF EXISTS v_inventario_critico;

-- Vista: Conteo de tareas por operario (para equipo_lider.html)
CREATE VIEW v_equipo_disponibilidad AS
SELECT
    u.id_usuario,
    u.nombre,
    u.apellido,
    u.correo,
    o.nombre_oficio,
    u.disponibilidad,
    COUNT(CASE WHEN t.estado != 'finalizada' THEN 1 END) AS tareas_activas,
    CASE
        WHEN COUNT(CASE WHEN t.estado != 'finalizada' THEN 1 END) = 0 THEN 'disponible'
        WHEN COUNT(CASE WHEN t.estado != 'finalizada' THEN 1 END) <= 2 THEN 'ocupado'
        ELSE 'de_baja'
    END AS estado_calculado
FROM usuarios u
LEFT JOIN oficios o ON o.id_oficio = u.id_oficio_fk
LEFT JOIN tareas t ON t.id_operario_fk = u.id_usuario
WHERE u.id_rol_fk = 3
GROUP BY u.id_usuario;

-- Vista: Avance de proyectos con conteos (para proyectos_lider.html y admin_proyectos.html)
CREATE VIEW v_proyectos_resumen AS
SELECT
    p.*,
    (SELECT COUNT(*) FROM tareas t WHERE t.id_proyecto_fk = p.id_proyecto AND t.estado = 'pendiente') AS tareas_pendientes,
    (SELECT COUNT(DISTINCT t.id_operario_fk) FROM tareas t WHERE t.id_proyecto_fk = p.id_proyecto) AS equipo_asignado,
    (SELECT AVG(r.porcentaje) FROM reportes_avance r JOIN tareas t2 ON t2.id_tarea = r.id_tarea_fk WHERE t2.id_proyecto_fk = p.id_proyecto) AS avance_calculado
FROM proyectos p;

-- Vista: Inventario crítico (stock por debajo del mínimo)
CREATE VIEW v_inventario_critico AS
SELECT
    m.id_material,
    m.nombre,
    m.unidad_medida,
    c.nombre_categoria,
    ig.stock_actual,
    m.stock_minimo,
    CASE
        WHEN ig.stock_actual = 0 THEN 'critico'
        WHEN ig.stock_actual < m.stock_minimo THEN 'bajo'
        ELSE 'ok'
    END AS estado_stock
FROM inventario_global ig
JOIN materiales m ON m.id_material = ig.id_material_fk
JOIN categorias_material c ON c.id_categoria = m.id_categoria_fk;

-- ============================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================
