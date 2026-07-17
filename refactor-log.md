# Refactor Log — Frontend Modularización

---

## FASE 1 — Cliente HTTP centralizado
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos creados
| Archivo | Descripción |
|---|---|
| `frontend/js/services/api.js` | Cliente HTTP centralizado con métodos semánticos REST |

### Archivos modificados
*Ninguno.* Todos los archivos originales permanecen intactos.

### Qué hace el nuevo archivo
- Re-exporta `API_URL`, `getAuthHeaders` y `fetchJSON` desde el `api.js` original, sin duplicar lógica.
- Añade el objeto `api` con métodos de conveniencia: `get()`, `post()`, `put()`, `patch()`, `del()`, `upload()`.
- Cada método llama a `fetchJSON` (que ya maneja auth headers y redirección por 401) y parsea la respuesta a JSON automáticamente.
- Maneja respuestas sin cuerpo (HTTP 204) y errores HTTP con mensajes descriptivos.

### Estado del sistema
- Los módulos originales en `modules/` siguen funcionando sin ningún cambio.
- El nuevo `services/api.js` **no está conectado a ninguna vista HTML** todavía.
- No existe riesgo de regresión en esta fase.

### Qué queda pendiente
- **FASE 2:** Crear `services/[feature].js` para un módulo de bajo riesgo (propuesto: `perfil.js` o `inventario.js`). **Requiere confirmación del usuario.**
- **FASE 3:** Crear `components/badges.js` y `components/cards.js` como funciones puras.
- **Conexión con vistas HTML:** Pendiente de autorización explícita del usuario tras pruebas manuales.

---

## FASE 2 — Capa de servicio: Perfil de usuario
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos creados
| Archivo | Descripción |
|---|---|
| `frontend/js/services/perfil.js` | Capa de datos para el dominio "Perfil". Peticiones HTTP puras sin DOM. |

### Archivos modificados
*Ninguno.* Todos los archivos originales permanecen intactos.

### Llamadas a la API extraídas de `modules/perfil.js`
| Método del servicio | HTTP | Endpoint | Equivale a (línea original) |
|---|---|---|---|
| `perfilService.getMe()` | GET | `/usuarios/me` | línea 17 |
| `perfilService.getById(id)` | GET | `/usuarios/:id` | línea 17 |
| `perfilService.getProfile(targetId)` | GET | Ambos, según contexto | lógica líneas 7–17 |
| `perfilService.update(id, data)` | PUT | `/usuarios/:id` | líneas 89–93 |

### Estado del sistema
- `modules/perfil.js` sigue funcionando sin ningún cambio.
- `services/perfil.js` no está conectado a ninguna vista HTML todavía.
- No existe riesgo de regresión.

### Qué queda pendiente
- **FASE 3:** Crear `components/badges.js` y `components/cards.js` como funciones puras. **Requiere confirmación del usuario.**
- **Conexión con vistas HTML:** Pendiente de autorización explícita del usuario tras pruebas manuales.

---

## FASE 3 — Componentes de UI: Badges y Cards
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos creados
| Archivo | Descripción |
|---|---|
| `frontend/js/components/badges.js` | Funciones puras para badges/etiquetas de estado |
| `frontend/js/components/cards.js` | Funciones puras para tarjetas completas (project, user, task) |

### Archivos modificados
*Ninguno.* Todos los archivos originales permanecen intactos.

### Funciones exportadas

**`badges.js`**
| Función | Uso actual equivalente |
|---|---|
| `statusBadge(activo)` | Badge Activo/Inactivo en `usuarios.js` línea 238 |
| `projectStatusBadge(estado)` | Badge estado proyecto en `proyectos.js` línea 150 |
| `availabilityBadge(projectName)` | Tags libre/ocupado en `usuarios.js` líneas 226–229 |
| `taskStatusPill(estado, finalizador)` | Pills de estado en `tareas.js` línea 332 |
| `stockBadge(cantidad, isLow)` | Badge stock en `inventario.js` línea 22 |
| `inlineBadge(content)` | Badges de materiales en `tareas.js` línea 394 |

**`cards.js`**
| Función | Uso actual equivalente |
|---|---|
| `projectCard(p, opts)` | Template en `proyectos.js` líneas 143–173 |
| `userCard(u, opts)` | Template en `usuarios.js` líneas 232–245 |
| `taskCard(t, opts)` | Template en `tareas.js` líneas 335–345 |

### Mejoras respecto al código original
- Eliminado `color:#fff` hardcodeado de todos los badges (se delega al CSS)
- `formatCurrency()` extraída como helper privado (antes era `p.presupuesto.toLocaleString()` inline)
- Lógica de botones condicionales separada de la construcción de HTML
- XSS mitigation: `safeTitle` en `taskCard` escapa comillas en data-attributes

