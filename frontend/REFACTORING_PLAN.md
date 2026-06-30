# Plan de Refactorización — Frontend Constructora GG

> **Approach**: HTML + JS + CSS organizado por carpetas (sin framework, sin build step)  
> **Filosofía**: Ponytail — lo más simple que funcione  
> **Estado**: 🟡 En progreso

---

## Contexto del Proyecto

**Constructora GG** es una plataforma de gestión de obras con 3 roles (Admin, Líder, Operario). El frontend actual consume una API REST FastAPI en `localhost:8000`. Consta de 16 páginas HTML multi-page con autenticación JWT.

### Estado Actual (Antes)

| Elemento | Estado actual | Problema |
|----------|--------------|----------|
| `app.js` | 1 archivo, 2840 líneas, 137 KB | Monolito: auth + dashboard + usuarios + proyectos + tareas + inventario + materiales + reportes + equipo + perfil + PDF |
| `styles.css` | 1 archivo, 1194 líneas, 24 KB | Contiene todo, pero cada HTML re-declara estilos en `<style>` |
| CSS inline | `<style>` en 10 de 16 HTMLs | Duplicación, inconsistencia, difícil de mantener |
| Sidebar/Header/Footer | Copiado manualmente en 16 archivos | Cambiar un link del menú = editar 16 archivos |
| `onclick` inline | En HTML generado por JS (`innerHTML += ...`) | Funciones forzadas a ser globales, escape de strings frágil |
| Fetch API | `fetch()` repetido en cada función | Sin capa de abstracción, sin manejo centralizado de errores |

### Estructura Objetivo (Después)

```
frontend/
├── index.html                          # Login (limpio)
├── dashboard.html                      # Dashboard (shell limpio)
├── pages/
│   ├── usuarios.html                   # Solo estructura HTML, sin <style>
│   ├── proyectos.html
│   ├── tareas.html
│   ├── inventario.html
│   ├── materiales.html
│   ├── reportes.html
│   ├── perfil.html
│   ├── equipo.html
│   ├── detalles_proyecto.html
│   └── reporte_inventario.html
├── shared/
│   ├── recuperar_contrasena.html
│   ├── sobre_nosotros.html
│   ├── soporte_ayuda.html
│   └── terminos_condiciones.html
├── css/
│   ├── base.css                        # Reset, :root variables, tipografía, body, scrollbars
│   ├── layout.css                      # .app, .app-header, .sidebar, .layout, .content, .app-footer
│   ├── components.css                  # .card, .btn-*, .chip, .modal, .kpi-card, badges, notifications
│   ├── forms.css                       # Inputs, selects, textareas, checkboxes, .input-group
│   ├── pages/
│   │   ├── auth.css                    # .auth-page, .auth-card, .credentials-info, .auth-footer
│   │   ├── usuarios.css                # .user-card, .user-avatar-small, .user-role-status, etc.
│   │   ├── tareas.css                  # .task-card, .status-pill-task, .grid-kpis, .task-actions
│   │   ├── inventario.css              # .material-card, .stock-badge, .material-info
│   │   ├── perfil.css                  # Estilos de perfil (si los hay en <style>)
│   │   ├── reportes.css                # .latest-report-item, etc.
│   │   └── shared.css                  # .faq-list, .faq-item, .back-link
│   └── responsive.css                  # TODOS los @media queries consolidados
├── js/
│   ├── api.js                          # API_URL, getAuthHeaders, fetchJSON wrapper, 401 interceptor
│   ├── auth.js                         # getPayload, goToLogin, setupLogin, setupRecovery
│   ├── ui.js                           # setupUIByRole, loadComponent (sidebar/header/footer injection)
│   ├── main.js                         # Entry point: importa módulos, despacha initPage por página
│   └── modules/
│       ├── dashboard.js                # cargarDashboardResumen, marcarNotificacionLeida, setupKPIShortcuts
│       ├── usuarios.js                 # setupUserPage, cargarUsuarios, abrirModalEditarUsuario, desactivar/reactivar
│       ├── proyectos.js                # setupProjectPage, cargarProyectos, cambiarEstadoProyecto
│       ├── tareas.js                   # setupTasksPage, cargarTareas, finalizarTarea, modales reporte/reasignar
│       ├── inventario.js               # cargarInventarioGlobal, setupInventoryPage, modificarStock
│       ├── materiales.js               # setupMaterialesPage, cargarMaterialesProyectos, transferencias
│       ├── reportes.js                 # setupReportsPage, cargarDatosReportes
│       ├── perfil.js                   # setupProfilePage
│       ├── equipo.js                   # setupEquipoPage, cargarEquipoPagina, cargarOperariosDisponibles
│       ├── detalles.js                 # setupProjectDetailPage, refrescarDetallesProyecto, modales estado
│       └── pdf.js                      # exportarProyectoPDF
└── components/
    ├── sidebar.html                    # Fragment HTML del sidebar (se inyecta vía JS)
    ├── header.html                     # Fragment del header (se inyecta vía JS)
    └── footer.html                     # Fragment del footer (se inyecta vía JS)
```

