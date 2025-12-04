-- ============================================================
--  BASE DE DATOS: CONSTRUCTORA GG
-- ============================================================

DROP DATABASE IF EXISTS constructora_gg;
CREATE DATABASE constructora_gg;
USE constructora_gg;

-- ============================================
-- TABLA: ROLES
-- ============================================
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL
);

-- ============================================
-- TABLA: OFICIOS
-- ============================================
CREATE TABLE oficios (
    id_oficio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_oficio VARCHAR(50) NOT NULL
);

-- ============================================
-- TABLA: CATEGORIAS MATERIAL
-- ============================================
CREATE TABLE categorias_material (
    id_categoria INT AUTO_INCREMENT PRIMARY KEY,
    nombre_categoria VARCHAR(50) NOT NULL
);

-- ============================================
-- TABLA: USUARIOS
-- ============================================
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    correo VARCHAR(100) NOT NULL UNIQUE,
    id_rol_fk INT NOT NULL,
    id_oficio_fk INT NULL,
    FOREIGN KEY (id_rol_fk) REFERENCES roles(id_rol),
    FOREIGN KEY (id_oficio_fk) REFERENCES oficios(id_oficio)
);

-- ============================================
-- TABLA: PROYECTOS
-- ============================================
CREATE TABLE proyectos (
    id_proyecto INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    ciudad VARCHAR(100),
    avance_general DECIMAL(5,2) DEFAULT 0,
    id_lider_fk INT NOT NULL,
    FOREIGN KEY (id_lider_fk) REFERENCES usuarios(id_usuario)
);

-- ============================================
-- TABLA: TAREAS
-- ============================================
CREATE TABLE tareas (
    id_tarea INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    estado ENUM('pendiente', 'en_progreso', 'finalizada') DEFAULT 'pendiente',
    id_proyecto_fk INT NOT NULL,
    id_operario_fk INT NOT NULL,
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto),
    FOREIGN KEY (id_operario_fk) REFERENCES usuarios(id_usuario)
);

-- ============================================
-- TABLA: REPORTES AVANCE (Operario)
-- ============================================
CREATE TABLE reportes_avance (
    id_reporte INT AUTO_INCREMENT PRIMARY KEY,
    id_tarea_fk INT NOT NULL,
    id_operario_fk INT NOT NULL,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    porcentaje INT NOT NULL,
    observaciones TEXT,
    FOREIGN KEY (id_tarea_fk) REFERENCES tareas(id_tarea),
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
    FOREIGN KEY (id_categoria_fk) REFERENCES categorias_material(id_categoria)
);

-- ============================================
-- TABLA: INVENTARIO GLOBAL (Administrador)
-- ============================================
CREATE TABLE inventario_global (
    id_inventario INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    stock_actual INT NOT NULL DEFAULT 0,
    unidad_medida VARCHAR(20) NOT NULL,
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material)
);

-- ============================================
-- TABLA: MATERIALES ASIGNADOS (Líder)
-- ============================================
CREATE TABLE materiales_asignados (
    id_asignacion INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    id_proyecto_fk INT NOT NULL,
    cantidad_asignada INT NOT NULL,
    cantidad_usada INT NOT NULL DEFAULT 0,
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material),
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto)
);

-- ============================================
-- TABLA: SOLICITUDES MATERIAL (Líder -> Administrador)
-- ============================================
CREATE TABLE solicitudes_material (
    id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
    descripcion TEXT,
    fecha_solicitud DATE NOT NULL DEFAULT (CURRENT_DATE),
    id_proyecto_fk INT NOT NULL,
    id_lider_fk INT NOT NULL,
    estado ENUM('pendiente', 'aprobada', 'rechazada') DEFAULT 'pendiente',
    FOREIGN KEY (id_proyecto_fk) REFERENCES proyectos(id_proyecto),
    FOREIGN KEY (id_lider_fk) REFERENCES usuarios(id_usuario)
);

CREATE TABLE movimientos_inventario (
    id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    id_material_fk INT NOT NULL,
    id_usuario_fk INT NOT NULL,
    tipo_movimiento ENUM('entrada','salida') NOT NULL,
    cantidad INT NOT NULL,
    fecha_movimiento DATETIME NOT NULL DEFAULT NOW(),
    
    FOREIGN KEY (id_material_fk) REFERENCES materiales(id_material),
    FOREIGN KEY (id_usuario_fk) REFERENCES usuarios(id_usuario)
) ENGINE=InnoDB;