### Estado del sistema
- `modules/proyectos.js`, `modules/usuarios.js`, `modules/tareas.js` siguen funcionando sin cambios.
- Los nuevos componentes no están conectados a ninguna vista HTML todavía.
- No existe riesgo de regresión.

### Qué queda pendiente
- **Conexión con vistas HTML:** Autorización explícita del usuario requerida antes de apuntar los HTML a los nuevos scripts.
- **Migración progresiva de módulos:** Reemplazar los templates inline en cada módulo por llamadas a las funciones de `components/`.

---

## FASE 4 — Conexión: perfil.js e inventario.js
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos modificados
| Archivo | Cambios |
|---|---|
| `modules/perfil.js` | Reemplazados 2 `fetch()` directos por `perfilService.getProfile()` y `perfilService.update()` |
| `modules/inventario.js` | Reemplazados 3 `fetch()` directos por `api.get()`, `api.post()`, `api.patch()`. Badge inline reemplazado por `stockBadge()` |
| `services/api.js` | Fix: `put()` y `patch()` ahora omiten body si es `null` (necesario para endpoints de query string) |

### Archivos creados
*Ninguno en esta fase.*

### Estado del sistema
- `perfil.html` e `inventario.html` ya usan los nuevos servicios y componentes en producción.
- No se modificó ningún HTML.
- El flujo de auth (redirección en 401) sigue siendo manejado por `fetchJSON` en `api.js` original.

### Qué queda pendiente
- **Siguiente:** Conectar `modules/usuarios.js` → `userCard()` + `statusBadge()` (riesgo medio)
- **Luego:** Conectar `modules/proyectos.js` → `projectCard()` + `projectStatusBadge()`
- **Último:** Conectar `modules/tareas.js` → `taskCard()` + `taskStatusPill()` (mayor riesgo)

---

## FASE 5 — Conexión: usuarios.js
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos modificados
| Archivo | Cambios |
|---|---|
| `modules/usuarios.js` | 6 `fetch()` directos → `api`. Template card inline (30 líneas) → `userCard()`. Tags inline → `availabilityBadge()` vía `cards.js` |

### Calls reemplazadas
| Antes | Después |
|---|---|
| `fetch POST /usuarios` | `api.post('/usuarios', formData)` |
| `fetch PUT /usuarios/:id` | `api.put('/usuarios/:id', formData)` |
| `fetch GET /usuarios` | `api.get('/usuarios')` |
| `fetch GET /proyectos` | `api.get('/proyectos')` |
| `fetch DELETE /usuarios/:id` | `api.del('/usuarios/:id')` |
| `fetch PATCH /usuarios/:id/activar` | `api.patch('/usuarios/:id/activar', null)` |

### Estado del sistema
- `usuarios.html` ya usa el `userCard()` del componente en producción.
- El badge Activo/Inactivo ahora proviene de `statusBadge()` en `badges.js` (sin `color:#fff` hardcodeado).
- Tags de disponibilidad provienen de `availabilityBadge()`.

### Qué queda pendiente
- **Siguiente:** Conectar `modules/proyectos.js` → `projectCard()` + `projectStatusBadge()`
- **Último:** Conectar `modules/tareas.js` → `taskCard()` + `taskStatusPill()` (mayor riesgo)

---

## FASE 6 — Conexión: proyectos.js
**Fecha:** 2026-07-08  
**Estado:** ✅ Completada

### Archivos modificados
| Archivo | Cambios |
|---|---|
| `modules/proyectos.js` | 5 `fetch()` directos → `api`. Template card inline (31 líneas) → `projectCard()`. `getPayload()` sacado del loop. |

### Calls reemplazadas
| Antes | Después |
|---|---|
| `fetch GET /usuarios?id_rol_fk=2` | `api.get('/usuarios?id_rol_fk=2')` |
| `fetch POST /proyectos` | `api.post('/proyectos', payload)` |
| `fetch GET /proyectos` | `api.get('/proyectos')` |
| `fetch POST /proyectos/:id/finalizar` | `api.post('/proyectos/:id/finalizar', null)` |
| `fetch PUT /proyectos/:id` | `api.put('/proyectos/:id', { estado })` |

### Métricas
- Antes: **215 líneas** — Después: **145 líneas** → **−70 líneas (−33%)**

### Qué queda pendiente
- **Último (mayor riesgo):** Conectar `modules/tareas.js` → `taskCard()` + `taskStatusPill()`. Requiere confirmación explícita.