---

## Reglas de Implementación

1. **Migración incremental**: cada fase debe dejar el proyecto funcional. Si se rompe algo, se puede revertir un solo archivo.
2. **Responsive intacto**: todos los `@media` queries se preservan, solo se consolidan en `responsive.css`.
3. **Sin dependencias nuevas**: cero npm, cero build step. Solo ES Modules nativos del browser (`<script type="module">`).
4. **Inline `onclick` → Event delegation**: reemplazar `onclick="fn(args)"` con `data-action` + `data-*` atributos + un solo `addEventListener` por contenedor.
5. **Fetch centralizado**: toda llamada a la API pasa por `api.fetchJSON()` que maneja headers, 401, y parse de JSON.
6. **Comentarios preservados**: no borrar comentarios existentes a menos que sean incorrectos.

---

## Fase 1 — CSS: Extraer y Organizar

> **Objetivo**: Mover TODO el CSS a archivos separados. Eliminar `<style>` de los HTMLs.

### 1.1 Crear estructura de carpetas CSS

- [ ] Crear carpeta `frontend/css/`
- [ ] Crear carpeta `frontend/css/pages/`

### 1.2 Dividir `styles.css` en archivos temáticos

Tomar el contenido de `styles.css` (1194 líneas) y distribuirlo:

- [ ] **`css/base.css`** — Extraer:
  - `@import url(fonts)` (línea 1)
  - `:root` variables (líneas 3–28)
  - Reset universal `*, *::before, *::after` (líneas 31–35)
  - `body` (líneas 37–49)
  - Custom scrollbars (líneas 52–69)
  - `.mt-20` y utilidades genéricas (líneas 592–594)

- [ ] **`css/layout.css`** — Extraer:
  - `.app` (líneas 72–76)
  - `.app-header`, `.brand`, `.brand-logo`, `.brand-text` (líneas 78–130)
  - `.user-chip`, `.user-avatar`, `.user-info` (líneas 132–170)
  - `.layout` (líneas 172–178)
  - `.sidebar`, `.sidebar-section-title`, `.sidebar-hint` (líneas 181–266)
  - `.nav`, `.nav-link`, `.nav-active` (líneas 203–256)
  - `.content`, `.content-header`, `.content-title` (líneas 269–307)
  - `.logout-btn` (líneas 806–824)
  - `.app-footer`, `.footer-nav`, `.footer-link`, `.footer-copy` (líneas 774–803)
  - `.action-bar` (líneas 1165–1187)
  - `.project-sub-nav` (líneas 1190–1194)

- [ ] **`css/components.css`** — Extraer:
  - `.chips-row`, `.chip`, `.chip-active` (líneas 309–340)
  - `.card`, `.card-header`, `.card-subtitle` (líneas 343–374)
  - `.grid-3`, `.grid-4` (líneas 376–386)
  - `.kpi-card`, `.kpi-label`, `.kpi-value`, `.kpi-tag` (líneas 389–444)
  - `.modal`, `.modal-content`, `.modal-header`, `.close-modal` (líneas 832–1083)
  - `.role-section` (líneas 827–829)
  - `.notification-card`, `.notification-header`, `.notification-title`, `.notification-text` (líneas 880–916)
  - `.flex-row`, `.flex-row-padded`, `.flex-row-between` (líneas 919–937)
  - `.text-subtle-italic` (líneas 939–946)
  - `.badge-inline`, `.badge-status-active`, `.badge-status-inactive` (líneas 948–972)
  - `.report-item`, `.report-date`, `.report-percentage` (líneas 974–999)
  - `.btn-remove-icon` (líneas 1001–1015)
  - `.mat-qty-input` (líneas 1017–1022)
  - `.clickable-card` (líneas 1024–1032)
  - `.input-borderless` (líneas 1034–1044)
  - Animaciones: `@keyframes fadeIn`, `@keyframes slideUp`, `@keyframes shake`, `.shake` (líneas 859–873, 1046–1049)
  - `.project-card`, `.user-card`, `.task-card`, `.list-item` (líneas 1136–1148)
  - `.project-progress-bar`, `.progress-fill` (líneas 1151–1162)
  - `.back-link`, `.header-back-link` (líneas 1120–1133)

