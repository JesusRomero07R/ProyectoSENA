# Diagnóstico de Arquitectura Frontend

## 1. Tamaño y complejidad de archivos

Se identificaron 7 archivos JavaScript que superan las 200 líneas de código, todos ubicados en `frontend/js/modules/`:

| Archivo | Líneas | Responsabilidades identificadas |
|---|---|---|
| `tareas.js` | 626 | API (GET/POST/PATCH/DELETE), construcción DOM, lógica de negocio (asignación operarios, cambio de estados, validación avances), 4+ modales |
| `detalles.js` | 324 | Vista de proyecto con 3 dominios mezclados: tareas, equipo e inventario |
| `usuarios.js` | 305 | Listado, creación, edición, desactivación, reset de contraseña + generación de cards HTML |
| `pdf.js` | 300 | Dibujo del PDF mezclado con lógica de formateo de datos |
| `reportes.js` | 252 | Peticiones a múltiples endpoints + renderizado de vistas distintas |
| `dashboard.js` | 236 | Carga de KPIs con múltiples peticiones concurrentes + manipulación DOM directa |
| `proyectos.js` | 214 | CRUD de proyectos, filtrado por chips, generación manual del DOM |

### Conteo total de fetch() por archivo (50+ llamadas en el proyecto)

- `tareas.js`: ~12 llamadas directas a `fetch()`
- `detalles.js`: ~10 llamadas directas a `fetch()`
- `dashboard.js`: ~8 llamadas directas a `fetch()`
- `reportes.js`: ~8 llamadas directas a `fetch()`
- `materiales.js`, `equipo.js`, `inventario.js`: ~5 cada uno

---

## 2. Estructura general

### Organización actual
```
frontend/
├── css/
│   ├── base.css
│   ├── components.css
│   └── layout.css
├── js/
│   ├── api.js          ← wrapper fetch (subutilizado, ~43 líneas)
│   ├── auth.js         ← autenticación + lógica de login/recuperación
│   ├── main.js         ← orquestador de carga de módulos
│   ├── ui.js           ← sidebar, tema, navegación
│   ├── toast.js        ← notificaciones
│   └── modules/        ← un archivo por feature (vista)
│       ├── dashboard.js
│       ├── proyectos.js
│       ├── tareas.js
│       ├── usuarios.js
│       ├── detalles.js
│       ├── inventario.js
│       ├── materiales.js
│       ├── equipo.js
│       ├── perfil.js
│       ├── reportes.js
│       └── pdf.js
└── pages/
    └── *.html
```

### Separación de responsabilidades
**No existe separación formal.** El patrón universal en todos los módulos es:
```
fetch() → .json() → template string HTML → container.innerHTML = html
```
La comunicación con el backend, el procesamiento de datos y la generación de UI viven **en la misma función**, sin ninguna capa intermedia. El `api.js` existente es un buen inicio pero está ignorado por la mayoría de módulos.

---

## 3. Acoplamiento y dependencias

### Variables y funciones globales implícitas
El proyecto usa exclusivamente el scope global (`window`). Las siguientes están declaradas en algún archivo y consumidas en otros sin ningún contrato explícito:

| Símbolo global | Declarado en | Consumido en |
|---|---|---|
| `API_URL` | `api.js` / `main.js` | Todos los módulos |
| `getAuthHeaders()` | `auth.js` | Todos los módulos |
| `showToast()` | `toast.js` | Todos los módulos |
| `getCurrentUser()` | `auth.js` | `dashboard.js`, `main.js`, etc. |
| `apiFetch()` | `api.js` | Solo usado parcialmente |

### Ausencia de ES Modules
**No se usa ningún `import` ni `export`**. El orden de los tags `<script src="...">` en cada HTML es la única garantía de que una dependencia esté disponible. Un cambio de orden o la omisión de un script produce errores silenciosos en tiempo de ejecución.

---

## 4. Duplicación de código

### Alta prioridad: boilerplate de fetch
El siguiente patrón se repite más de 50 veces en el proyecto:
```javascript
// Duplicado en tareas.js, detalles.js, proyectos.js, dashboard.js, etc.
const res = await fetch(`${API_URL}/[endpoint]`, { headers: getAuthHeaders() });
if (!res.ok) throw new Error('...');
const data = await res.json();
```

### Media prioridad: generación de badges/status tags
Las tarjetas de estado (`Activo`, `Inactivo`, `Finalizado`) se reconstruyen como template strings en:
- `proyectos.js` (línea ~150)
- `usuarios.js` (línea ~238)
- `tareas.js` (múltiples lugares)

Cada una con su propio padding, border-radius y lógica de clase CSS, en lugar de llamar a una función `renderStatusBadge(estado)` compartida.

### Media prioridad: bloques try/catch idénticos
```javascript
// Este bloque aparece docenas de veces
} catch(e) {
    console.error("Error en [función]:", e);
    showToast("Error al ...", "error");
}
```

---

## 5. Recomendaciones

### 5.1. División modular propuesta

Se propone migrar a **ES Modules** con una arquitectura en 3 capas:

```
frontend/js/
├── services/
│   ├── api.js          ← cliente HTTP central (fetch + headers + error handling)
│   ├── proyectos.js    ← export const getProyectos = () => api.get('/proyectos')
│   ├── tareas.js       ← export const getTareas = (pid) => api.get(...)
│   └── usuarios.js     ← export const getUsuarios = () => api.get('/usuarios')
├── components/
│   ├── badges.js       ← export const StatusBadge = (estado) => `<span ...>`
│   ├── cards.js        ← export const ProjectCard = (p) => `<div ...>`
│   └── modals.js       ← lógica compartida de modales
├── modules/
│   ├── dashboard.js    ← solo: import servicios → renderizar → eventos
│   ├── tareas.js       ← solo: import servicios + componentes → lógica de vista
│   └── ...
├── auth.js
├── ui.js
└── main.js
```

### 5.2. Priorización por Impacto / Riesgo

| Prioridad | Acción | Impacto | Riesgo si no se hace |
|---|---|---|---|
| 🔴 Alta | Centralizar todas las llamadas `fetch()` en `services/` | Reducción ~40% de líneas en módulos | Errores de autenticación difíciles de rastrear |
| 🔴 Alta | Dividir `tareas.js` (626 líneas) en Service + UI + Controller | Evitar regresiones en la feature más compleja | Cualquier cambio rompe múltiples flujos |
| 🟡 Media | Migrar a `type="module"` (ES Modules) | El linter puede detectar referencias rotas | Orden de carga frágil ante nuevos scripts |
| 🟡 Media | Extraer `components/badges.js` y `components/cards.js` | Consistencia visual garantizada por código | Los estilos inline se vuelven a romper al refactorizar CSS |
| 🟢 Baja | Mover `pdf.js` a un Worker o servicio separado | UI no se bloquea durante generación de PDF | Lentitud perceptible en reportes complejos |
