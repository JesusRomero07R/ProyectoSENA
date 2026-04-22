# Database Mapping - Constructora GG

**Última actualización:** 2026-04-19

---

## 📊 Diagrama Entidad-Relación

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONSTRUCTORA GG - DATABASE SCHEMA                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│    ROLES     │       │   OFICIOS    │       │ CATEGORIAS_MAT.  │
│──────────────│       │──────────────│       │──────────────────│
│ id_rol (PK)  │       │ id_oficio(PK)│       │ id_categoria(PK) │
│ nombre_rol   │       │ nombre_oficio│       │ nombre_categoria │
└──────┬───────┘       └──────┬───────┘       └────────┬─────────┘
       │                     │                         │
       │                     │                         │
       ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               USUARIOS                                        │
│──────────────────────────────────────────────────────────────────────────────│
│ id_usuario (PK) | nombre | apellido | correo (UNIQUE) | telefono            │
│ password_hash | estado | disponibilidad | id_rol_fk | id_oficio_fk          │
│                                                                              │
│ ▸ disponibilidad: ENUM('disponible', 'ocupado', 'de_baja')                  │
│ ▸ estado: ENUM('activo', 'inactivo')                                        │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       │ (1:N)
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               PROYECTOS                                       │
│──────────────────────────────────────────────────────────────────────────────│
│ id_proyecto (PK) | nombre | descripcion | ciudad | direccion                │
│ presupuesto | fecha_inicio | fecha_fin | avance_general | estado            │
│ id_lider_fk (→ usuarios)                                                     │
│                                                                              │
│ ▸ estado: ENUM('activo', 'pausado', 'finalizado')                           │
│ ▸ VISTA: v_proyectos_resumen (tareas_pendientes, equipo_asignado)           │
└─────────────────────────────────────────────────────────────────────────────┘
       │
       │ (1:N)
       ├───▼────────────────────────────────────────────────────┐
       │                                                        │
       ▼                                                        ▼
┌─────────────────┐                                   ┌─────────────────────┐
│     TAREAS      │                                   │  MATERIALES_ASIGN.  │
│─────────────────│                                   │─────────────────────│
│ id_tarea (PK)   │                                   │ id_asignacion (PK)  │
│ titulo          │                                   │ id_material_fk      │
│ descripcion     │                                   │ id_proyecto_fk      │
│ estado          │                                   │ cantidad_asignada   │
│ prioridad       │                                   │ cantidad_usada      │
│ fecha_limite    │                                   └─────────────────────┘
│ id_proyecto_fk  │
│ id_operario_fk  │
└─────────────────┘
       │
       │ (1:N)
       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REPORTES_AVANCE                                     │
│──────────────────────────────────────────────────────────────────────────────│
│ id_reporte (PK) | id_tarea_fk | id_operario_fk | fecha_reporte              │
│ porcentaje | observaciones | foto_url                                       │
│                                                                              │
│ ▸ foto_url: VARCHAR(500) - URL de la foto adjunta                           │
│ ▸ porcentaje: INT (0-100)                                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            ARCHIVOS_PROYECTO                                  │
│──────────────────────────────────────────────────────────────────────────────│
│ id_archivo (PK) | id_proyecto_fk | id_tarea_fk | id_reporte_fk              │
│ id_usuario_fk | nombre_original | nombre_archivo | tipo_mime                │
│ ruta_url | tamanio_bytes | fecha_subida                                     │
│                                                                              │
│ ▸ Tabla centralizada para fotos, planos y documentos                        │
│ ▸ Relaciones opcionales a proyecto, tarea o reporte                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐       ┌─────────────────────────┐
│   MATERIALES     │       │   INVENTARIO_GLOBAL     │
│──────────────────│       │─────────────────────────│
│ id_material (PK) │◄─────►│ id_inventario (PK)      │
│ nombre           │       │ id_material_fk          │
│ id_categoria_fk  │       │ stock_actual            │
│ stock_minimo     │       │ unidad_medida           │
│ unidad_medida    │       └─────────────────────────┘
└──────────────────┘
       │
       │ (1:N)
       ▼