- [ ] **`css/forms.css`** — Extraer:
  - `.input-group` (líneas 633–648)
  - `input[type="text"]`, `select`, `textarea`, `.input-search` (líneas 650–691)
  - Custom `select` appearance (líneas 674–681)
  - `input:focus`, `select:focus`, `textarea:focus` (líneas 683–691)
  - Custom checkboxes y radios (líneas 694–744)
  - `.link-muted` (líneas 746–756)

- [ ] **`css/pages/auth.css`** — Extraer:
  - `.auth-page` (líneas 597–604)
  - `.auth-card` (líneas 606–617)
  - `.auth-content h1`, `.auth-content .subtitle` (líneas 619–631)
  - `.credentials-info` (líneas 758–772)
  - `.auth-footer` (líneas 774–778)

- [ ] **`css/pages/shared.css`** — Extraer:
  - `.faq-list`, `.faq-item`, `.faq-question`, `.faq-answer` (líneas 1086–1118)

- [ ] **`css/components.css`** incluir también los estilos de botones:
  - `button`, `.btn` base (líneas 447–466)
  - `.btn-primary`, `.btn-outline`, `.btn-ghost` (líneas 469–509)
  - `.btn-small`, `.btn-small-muted` (líneas 512–534)
  - `.btn-success`, `.btn-danger` (líneas 537–586)
  - `.btn-full-width` (líneas 588–590)

### 1.3 Extraer CSS inline de los HTMLs a archivos de página

Para cada HTML que tenga `<style>`, mover su contenido a un archivo CSS dedicado:

- [ ] **`css/pages/usuarios.css`** ← Extraer `<style>` de `pages/usuarios.html` (líneas 8–202):
  - `.user-list`, `.user-card` (grid layout), `.user-avatar-small`, `.user-details`, `.user-role-status`, `.role-tag`, `.status-tag`, `.availability-tag`, `.free-tag`, `.occupied-tag`
  - `.input-email-wrapper`, `.email-suffix`
  - Media query de `.user-card` responsive

- [ ] **`css/pages/tareas.css`** ← Extraer `<style>` de `pages/tareas.html` (líneas 8–100):
  - `.tasks-list`, `.task-card`, `.task-header`, `.task-title`, `.task-meta`, `.task-project`
  - `.status-pill-task`, `.status-pendiente`, `.status-en-curso`, `.status-completada`
  - `.task-details`, `.task-actions`
  - `.grid-kpis`, `.kpi-card` override, `.kpi-value` override

- [ ] **`css/pages/inventario.css`** ← Extraer `<style>` de `pages/inventario.html`
- [ ] **`css/pages/reportes.css`** ← Extraer `<style>` de `pages/reportes.html`
- [ ] **`css/pages/perfil.css`** ← Extraer `<style>` de `pages/perfil.html`
- [ ] **`css/pages/detalles.css`** ← Extraer `<style>` de `pages/detalles_proyecto.html`
- [ ] **`css/pages/equipo.css`** ← Extraer `<style>` de `pages/equipo.html`
- [ ] **`css/pages/materiales.css`** ← Extraer `<style>` de `pages/materiales.html`
- [ ] **`css/pages/reporte_inventario.css`** ← Extraer `<style>` de `pages/reporte_inventario.html`

### 1.4 Consolidar media queries

- [ ] **`css/responsive.css`** — Recopilar TODOS los `@media (max-width: 768px)` de:
  - `styles.css` (grid-4 dashboard, action-bar)
  - `usuarios.html` (user-card responsive)
  - `tareas.html` (layout responsive)
  - Cada HTML que tenga un `@media` en su `<style>`
  - Consolidar en un solo archivo ordenado por breakpoint

### 1.5 Actualizar `<link>` en cada HTML

