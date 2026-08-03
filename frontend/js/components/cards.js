/**
 * components/cards.js
 * --------------------
 * Funciones puras que devuelven strings de HTML para tarjetas (cards) completas.
 *
 * "Pura" significa: misma entrada → misma salida. Sin efectos secundarios,
 * sin acceso al DOM, sin fetch(). Solo construir y devolver HTML.
 *
 * Cada función acepta un objeto de datos y un objeto opcional de opciones/permisos,
 * para no mezclar la lógica de roles con la lógica de renderizado.
 *
 * USO (en futuros módulos refactorizados):
 *   import { projectCard, userCard, taskCard } from '../components/cards.js';
 *
 *   container.innerHTML = proyectos.map(p =>
 *     projectCard(p, { canManage: true })
 *   ).join('');
 *
 * NOTA: Los módulos originales en modules/ siguen funcionando sin cambios.
 *       Este archivo es solo para la futura migración progresiva.
 */

import { projectStatusBadge, statusBadge, availabilityBadge, taskStatusPill } from './badges.js';
import { API_URL } from '../api.js';

// ---------------------------------------------------------------------------
// Helpers privados (no exportados)
// ---------------------------------------------------------------------------

/**
 * Formatea un número como moneda colombiana sin decimales.
 * @param {number} value
 * @returns {string}  "$5,000,000,000"
 */
function formatCurrency(value) {
    return `$${Number(value).toLocaleString('es-CO')}`;
}

/**
 * Devuelve la inicial de un nombre (seguro con null/undefined).
 * @param {string} name
 * @returns {string}
 */
function initial(name) {
    return name ? name[0].toUpperCase() : '?';
}

// ---------------------------------------------------------------------------
// Tarjeta de Proyecto
// ---------------------------------------------------------------------------

/**
 * Renderiza la tarjeta completa de un proyecto.
 *
 * @param {object} p          - Datos del proyecto desde la API
 * @param {object} [opts]     - Opciones de presentación según permisos del usuario
 * @param {boolean} [opts.canManage=false]        - Si el usuario puede cambiar el estado
 * @param {string}  [opts.leaderProjectLinks='']  - HTML adicional de enlaces de líder
 * @returns {string} HTML completo de la tarjeta
 */
