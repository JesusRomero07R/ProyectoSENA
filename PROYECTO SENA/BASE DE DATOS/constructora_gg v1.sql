-- ============================================================
--  BASE DE DATOS: CONSTRUCTORA GG
--  Modelo físico corregido y mejorado para EV03
-- ============================================================

DROP DATABASE IF EXISTS constructora_gg;
CREATE DATABASE constructora_gg;
USE constructora_gg;

-- ============================================
-- TABLA: ROLES
-- ============================================
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================
-- TABLA: OFICIOS
-- ============================================
CREATE TABLE oficios (
    id_oficio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_oficio VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================
-- TABLA: CATEGORIAS DE MATERIAL
-- ============================================
CREATE TABLE categorias_material (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL UNIQUE
);

-- ============================================
-- TABLA: USUARIOS
-- ============================================
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    telefono VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    disponibilidad ENUM('disponible', 'ocupado', 'de_baja') DEFAULT 'disponible',
    id_rol_fk INT NOT NULL,
    id_oficio_fk INT NULL,
    FOREIGN KEY (id_rol_fk) REFERENCES roles(id_rol) ON UPDATE CASCADE,
    FOREIGN KEY (id_oficio_fk) REFERENCES oficios(id_oficio) ON UPDATE CASCADE
);

CREATE INDEX idx_usuarios_rol ON usuarios(id_rol_fk);
CREATE INDEX idx_usuarios_oficio ON usuarios(id_oficio_fk);

-- ============================================
-- TABLA: PROYECTOS
-- ============================================
CREATE TABLE proyectos (
    id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    descripcion TEXT,
    ciudad VARCHAR(100),
    direccion VARCHAR(255),
    presupuesto DECIMAL(12,2),
    fecha_inicio DATE,
    fecha_fin DATE,
    avance_general DECIMAL(5,2) DEFAULT 0,
    estado ENUM('activo', 'pausado', 'finalizado') DEFAULT 'activo',
    id_lider_fk INT NOT NULL,
    FOREIGN KEY (id_lider_fk) REFERENCES usuarios(id_usuario)
);

CREATE INDEX idx_proyectos_lider ON proyectos(id_lider_fk);

-- ============================================
-- TABLA: TAREAS
-- ============================================
CREATE TABLE tareas (
    id_tarea INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado ENUM('pendiente', 'en_progreso', 'finalizada') DEFAULT 'pendiente',
    prioridad ENUM('baja','media','alta') DEFAULT 'media',
    fecha_limite DATE,
    id_proyecto_fk INT NOT NULL,
    id_operario_fk INT NOT NULL,
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_operario_fk) REFERENCES usuarios(id_usuario)
);

CREATE INDEX idx_tareas_proyecto ON tareas(id_proyecto_fk);
CREATE INDEX idx_tareas_operario ON tareas(id_operario_fk);

-- ============================================
-- TABLA: REPORTES DE AVANCE
-- ============================================
CREATE TABLE reportes_avance (
    id_reporte INT AUTO_INCREMENT PRIMARY KEY,
    id_tarea_fk INT NOT NULL,
    id_operario_fk INT NOT NULL,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    porcentaje INT NOT NULL,
    observaciones TEXT,
    foto_url VARCHAR(500) NULL,
    FOREIGN KEY (id_tarea_fk) REFERENCES tareas(id_tarea) ON DELETE CASCADE,
    FOREIGN KEY (id_operario_fk) REFERENCES usuarios(id_usuario)
);

-- ============================================
-- TABLA: MATERIALES
-- ============================================
CREATE TABLE materiales (
    id_material INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    id_categoria_fk INT NOT NULL,
    stock_minimo INT DEFAULT 0,
    unidad_medida VARCHAR(20) DEFAULT 'unidades',
    FOREIGN KEY (id_categoria_fk) REFERENCES categorias_material(id_categoria)
);

CREATE INDEX idx_material_categoria ON materiales(id_categoria_fk);

-- ============================================
-- TABLA: INVENTARIO GLOBAL
-- ============================================
CREATE TABLE inventario_global (
    id_inventario INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    stock_actual INT NOT NULL DEFAULT 0,
    unidad_medida VARCHAR(20) NOT NULL,
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material)
);

-- ============================================
-- TABLA: MATERIALES ASIGNADOS A PROYECTOS
-- ============================================
CREATE TABLE materiales_asignados (
    id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    id_proyecto_fk INT NOT NULL,
    cantidad_asignada INT NOT NULL,
    cantidad_usada INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material),
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE
);

CREATE INDEX idx_mat_asignado_material ON materiales_asignados(id_material_fk);
CREATE INDEX idx_mat_asignado_proyecto ON materiales_asignados(id_proyecto_fk);

-- ============================================
-- TABLA: SOLICITUDES DE MATERIAL
-- ============================================
CREATE TABLE solicitudes_material (
    id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
    descripcion TEXT,
    fecha_solicitud DATE NOT NULL DEFAULT (CURRENT_DATE),
    id_proyecto_fk INT NOT NULL,
    id_lider_fk INT NOT NULL,
    estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'pendiente',
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto) ON DELETE CASCADE,
    FOREIGN KEY (id_lider_fk) REFERENCES usuarios(id_usuario)
);

-- ============================================
-- TABLA: MOVIMIENTOS DE INVENTARIO
-- ============================================
CREATE TABLE movimientos_inventario (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    id_usuario_fk INT NOT NULL,
    id_proyecto_fk INT NULL,
    tipo_movimiento ENUM('entrada','salida') NOT NULL,
    cantidad INT NOT NULL,
    fecha_movimiento DATETIME NOT NULL DEFAULT NOW(),
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material),
    FOREIGN KEY (id_usuario_fk) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto)
);

CREATE INDEX idx_mov_material ON movimientos_inventario(id_material_fk);
CREATE INDEX idx_mov_usuario ON movimientos_inventario(id_usuario_fk);
CREATE INDEX idx_mov_proyecto ON movimientos_inventario(id_proyecto_fk);

-- ============================================
-- TABLA: ARCHIVOS PROYECTO (FOTOS, DOCUMENTOS, PLANOS)
-- ============================================
CREATE TABLE archivos_proyecto (
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

CREATE INDEX idx_archivos_proyecto ON archivos_proyecto(id_proyecto_fk);
CREATE INDEX idx_archivos_tarea ON archivos_proyecto(id_tarea_fk);
CREATE INDEX idx_archivos_reporte ON archivos_proyecto(id_reporte_fk);

-- ============================================================
-- VISTAS UTIL PARA EL FRONTEND
-- ============================================================

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
-- FIN DEL SCRIPT
-- ============================================================