- [ ] Reemplazar `<link rel="stylesheet" href="styles.css">` (o `../styles.css`) por los imports correctos de los nuevos archivos CSS en CADA HTML:
  - `index.html`: base + forms + pages/auth + responsive
  - `dashboard.html`: base + layout + components + forms + responsive
  - Cada `pages/*.html`: base + layout + components + forms + pages/[nombre].css + responsive
  - Cada `shared/*.html`: base + layout + components + pages/shared.css + responsive

- [ ] Eliminar TODOS los bloques `<style>...</style>` de los HTMLs
- [ ] Eliminar el archivo original `styles.css` (ya distribuido)

### 1.6 Verificar CSS

- [ ] Abrir cada página en el browser y verificar que se ve idéntico al original
- [ ] Verificar responsive en viewport de 768px y menor
- [ ] Verificar que modales se ven correctamente
- [ ] Verificar que no hay estilos perdidos comparando visualmente

---

## Fase 2 — JS: Crear capa API y Auth

> **Objetivo**: Extraer la lógica compartida (API, auth, JWT) a módulos reutilizables.

### 2.1 Crear `js/api.js`

- [ ] Crear archivo `js/api.js` con:
  ```js
  export const API_URL = "http://localhost:8000";
  
  export function getAuthHeaders() { /* token de localStorage */ }
  
  export async function fetchJSON(url, options = {}) {
    // Merge headers, hacer fetch, manejar 401, parsear JSON
  }
  
  // Interceptor 401 global (reimplementar el override de window.fetch)
  ```

### 2.2 Crear `js/auth.js`

- [ ] Crear archivo `js/auth.js` con:
  ```js
  export function getPayload() { /* decode JWT */ }
  export function goToLogin() { /* limpiar storage, redirigir */ }
  export function setupLogin(formId) { /* bind login form */ }
  export function setupRecovery(formId) { /* bind recovery form */ }
  ```

### 2.3 Crear `js/ui.js`

- [ ] Crear archivo `js/ui.js` con:
  ```js
  export function setupUIByRole(roleId) { /* mostrar/ocultar por rol */ }
  export async function loadComponent(selector, url) { /* inyectar sidebar/header/footer */ }
  export function renderProjectSubNavigation(activeTab) { /* sub-nav de proyecto */ }
  ```

### 2.4 Verificar módulos base

- [ ] Crear un HTML de prueba temporal que importe `js/api.js` y verifique que `fetchJSON` funciona
- [ ] Verificar que `getPayload()` decodifica correctamente el JWT

---

## Fase 3 — JS: Dividir `app.js` en módulos por página

> **Objetivo**: Cada módulo de página es independiente y exporta su función `setup*`.

### 3.1 Crear módulos de página

- [ ] **`js/modules/dashboard.js`** ← Mover de `app.js`:
  - `cargarDashboardResumen()` (líneas 224–440)
  - `marcarNotificacionLeida()` (líneas 442–445)
  - `setupKPIShortcuts()` (líneas 447–450)

- [ ] **`js/modules/perfil.js`** ← Mover:
  - `setupProfilePage()` (líneas 453–590)

- [ ] **`js/modules/equipo.js`** ← Mover:
  - `setupEquipoPage()` (líneas 593–688)
  - `cargarEquipoPagina()` (líneas 690–738)

- [ ] **`js/modules/proyectos.js`** ← Mover:
  - `setupProjectPage()` (líneas 741–805)
  - `cargarProyectos()` (líneas 807–855)
  - `cambiarEstadoProyecto()` (líneas 857–892)

- [ ] **`js/modules/tareas.js`** ← Mover:
  - `setupTasksPage()` (líneas 895–1116)
  - `cargarSelectProyectosTareas()` (líneas 1118–1144)
  - `cargarOperariosPorProyecto()` (líneas 1146–1155)
  - `cargarTareas()` (líneas 1157–1233)
  - `finalizarTarea()`, `reactivarTarea()` (líneas 1235–1241)
  - `abrirModalDetalleTask()` (líneas 1243–1291)
  - `eliminarReporteAvance()` (líneas 1293–1315)
  - `abrirModalReporte()`, `actualizarOpcionesMateriales()` (líneas 1323–1370)
  - `abrirModalReasignarOperario()`, `cargarOperariosParaReasignar()` (líneas 2804–2839)

