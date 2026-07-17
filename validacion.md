# Diagnóstico de Arquitectura Frontend

## 1. Tamaño y complejidad de archivos

Se identificaron 7 archivos JavaScript que superan las 200 líneas de código, todos ubicados en `frontend/js/modules/`:

- **`tareas.js` (626 líneas)**: Maneja demasiadas responsabilidades (God Object). Incluye llamadas a la API (GET, POST, PATCH, DELETE), construcción masiva de HTML (DOM), lógica de negocio (asignación de operarios, cambio de estados, validación de avances) y manipulación de al menos 4 modales distintos.
- **`detalles.js` (324 líneas)**: Concentra lógica de múltiples dominios (tareas, equipo, inventario) dentro de una sola vista de proyecto. Hace peticiones fetch directas e inyecta HTML de forma monolítica.
- **`usuarios.js` (305 líneas)**: Mezcla la lógica de lectura/listado de usuarios con la creación, edición, borrado lógico (desactivación) y restablecimiento de contraseñas, además de generar toda la UI (cards) en strings de template.
- **`pdf.js` (300 líneas)**: Contiene toda la lógica de dibujo y estructuración del PDF, mezclada fuertemente con la lógica de formateo de datos.
- **`reportes.js` (252 líneas)**: Combina peticiones a múltiples endpoints (inventario, proyectos, tareas) y lógica de renderizado para diferentes tipos de vista.
- **`dashboard.js` (236 líneas)**: Orquesta la carga de KPIs realizando múltiples peticiones concurrentes a la API y manipulando el DOM directamente para cada widget.
- **`proyectos.js` (214 líneas)**: Maneja CRUD de proyectos y el filtrado por estados mediante chips, generando el DOM manualmente.

## 2. Estructura general

- **Organización actual**: Los archivos están organizados por **feature o vista** (ej: `usuarios.js`, `tareas.js`) dentro de la carpeta `modules/`. Hay un intento de extraer utilidades a la raíz (`api.js`, `auth.js`, `ui.js`, `main.js`).
- **Falta de separación de responsabilidades**: En la mayoría de los archivos de `modules/` **no existe separación** entre la lógica de UI, la lógica de negocio y la comunicación con el backend. El patrón común en casi todos los archivos es: `Hacer fetch() -> Procesar JSON -> Generar string HTML -> container.innerHTML = html`.

## 3. Acoplamiento y dependencias

- **Dependencias implícitas**: El sistema depende por completo del **scope global** (`window`). Variables y funciones como `API_URL`, `getAuthHeaders()`, `showToast()`, `abrirModalConfirmacionEstado()`, etc., se declaran en el entorno global y se invocan desde cualquier script. Esto hace imposible rastrear de dónde proviene una función sin hacer una búsqueda en todos los archivos.
- **Ausencia de ES Modules**: Al no utilizar sentencias `import` / `export`, el orden en que se cargan los scripts en los archivos HTML (`<script src="...">`) es sumamente frágil y propenso a errores silenciosos.

## 4. Duplicación de código

- **Peticiones HTTP (fetch)**: Es la duplicación más crítica. Existen más de 50 llamadas directas a `fetch()` a lo largo de los distintos módulos, y casi todas repiten manualmente el mismo boilerplate: `fetch(url, { headers: getAuthHeaders() })`, seguido del chequeo manual `if (!res.ok)`.
- **Renderizado de HTML**: Se construyen estructuras de componentes visuales (como tags de estado, botones de acción y tarjetas) repitiendo los mismos literales de plantillas JS (template strings) en `proyectos.js`, `tareas.js` y `dashboard.js`.
- **Manejo de errores**: Los bloques `try/catch` con `console.error` y `showToast("Error...")` se repiten idénticamente en decenas de funciones asíncronas.

## 5. Recomendaciones

### 5.1. División modular propuesta (Migrar a ES Modules)
Se sugiere adoptar un patrón de arquitectura en 3 capas utilizando `import/export`:

1. **`services/api.js`**: Un cliente API real que abstraiga el uso de `fetch` y maneje automáticamente los headers y errores globales.
   - *Ej: `export const getProyectos = () => api.get('/proyectos');`*
2. **`components/` o `views/`**: Archivos puramente dedicados a devolver fragmentos de UI (ej: `export const UserCard = (user) => ...`).
3. **`modules/[feature].js`**: Controladores limpios que solo unan la data del servicio con el componente visual.

### 5.2. Priorización de refactorización (Riesgo/Impacto)
1. **Prioridad Alta: Centralizar llamadas a la API**. Reemplazar todos los `fetch()` sueltos por un servicio genérico de llamadas. Esto reducirá el tamaño de los archivos drásticamente y mejorará la seguridad y manejo de errores.
2. **Prioridad Alta: `tareas.js`**. Dividir en al menos tres archivos: `tareasService.js` (APIs), `tareasUI.js` (DOM/Modales), y `tareasController.js` (eventos principales). Es el archivo más propenso a bugs actualmente.
3. **Prioridad Media: Transición a ES Modules (`type="module"`)**. Eliminar la dependencia del scope global para que el editor y el linter puedan prevenir errores de referencia, importando explícitamente `getAuthHeaders` y dependencias de UI.
4. **Prioridad Baja: Extraer componentes UI**. Mover las construcciones de "Cards" y "Badges" a funciones compartidas para que los estilos no se rompan si cambia el CSS.
