-- ============================================================
--  SCRIPT DE ALIMENTACIÓN DE DATOS
--  Archivo: 02_inserts.sql
-- ============================================================

USE constructora_gg;

-- ============================================
-- ROLES
-- ============================================
INSERT INTO roles (nombre_rol) VALUES
('Administrador'),
('Líder'),
('Operario');

-- ============================================
-- OFICIOS
-- ============================================
INSERT INTO oficios (nombre_oficio) VALUES
('Albañil'),
('Electricista'),
('Pintor'),
('Plomero');

-- ============================================
-- CATEGORÍAS DE MATERIAL
-- ============================================
INSERT INTO categorias_material (nombre_categoria) VALUES
('Cemento'),
('Agregados'),
('Herramientas'),
('Tubería'),
('Pintura');

-- ============================================
-- USUARIOS
-- (password_hash contiene valores ficticios)
-- ============================================
INSERT INTO usuarios 
(nombre, apellido, correo, telefono, password_hash, id_rol_fk, id_oficio_fk) 
VALUES
('Carlos', 'Pérez', 'carlos@gg.com', '3001111111', 'hash_admin', 1, NULL),
('Luisa', 'Gómez', 'luisa@gg.com', '3002222222', 'hash_lider', 2, NULL),
('Pedro', 'Rojas', 'pedro@gg.com', '3003333333', 'hash_op1', 3, 1),
('Sofía', 'Martínez', 'sofia@gg.com', '3004444444', 'hash_op2', 3, 2);

-- ============================================
-- PROYECTOS
-- ============================================
INSERT INTO proyectos
(nombre, descripcion, ciudad, direccion, presupuesto, fecha_inicio, fecha_fin, id_lider_fk)
VALUES
('Construcción Casa Familiar', 
 'Proyecto de vivienda en dos plantas para familia de 4 integrantes.',
 'Bogotá',
 'Calle 123 #45-67',
 85000000,
 '2025-01-15',
 '2025-07-30',
 2);

-- ============================================
-- MATERIALES
-- ============================================
INSERT INTO materiales (nombre, id_categoria_fk, stock_minimo) VALUES
('Cemento gris 50kg', 1, 10),
('Arena fina m3', 2, 5),
('Pala metálica', 3, 2),
('Tubo PVC 1"', 4, 20),
('Pintura blanca galón', 5, 15);

-- ============================================
-- INVENTARIO GLOBAL
-- ============================================
INSERT INTO inventario_global (id_material_fk, stock_actual, unidad_medida) VALUES
(1, 50, 'sacos'),
(2, 30, 'm3'),
(3, 10, 'unidades'),
(4, 100, 'unidades'),
(5, 25, 'galones');

-- ============================================
-- MATERIALES ASIGNADOS A PROYECTOS
-- ============================================
INSERT INTO materiales_asignados 
(id_material_fk, id_proyecto_fk, cantidad_asignada, cantidad_usada) VALUES
(1, 1, 20, 5),
(2, 1, 15, 4),
(5, 1, 8, 2);

-- ============================================
-- TAREAS
-- ============================================
INSERT INTO tareas
(titulo, descripcion, estado, prioridad, fecha_limite, id_proyecto_fk, id_operario_fk)
VALUES
('Levantar muros primer piso', 'Construcción de muros en ladrillo.', 'en_progreso', 'alta', '2025-03-10', 1, 3),
('Instalar tubería sanitaria', 'Instalación PVC en baños y cocina.', 'pendiente', 'media', '2025-03-20', 1, 4),
('Preparar terreno', 'Limpieza y nivelación del lote.', 'finalizada', 'baja', '2025-01-25', 1, 3);

-- ============================================
-- REPORTES DE AVANCE
-- ============================================
INSERT INTO reportes_avance
(id_tarea_fk, id_operario_fk, porcentaje, observaciones)
VALUES
(1, 3, 40, 'Muros levantados hasta 1.5m'),
(2, 4, 10, 'Comprado el material necesario'),
(3, 3, 100, 'Terreno listo');

-- ============================================
-- SOLICITUDES DE MATERIAL
-- ============================================
INSERT INTO solicitudes_material
(descripcion, id_proyecto_fk, id_lider_fk, estado)
VALUES
('Solicitud de 10 sacos de cemento adicionales', 1, 2, 'pendiente'),
('Reposición de pintura blanca', 1, 2, 'aprobada');

-- ============================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================
INSERT INTO movimientos_inventario
(id_material_fk, id_usuario_fk, id_proyecto_fk, tipo_movimiento, cantidad)
VALUES
(1, 1, NULL, 'entrada', 30),
(2, 2, 1, 'salida', 5),
(5, 2, 1, 'salida', 3);

-- ============================================================
-- FIN DEL SCRIPT DE ALIMENTACIÓN
-- ============================================================