- [ ] **`js/modules/detalles.js`** ← Mover:
  - `setupProjectDetailPage()` (líneas 1374–1413)
  - `refrescarDetallesProyecto()` (líneas 1415–1469)
  - `abrirModalConfirmacionEstado()` (líneas 1471–1547)
  - `cargarTareasProyecto()` (líneas 1549–1566)
  - `cargarEquipoProyecto()` (líneas 1568–1580)
  - `cargarInventarioProyecto()` (líneas 1582–1591)
  - `desvincularOperario()` (líneas 1593–1606)
  - `cargarOperariosDisponibles()` (líneas 1608–1645)

- [ ] **`js/modules/materiales.js`** ← Mover:
  - `setupMaterialesPage()` (líneas 1648–1728)
  - `cargarSelectsTransferencia()` (líneas 1730–1765)
  - `cargarMaterialesProyectos()` (líneas 1769–1806)

- [ ] **`js/modules/inventario.js`** ← Mover:
  - `cargarInventarioGlobal()` (líneas 1809–1836)
  - `setupInventoryPage()` (líneas 1839–1909)
  - `modificarStock()` (líneas 2417–2456)

- [ ] **`js/modules/usuarios.js`** ← Mover:
  - `setupUserPage()` (líneas 1912–2009)
  - `cargarUsuarios()` (líneas 2012–2132)
  - `abrirModalEditarUsuario()` (líneas 2134–2142)
  - `desactivarUsuario()`, `reactivarUsuario()` (líneas 2144–2184)

- [ ] **`js/modules/reportes.js`** ← Mover:
  - `generarReporteInventario()` (líneas 2187–2206)
  - `setupReportsPage()` (líneas 2209–2245)
  - `cargarDatosReportes()` (líneas 2247–2263)
  - `setupAvancesPage()` (líneas 2266–2415)

- [ ] **`js/modules/pdf.js`** ← Mover:
  - `exportarProyectoPDF()` (líneas 2458–2755)

### 3.2 Crear `js/main.js` — Entry point

- [ ] Crear `js/main.js` que:
  1. Importa `api.js`, `auth.js`, `ui.js`
  2. En `DOMContentLoaded`:
     - Carga components (sidebar, header, footer) vía `loadComponent()`
     - Lee JWT y llama `setupUIByRole()`
     - Detecta qué página es (por IDs en el DOM) y llama el `setup*` correspondiente
     - Bindea logout

### 3.3 Reemplazar `<script src="app.js">` en todos los HTMLs

- [ ] Cambiar `<script src="app.js">` / `<script src="../app.js">` por `<script type="module" src="js/main.js">` (o `../js/main.js`)
- [ ] Eliminar el bloque `<script>` inline de protección de ruta en `dashboard.html` (mover la guard a `auth.js`)

### 3.4 Verificar JS modular

- [ ] Login funciona
- [ ] Dashboard carga KPIs para admin, líder, operario
- [ ] Navegación entre todas las páginas funciona
- [ ] Todos los modales abren/cierran correctamente
- [ ] CRUD de usuarios funciona
- [ ] CRUD de proyectos funciona
- [ ] Reportar avance de tarea funciona
- [ ] Inventario y stock funcionan
- [ ] PDF se genera correctamente
- [ ] Filtros (chips) y búsquedas funcionan

---

## Fase 4 — HTML: Eliminar duplicación con fragments

> **Objetivo**: Sidebar, header y footer se definen UNA vez y se inyectan en cada página.

### 4.1 Crear fragments HTML

- [ ] Crear `components/header.html` — Contener solo el `<header class="app-header">...</header>` con placeholders para user info
- [ ] Crear `components/sidebar.html` — Contener solo el `<aside class="sidebar">...</aside>` con todos los nav-links (el JS ya los filtra por rol)
- [ ] Crear `components/footer.html` — Contener solo el `<footer class="app-footer">...</footer>`

### 4.2 Agregar contenedores en cada HTML

- [ ] En cada HTML de `pages/` y `dashboard.html`, reemplazar el header/sidebar/footer hardcodeado por divs vacíos:
  ```html
  <div id="app-header"></div>
  ...
  <div id="app-sidebar"></div>
  ...
  <div id="app-footer"></div>
  ```

### 4.3 Inyectar en `ui.js`

- [ ] En `loadComponent()`, hacer fetch del fragment y ponerlo con `innerHTML`
- [ ] Ajustar las rutas relativas de los links del sidebar/header según si estamos en `/` o `/pages/`
- [ ] Después de inyectar sidebar, ejecutar `setupUIByRole()` para filtrar por rol

### 4.4 Verificar fragments