┌─────────────────────────┐       ┌──────────────────────┐
│  SOLICITUDES_MATERIAL   │       │ MOVIMIENTOS_INV.     │
│─────────────────────────│       │──────────────────────│
│ id_solicitud (PK)       │       │ id_movimiento (PK)   │
│ descripcion             │       │ id_material_fk       │
│ fecha_solicitud         │       │ id_usuario_fk        │
│ id_proyecto_fk          │       │ id_proyecto_fk       │
│ id_lider_fk             │       │ tipo_movimiento      │
│ estado                  │       │ cantidad             │
└─────────────────────────┘       │ fecha_movimiento     │
                                  └──────────────────────┘
```

---

## 🗂️ Tablas y Campos

### Tablas Principales

| Tabla | Campos | Descripción |
|-------|--------|-------------|
| `roles` | id_rol, nombre_rol | Roles del sistema (Admin, Líder, Operario) |
| `oficios` | id_oficio, nombre_oficio | Oficios de operarios (Albañil, Electricista, etc.) |
| `categorias_material` | id_categoria, nombre_categoria | Categorías de materiales |
| `usuarios` | id_usuario, nombre, apellido, correo, telefono, password_hash, estado, **disponibilidad**, id_rol_fk, id_oficio_fk | Usuarios del sistema |
| `proyectos` | id_proyecto, nombre, descripcion, ciudad, direccion, presupuesto, fecha_inicio, fecha_fin, avance_general, estado, id_lider_fk | Proyectos de construcción |
| `tareas` | id_tarea, titulo, descripcion, estado, prioridad, fecha_limite, id_proyecto_fk, id_operario_fk | Tareas asignadas a operarios |
| `reportes_avance` | id_reporte, id_tarea_fk, id_operario_fk, fecha_reporte, porcentaje, observaciones, **foto_url** | Reportes de avance de tareas |
| `archivos_proyecto` | id_archivo, id_proyecto_fk, id_tarea_fk, id_reporte_fk, id_usuario_fk, nombre_original, nombre_archivo, tipo_mime, ruta_url, tamanio_bytes, fecha_subida | Archivos adjuntos (fotos, planos, documentos) |
| `materiales` | id_material, nombre, id_categoria_fk, stock_minimo, **unidad_medida** | Tipos de materiales |
| `inventario_global` | id_inventario, id_material_fk, stock_actual, unidad_medida | Stock global de materiales |
| `materiales_asignados` | id_asignacion, id_material_fk, id_proyecto_fk, cantidad_asignada, cantidad_usada | Materiales asignados a proyectos |
| `solicitudes_material` | id_solicitud, descripcion, fecha_solicitud, id_proyecto_fk, id_lider_fk, estado | Solicitudes de material |
| `movimientos_inventario` | id_movimiento, id_material_fk, id_usuario_fk, id_proyecto_fk, tipo_movimiento, cantidad, fecha_movimiento | Movimientos de inventario |

### Vistas (Views)

| Vista | Descripción |
|-------|-------------|
| `v_equipo_disponibilidad` | Operarios con estado de disponibilidad y contador de tareas activas |
| `v_proyectos_resumen` | Proyectos con contadores: tareas_pendientes, equipo_asignado, avance_calculado |
| `v_inventario_critico` | Materiales con estado de stock: crítico, bajo, ok |

---

## 📋 Campos Nuevos (2026-04-19)

| Tabla | Campo | Tipo | Descripción |
|-------|-------|------|-------------|
| `usuarios` | `disponibilidad` | ENUM('disponible', 'ocupado', 'de_baja') | Estado de disponibilidad del operario |
| `reportes_avance` | `foto_url` | VARCHAR(500) | URL de foto adjunta al reporte |
| `materiales` | `unidad_medida` | VARCHAR(20) | Unidad de medida (sacos, m3, unidades, etc.) |
| `archivos_proyecto` | *(tabla nueva)* | - | Gestión centralizada de archivos |

---

## 🔗 Relaciones

| Tabla Origen | Campo FK | Tabla Destino | Campo PK | Tipo |
|--------------|----------|---------------|----------|------|
| usuarios | id_rol_fk | roles | id_rol | N:1 |
| usuarios | id_oficio_fk | oficios | id_oficio | N:1 |
| proyectos | id_lider_fk | usuarios | id_usuario | N:1 |
| tareas | id_proyecto_fk | proyectos | id_proyecto | N:1 |
| tareas | id_operario_fk | usuarios | id_usuario | N:1 |
| reportes_avance | id_tarea_fk | tareas | id_tarea | N:1 |
| reportes_avance | id_operario_fk | usuarios | id_usuario | N:1 |
| archivos_proyecto | id_proyecto_fk | proyectos | id_proyecto | N:1 |
| archivos_proyecto | id_tarea_fk | tareas | id_tarea | N:1 |
| archivos_proyecto | id_reporte_fk | reportes_avance | id_reporte | N:1 |
| archivos_proyecto | id_usuario_fk | usuarios | id_usuario | N:1 |
| materiales | id_categoria_fk | categorias_material | id_categoria | N:1 |
| inventario_global | id_material_fk | materiales | id_material | 1:1 |
| materiales_asignados | id_material_fk | materiales | id_material | N:1 |
| materiales_asignados | id_proyecto_fk | proyectos | id_proyecto | N:1 |
| solicitudes_material | id_proyecto_fk | proyectos | id_proyecto | N:1 |
| solicitudes_material | id_lider_fk | usuarios | id_usuario | N:1 |
| movimientos_inventario | id_material_fk | materiales | id_material | N:1 |
| movimientos_inventario | id_usuario_fk | usuarios | id_usuario | N:1 |
| movimientos_inventario | id_proyecto_fk | proyectos | id_proyecto | N:1 |

---

## 📝 Scripts Disponibles

| Archivo | Descripción |
|---------|-------------|
| `constructora_gg v1.sql` | Script completo DDL + Vistas |
| `inserts.sql` | Datos de prueba (DML) |
| `consultas.sql` | Consultas complejas por rol |
| `migracion_2026_04_19.sql` | Migración para actualizar BD existente |

---

## 🎯 Mapeo Frontend → Backend

### Admin Panel
| Vista | Entidad Principal | Campos Usados |
|-------|-------------------|---------------|
| `admin_usuarios.html` | usuarios | nombre, apellido, correo, telefono, id_rol_fk, estado |
| `admin_proyectos.html` | proyectos + v_proyectos_resumen | nombre, avance_general, estado, fecha_inicio, id_lider_fk |
| `admin_inventario.html` | materiales + inventario_global + v_inventario_critico | nombre, stock_actual, stock_minimo, unidad_medida |
| `admin_reportes.html` | proyectos + tareas + reportes_avance | agregaciones y KPIs |

### Líder Panel
| Vista | Entidad Principal | Campos Usados |
|-------|-------------------|---------------|
| `proyectos_lider.html` | v_proyectos_resumen | todos los campos + tareas_pendientes, equipo_asignado |
| `tareas_lider.html` | tareas + usuarios | titulo, estado, prioridad, fecha_limite, id_operario_fk |
| `equipo_lider.html` | v_equipo_disponibilidad | nombre, apellido, nombre_oficio, tareas_activas, estado_calculado |
| `materiales_lider.html` | materiales + inventario_global | nombre, stock_actual, unidad_medida, stock_minimo |

### Operario Panel
| Vista | Entidad Principal | Campos Usados |
|-------|-------------------|---------------|
| `tareas.html` | tareas + proyectos | titulo, descripcion, estado, prioridad, fecha_limite, proyecto |
| `avances.html` | reportes_avance + tareas | id_tarea_fk, porcentaje, observaciones, foto_url |
| `materiales.html` | materiales + inventario_global | stock disponible |
| `perfil.html` | usuarios | datos personales |
