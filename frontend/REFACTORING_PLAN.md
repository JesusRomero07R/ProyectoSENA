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
- [x] **`css/responsive.css`**

### 1.5 Actualizar `<link>` en cada HTML

- [x] Reemplazar `<link rel="stylesheet" href="styles.css">` (o `../styles.css`) por los imports correctos de los nuevos archivos CSS en CADA HTML:
  - `base.css`
  - `layout.css`
  - `components.css`
  - `forms.css`
  - `responsive.css`
- [x] Eliminar el archivo original `styles.css` (ya distribuido)
- [x] Eliminar TODOS los bloques `<style>...</style>` de los HTMLs

### 1.6 Verificar CSS

- [x] Abrir cada página en el browser y verificar que se ve idéntico al original
- [x] Verificar responsive en viewport de 768px y menor
- [x] Verificar que modales se ven correctamente
- [x] Verificar que no hay estilos perdidos comparando visualmente

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

- [ ] **`js/modules/dashboard.js`**
- [ ] **`js/modules/perfil.js`**
- [ ] **`js/modules/equipo.js`**
- [ ] **`js/modules/proyectos.js`**
- [ ] **`js/modules/tareas.js`**
- [ ] **`js/modules/detalles.js`**
- [ ] **`js/modules/materiales.js`**
- [ ] **`js/modules/inventario.js`**
- [ ] **`js/modules/usuarios.js`**
- [ ] **`js/modules/reportes.js`**
- [ ] **`js/modules/pdf.js`**

### 3.2 Crear `js/main.js` — Entry point

- [ ] Crear `js/main.js`

### 3.3 Reemplazar `<script src="app.js">` en todos los HTMLs

- [ ] Cambiar `<script src="app.js">` por `<script type="module" src="js/main.js">`
- [ ] Eliminar bloque `<script>` inline de protección de ruta

### 3.4 Verificar JS modular

- [ ] Login, Dashboard, Navegación, Modales, CRUDs, Reportes, PDF, Filtros (chips) funcionan

---

## Fase 4 — HTML: Eliminar duplicación con fragments

> **Objetivo**: Sidebar, header y footer se definen UNA vez y se inyectan en cada página.

### 4.1 Crear fragments HTML

- [ ] Crear `components/header.html`
- [ ] Crear `components/sidebar.html`
- [ ] Crear `components/footer.html`

### 4.2 Agregar contenedores en cada HTML

- [ ] Reemplazar header/sidebar/footer por divs con ID

### 4.3 Inyectar en `ui.js`

- [ ] Implementar `loadComponent()`

### 4.4 Verificar fragments

- [ ] Sidebar, Header, Footer visibles y funcionales. Nav-active correcto.

---

## Fase 5 — JS: Reemplazar `onclick` inline con Event Delegation

> **Objetivo**: Eliminar TODOS los `onclick="..."` del HTML generado por JS.

### 5.1 Identificar todos los `onclick` inline

- [ ] Listar módulos afectados

### 5.2 Implementar event delegation en cada módulo

- [ ] Reemplazar `onclick` por `data-action` y `addEventListener`

### 5.3 Eliminar funciones del scope global

- [ ] Limpiar `window.*`

### 5.4 Verificar delegation

- [ ] Botones de acción y navegación funcionan

---

## Fase 6 — Limpieza Final

- [x] Ajustar las rutas relativas en CSS (ej. `url('../assets/...')`)
- [x] Ajustar las rutas en los HTML a los nuevos CSS
- [x] Eliminar `styles.css` original (ya distribuido en archivos CSS)
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
