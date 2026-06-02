-- ============================================================
--  CONSULTAS COMPLEJAS DEL PROYECTO
--  Archivo: 03_consultas.sql
-- ============================================================

USE constructora_gg;

-- *****************************************************
--   CONSULTAS PARA ADMINISTRADOR
-- *****************************************************

-- 1. Ver inventario completo con categoría
SELECT m.nombre AS material, c.nombre_categoria, ig.stock_actual, ig.unidad_medida
FROM inventario_global ig
JOIN materiales m ON m.id_material = ig.id_material_fk
JOIN categorias_material c ON c.id_categoria = m.id_categoria_fk;

-- 2. Ver materiales con stock por debajo del mínimo
SELECT m.nombre AS material, ig.stock_actual, m.stock_minimo
FROM inventario_global ig
JOIN materiales m ON m.id_material = ig.id_material_fk
WHERE ig.stock_actual < m.stock_minimo;

-- 3. Total de movimientos por material (SUM + GROUP BY)
SELECT m.nombre AS material,
       SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad ELSE 0 END) AS total_entradas,
       SUM(CASE WHEN tipo_movimiento = 'salida' THEN cantidad ELSE 0 END) AS total_salidas
FROM movimientos_inventario mv
JOIN materiales m ON m.id_material = mv.id_material_fk
GROUP BY m.id_material;

-- *****************************************************
--   CONSULTAS PARA LÍDER DE PROYECTO
-- *****************************************************

-- 4. Ver avance de un proyecto usando promedio de tareas (subconsulta)
SELECT p.nombre AS proyecto,
       (SELECT AVG(porcentaje) 
        FROM reportes_avance r 
        JOIN tareas t2 ON t2.id_tarea = r.id_tarea_fk 
        WHERE t2.id_proyecto_fk = p.id_proyecto) AS avance_promedio
FROM proyectos p;

-- 5. Tareas por proyecto con operario asignado
SELECT p.nombre AS proyecto, t.titulo AS tarea, u.nombre AS operario, t.estado, t.prioridad
FROM tareas t
JOIN proyectos p ON p.id_proyecto = t.id_proyecto_fk
JOIN usuarios u ON u.id_usuario = t.id_operario_fk;

-- 6. Material asignado vs. usado por proyecto
SELECT p.nombre AS proyecto, m.nombre AS material, 
       ma.cantidad_asignada, ma.cantidad_usada,
       (ma.cantidad_asignada - ma.cantidad_usada) AS restante
FROM materiales_asignados ma
JOIN proyectos p ON p.id_proyecto = ma.id_proyecto_fk
JOIN materiales m ON m.id_material = ma.id_material_fk;

-- *****************************************************
--   CONSULTAS PARA OPERARIO
-- *****************************************************

-- 7. Tareas asignadas a un operario (JOIN + filtros)
SELECT u.nombre AS operario, t.titulo, t.estado, t.fecha_limite
FROM tareas t
JOIN usuarios u ON u.id_usuario = t.id_operario_fk
WHERE u.id_rol_fk = 3;

-- 8. Reportes detallados de un operario
SELECT u.nombre, t.titulo, r.porcentaje, r.fecha_reporte
FROM reportes_avance r
JOIN tareas t ON t.id_tarea = r.id_tarea_fk
JOIN usuarios u ON u.id_usuario = r.id_operario_fk;

-- *****************************************************
--   CONSULTAS GENERALES
-- *****************************************************

-- 9. Proyectos con cantidad total de materiales asignados
SELECT p.nombre AS proyecto, SUM(ma.cantidad_asignada) AS total_material
FROM materiales_asignados ma
JOIN proyectos p ON p.id_proyecto = ma.id_proyecto_fk
GROUP BY p.id_proyecto;

-- 10. Operarios con más tareas asignadas
SELECT u.nombre, u.apellido, COUNT(t.id_tarea) AS tareas_asignadas
FROM usuarios u
JOIN tareas t ON t.id_operario_fk = u.id_usuario
WHERE u.id_rol_fk = 3
GROUP BY u.id_usuario
ORDER BY tareas_asignadas DESC;

-- 11. Subconsulta: materiales agotados según asignación
SELECT m.nombre
FROM materiales m
WHERE m.id_material IN (
    SELECT id_material_fk
    FROM inventario_global
    WHERE stock_actual = 0
);

-- 12. Tareas vencidas (fecha_limite < hoy)
SELECT titulo, estado, fecha_limite
FROM tareas
WHERE fecha_limite < CURDATE() AND estado != 'finalizada';

-- 13. Historial de movimientos de inventario por proyecto
SELECT p.nombre AS proyecto, m.nombre AS material, mv.cantidad, mv.tipo_movimiento, mv.fecha_movimiento
FROM movimientos_inventario mv
JOIN proyectos p ON p.id_proyecto = mv.id_proyecto_fk
JOIN materiales m ON m.id_material = mv.id_material_fk;

-- ============================================================
-- FIN DEL SCRIPT DE CONSULTAS
-- ============================================================
