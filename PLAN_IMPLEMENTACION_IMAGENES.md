# Plan de Implementación: Carga de Imágenes (Render de Proyecto y Fotos de Avance)

Este documento detalla la planificación arquitectónica, visual y técnica para implementar la carga de fotografías en el sistema, asegurando que se cumplan estrictamente los lineamientos `/ponytail` (YAGNI, minimalismo, reutilización de código).

## 1. Filosofía Ponytail Aplicada (El enfoque más eficiente)

El problema típico al mezclar archivos binarios (imágenes) con datos estructurados (JSON de materiales, tareas) es que obliga a cambiar los endpoints a `multipart/form-data`, lo cual requiere reescribir toda la lógica de validación (Pydantic) en el backend y el parseo en el frontend. 

**La Solución Minimalista:**
Crearemos **un único endpoint genérico** `POST /upload` que reciba cualquier imagen, la guarde en la carpeta `uploads/` y devuelva un simple texto (la URL). 
El frontend primero subirá la imagen allí, obtendrá la URL en texto plano, y luego enviará esa URL dentro de los JSON que ya existen (`ProyectoCreate` y `ReporteAvanceCreate`). 
*Resultado: 0 impacto a la lógica actual de validación de proyectos y reportes.*

## 2. Modificaciones en el Backend (Base de Datos y API)

### 2.1 Base de Datos (`models.py`)
- **Proyectos:** Añadir la columna `foto_render_url = Column(String(500), nullable=True)` a la tabla `Proyecto`.
- **Reportes:** La tabla `ReporteAvance` ¡ya tiene la columna `foto_url`! No requiere cambios en la base de datos.
- *Script de Migración:* Crearemos un pequeño script SQL para inyectar la columna `foto_render_url` en la base de datos SQLite sin borrar los datos existentes.

### 2.2 Esquemas (`schemas.py`)
- Añadir `foto_render_url: Optional[str] = None` a `ProyectoBase`.
- El esquema `ReporteAvanceBase` ya contiene `foto_url`.

### 2.3 Router (`main.py` y nuevo endpoint)
- Configurar FastAPI para servir archivos estáticos: `app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")`. Esto permitirá que el frontend cargue las imágenes con una URL como `http://localhost:8000/uploads/foto.jpg`.
- Crear el endpoint `POST /upload` que reciba un `UploadFile` y lo guarde en disco con un nombre único basado en UUID.

## 3. Modificaciones en el Frontend (Interfaz Visual y Lógica)

### 3.1 Vistas y Formularios (HTML)
- **Crear/Editar Proyecto:** Añadir un `<input type="file" id="foto_render" accept="image/*">`.
- **Reportar Avance:** Añadir un `<input type="file" id="foto_reporte" accept="image/*" capture="environment">`. (El atributo `capture` permite abrir la cámara directamente en celulares).

### 3.2 Visualización (CSS / Tarjetas)
- **Tarjeta de Proyecto:** Modificar el diseño de la tarjeta. Si el proyecto tiene un `foto_render_url`, se mostrará como una imagen de cabecera (*banner* o *cover*) ocupando la parte superior de la tarjeta, dándole un aspecto visual premium y moderno.
- **Historial de Reportes:** En la vista donde se ven los reportes pasados, si hay una `foto_url`, mostrar una miniatura clickeable para abrir la evidencia visual.

### 3.3 Lógica JS (`api.js` y módulos)
- Añadir un método genérico `API.uploadImage(file)` en `frontend/js/services/api.js`.
- Interceptar el botón "Guardar" en proyectos y reportes:
  1. Si hay un archivo seleccionado, hacer `API.uploadImage`.
  2. Inyectar la URL devuelta en el payload (ej. `payload.foto_url = url`).
  3. Ejecutar la llamada normal al backend.

## Open Questions

> [!IMPORTANT]
> **Preguntas para el usuario:**
> 1. En las tarjetas de "Proyectos", ¿prefieres que la imagen del render sea una imagen grande de cabecera (tipo banner ancho) o una miniatura al lado izquierdo del texto?
> 2. ¿Quieres que las imágenes se compriman antes de subirse para ahorrar espacio, o subimos la resolución original que envíe el teléfono/computador?
> 3. ¿El proceso general descrito arriba suena bien para proceder con la ejecución?