export function projectCard(p, opts = {}) {
    const { canManage = false, leaderProjectLinks = '' } = opts;
    const isFin = p.estado === 'finalizado';

    const finalizarBtn = canManage && !isFin
        ? `<button class="btn-danger btn-small" style="padding:6px 12px;" data-action="estado" data-status="finalizado" data-id="${p.id_proyecto}">Finalizar</button>`
        : '';
    const reactivarBtn = canManage && isFin
        ? `<button class="btn-success btn-small" style="padding:6px 12px;" data-action="estado" data-status="activo" data-id="${p.id_proyecto}">Reactivar</button>`
        : '';

    const bannerHTML = p.foto_render_url 
        ? `<div class="project-card-banner" style="background-image: url('${API_URL}${p.foto_render_url}');"></div>`
        : '';

    return `
    <div class="project-card clickable-card" data-id="${p.id_proyecto}">
        ${bannerHTML}
        <div class="project-card-body" style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
                <div>
                    <strong style="color:var(--text); font-size:1.2rem; display:block; margin-bottom:4px;">${p.nombre}</strong>
                    <span style="color:var(--muted); font-size:0.9rem;"><span style="color:var(--primary);">📍</span> ${p.ciudad}</span>
                </div>
                <div>${projectStatusBadge(p.estado)}</div>
            </div>

            <div style="display:flex; justify-content:space-between; gap:20px; flex-wrap:wrap; background:rgba(0,0,0,0.1); padding:12px; border-radius:var(--radius-sm);">
                <div style="flex:1; min-width:150px;">
                    <span style="color:var(--muted); font-size:0.8rem; display:block;">Presupuesto</span>
                    <span style="color:var(--text); font-weight:600; font-size:1.05rem;">${formatCurrency(p.presupuesto)}</span>
                </div>
                <div style="flex:1; min-width:150px;">
                    <span style="color:var(--muted); font-size:0.8rem; display:block;">Líder Asignado</span>
                    <span style="color:var(--text); font-weight:600; font-size:1.05rem;">${p.lider ? p.lider.nombre : 'S/A'}</span>
                </div>
                <div style="flex:1; min-width:150px; text-align:right;">
                    <span style="color:var(--muted); font-size:0.8rem; display:block;">Avance General</span>
                    <span style="color:var(--primary); font-weight:bold; font-size:1.2rem;">${p.avance_general}%</span>
                </div>
            </div>

            <div class="task-actions" style="display:flex; justify-content:flex-end; flex-wrap:wrap; gap:8px;">
                ${finalizarBtn}
                ${reactivarBtn}
                ${leaderProjectLinks}
            </div>
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tarjeta de Usuario
// ---------------------------------------------------------------------------

/**
 * Renderiza la tarjeta completa de un usuario en la vista de gestión.
 *
 * @param {object} u              - Datos del usuario desde la API
 * @param {object} [opts]         - Opciones de presentación
 * @param {string} [opts.roleName='']       - Nombre legible del rol (ej: 'Administrador')
 * @param {string|null} [opts.projectName]  - Nombre del proyecto asignado (null = disponible, undefined = no operario)
 * @returns {string} HTML completo de la tarjeta
 */
export function userCard(u, opts = {}) {
    const { roleName = '', projectName } = opts;

    const activeBadge = statusBadge(u.activo);
    const availBadge  = availabilityBadge(projectName);

    const actionBtn = u.activo
        ? `<button class="btn-danger btn-small" style="padding:6px 12px;" data-action="desactivar" data-id="${u.id_usuario}">Desactivar</button>`
        : `<button class="btn-success btn-small" style="padding:6px 12px;" data-action="reactivar" data-id="${u.id_usuario}">Reactivar</button>`;

    return `
    <div class="user-card ${u.activo ? '' : 'inactive'}">
        <div class="user-details" style="flex:2; min-width:250px;">
            <strong style="color:var(--text); font-size:1.1rem; display:block; margin-bottom:4px;">${u.nombre || ''} ${u.apellido || ''}</strong>
            <span style="color:var(--muted); font-size:0.9rem;">${u.correo || ''} | <span style="color:var(--primary); font-weight:600;">${roleName}</span></span>
        </div>
        <div class="user-role-status" style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:8px;">
            <div>${activeBadge}</div>
            ${availBadge ? `<div>${availBadge}</div>` : ''}
        </div>
        <div class="user-actions flex-row" style="display:flex; gap:8px;">
            <button class="btn-small-muted" style="padding:6px 12px;" data-action="editar" data-id="${u.id_usuario}">Editar</button>
            ${actionBtn}
        </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Tarjeta de Tarea
// ---------------------------------------------------------------------------

/**
 * Renderiza la tarjeta completa de una tarea.
 *
 * @param {object} t           - Datos de la tarea desde la API
 * @param {object} [opts]      - Opciones de presentación según permisos del usuario
 * @param {number} [opts.role]           - Rol del usuario actual (2=líder, 3=operario)
 * @param {string} [opts.projectId='']   - ID del proyecto activo o 'all' para todas las vistas
 * @returns {string} HTML completo de la tarjeta
 */
export function taskCard(t, opts = {}) {
    const { role, projectId = '' } = opts;
    const isLider      = role === 2;
    const isOperario   = role === 3;
    const isProjActive = t.proyecto_estado ? t.proyecto_estado.toLowerCase() !== 'finalizado' : true;

    const statusPill = taskStatusPill(t.estado, t.finalizador_nombre);
    const projectHeader = projectId === 'all'
        ? `<strong>${t.nombre_proyecto || 'S/P'}</strong>`
        : '';

    // Escapar atributos para evitar XSS al pasar datos en data-attributes
    const safeTitle = t.titulo.replace(/'/g, "\\'").replace(/"/g, '&quot;');

    const isReportable = isOperario && t.estado !== 'finalizada' && isProjActive;
    
    const cardAttrs = isReportable 
        ? `class="task-card clickable-card" data-action="reportar" data-id="${t.id_tarea}" data-title="${safeTitle}" data-avance="${t.avance}" data-proyecto="${t.id_proyecto_fk}"`
        : `class="task-card"`;

    const reportarBtn = isReportable
        ? `<button class="btn-primary btn-small" data-action="reportar" data-id="${t.id_tarea}" data-title="${safeTitle}" data-avance="${t.avance}" data-proyecto="${t.id_proyecto_fk}">Reportar</button>`
        : '';

    const reasignarBtn = isLider && t.estado !== 'finalizada' && isProjActive
        ? `<button class="btn-primary btn-small" data-action="reasignar" data-id="${t.id_tarea}" data-proyecto="${t.id_proyecto_fk}" data-operarios='${JSON.stringify(t.operarios_ids || [])}'>Modificar Operarios</button>`
        : '';

    const finalizarBtn = isLider && t.estado !== 'finalizada' && isProjActive
        ? `<button class="btn-success btn-small" data-action="finalizar" data-id="${t.id_tarea}">Finalizar Tarea</button>`
        : '';

    const reactivarBtn = isLider && t.estado === 'finalizada' && isProjActive
        ? `<button class="btn-success btn-small" data-action="reactivar" data-id="${t.id_tarea}">Reactivar</button>`
        : '';

    const historialBtn = `<button class="btn-small-muted" data-action="historial" data-id="${t.id_tarea}">Historial</button>`;

    const operariosText = t.operarios_nombres && t.operarios_nombres.length
        ? t.operarios_nombres.join(', ')
        : 'Sin asignar';

    return `
    <div ${cardAttrs}>
        <div class="task-header">${projectHeader}${statusPill}</div>
        <div class="task-title">${t.titulo}</div>
        <div class="task-meta">
            <span>Avance: ${t.avance}% | Prioridad: ${t.prioridad}</span>
            <span>Equipo: ${operariosText}</span>
        </div>
        <div class="task-actions">
            ${reportarBtn}
            ${historialBtn}
            ${reasignarBtn}
            ${finalizarBtn}
            ${reactivarBtn}
        </div>
    </div>`;
}