- [ ] Sidebar se muestra y los links son correctos desde `dashboard.html` y desde `pages/*.html`
- [ ] Header muestra nombre de usuario e iniciales
- [ ] Footer links funcionan
- [ ] `nav-active` marca la página correcta
- [ ] Responsive: sidebar oculto en mobile

---

## Fase 5 — JS: Reemplazar `onclick` inline con Event Delegation

> **Objetivo**: Eliminar TODOS los `onclick="..."` del HTML generado por JS.

### 5.1 Identificar todos los `onclick` inline

Los módulos que generan HTML con onclick:

- [ ] `usuarios.js` — botones Editar, Desactivar/Reactivar por usuario
- [ ] `proyectos.js` — botones Finalizar, Reactivar, Tareas, Equipo, Inventario por proyecto
- [ ] `tareas.js` — botones Reportar, Historial, Reasignar, Finalizar por tarea
- [ ] `inventario.js` — botones +Agregar, -Restar por material
- [ ] `dashboard.js` — KPI clickables, botón ✓ en notificaciones, cards clickables
- [ ] `detalles.js` — items clickables de tareas, botón Eliminar reporte
- [ ] `equipo.js` — botón Perfil por miembro
- [ ] `materiales.js` — (cards sin acciones directas, verificar)
- [ ] `reportes.js` — (verificar si hay onclick)

### 5.2 Implementar event delegation en cada módulo

Para cada módulo:

- [ ] Reemplazar `onclick="fn(args)"` por `data-action="nombre" data-id="valor"`
- [ ] Registrar UN `addEventListener('click', handler)` en el contenedor padre
- [ ] En el handler, usar `e.target.closest('[data-action]')` para encontrar el botón
- [ ] Leer `dataset.action` y `dataset.id` (u otros `data-*`) para despachar

### 5.3 Eliminar funciones del scope global

- [ ] Verificar que ninguna función necesita estar en `window.*`
- [ ] Si algún HTML estático (no generado por JS) tiene `onclick`, migrar a `addEventListener` en el módulo correspondiente

### 5.4 Verificar delegation

- [ ] Todos los botones de acción funcionan tras re-render de listas
- [ ] Cards clickables (proyectos, tareas) navegan correctamente
- [ ] Modales abren con los datos correctos

---

## Fase 6 — Limpieza Final

- [ ] Eliminar `app.js` original (ya distribuido en módulos)
- [ ] Eliminar `styles.css` original (ya distribuido en archivos CSS)
- [ ] Eliminar estilos `style="..."` inline innecesarios de los HTMLs (los que son de layout puro, moverlos a CSS)
- [ ] Verificar que no hay `<script>` inline en ningún HTML excepto `<script type="module" src="...">`
- [ ] Revisar la consola del browser: 0 errores, 0 warnings
- [ ] Test completo de los 3 roles (admin, líder, operario)
- [ ] Test responsive en mobile
- [ ] Actualizar este archivo marcando todas las tareas como completadas

---

## Notas Técnicas

### Cómo funciona `loadComponent()`

```js
// js/ui.js
export async function loadComponent(selector, url) {
  const el = document.querySelector(selector);
  if (!el) return;
  const res = await fetch(url);
  if (res.ok) el.innerHTML = await res.text();
}
```

Se llama desde `main.js`:
```js
const basePath = window.location.pathname.includes('/pages/') ? '../' : '';
await loadComponent('#app-header', `${basePath}components/header.html`);
await loadComponent('#app-sidebar', `${basePath}components/sidebar.html`);
await loadComponent('#app-footer', `${basePath}components/footer.html`);
```

### Patrón de Event Delegation

```js
// Antes:
container.innerHTML += `<button onclick="desactivarUsuario(${id})">Desactivar</button>`;

// Después:
container.innerHTML += `<button data-action="desactivar" data-id="${id}">Desactivar</button>`;

container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'desactivar') desactivarUsuario(parseInt(id));
});
```

### Patrón de módulo de página

```js
// js/modules/usuarios.js
import { fetchJSON } from '../api.js';
import { getPayload, goToLogin } from '../auth.js';

let cachedUsers = [];

export async function setupUserPage() {
  // setup filtros, modales, formularios
  await cargarUsuarios();
  bindDelegation();
}

async function cargarUsuarios() {
  cachedUsers = await fetchJSON('/usuarios');
  renderUsers(cachedUsers);
}

function bindDelegation() {
  const container = document.getElementById('userList');
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    // despachar acciones
  });
}
```
