/**
 * components/badges.js
 * ---------------------
 * Funciones puras que devuelven strings de HTML para badges/etiquetas de estado.
 *
 * "Pura" significa: misma entrada → misma salida. Sin efectos secundarios,
 * sin acceso al DOM, sin fetch(). Solo construir y devolver HTML.
 *
 * REGLA: Nunca agregues `style="color:#fff"` ni colores hardcodeados aquí.
 * Los colores viven en las clases CSS definidas en components.css.
 *
 * USO (en futuros módulos refactorizados):
 *   import { statusBadge, availabilityBadge, taskStatusPill, stockBadge } from '../components/badges.js';
 *
 *   container.innerHTML = `
 *     <div>${statusBadge(usuario.activo)}</div>
 *     <div>${availabilityBadge(projectName)}</div>
 *   `;
 *
 * NOTA: Los módulos originales en modules/ siguen funcionando sin cambios.
 *       Este archivo es solo para la futura migración progresiva.
 */

/**
 * Badge de estado activo/inactivo para usuarios.
 * Clases CSS: badge-status-active / badge-status-inactive (definidas en components.css)
 *
 * @param {boolean} activo - true si el usuario está activo
 * @returns {string} HTML del badge
 *
 * @example
 * statusBadge(true)  → <span class="status-tag badge-status-active">Activo</span>
 * statusBadge(false) → <span class="status-tag badge-status-inactive">Inactivo</span>
 */
export function statusBadge(activo) {
    const cls = activo ? 'badge-status-active' : 'badge-status-inactive';
    const label = activo ? 'Activo' : 'Inactivo';
    return `<span class="status-tag ${cls}">${label}</span>`;
}

/**
 * Badge de estado de un proyecto (activo / finalizado / otro).
 * Usa el texto del estado tal cual llega del backend (en uppercase para display).
 *
 * @param {string} estado - Estado del proyecto ('activo', 'finalizado', etc.)
 * @returns {string} HTML del badge
 *
 * @example
 * projectStatusBadge('activo')     → <span class="status-tag badge-status-active">ACTIVO</span>
 * projectStatusBadge('finalizado') → <span class="status-tag status-tag-finalizado">FINALIZADO</span>
 */
export function projectStatusBadge(estado) {
    const isFin = estado === 'finalizado';
    const cls = isFin ? 'status-tag-finalizado' : 'badge-status-active';
    return `<span class="status-tag ${cls}">${estado.toUpperCase()}</span>`;
}

/**
 * Badge de disponibilidad de un operario (libre / en proyecto).
 * Si se pasa un projectName, muestra "En Proyecto: X"; si no, muestra "Disponible / Libre".
 *
 * @param {string|null} projectName - Nombre del proyecto asignado, o null/undefined si está libre
 * @returns {string} HTML del badge, o string vacío si no hay estado de disponibilidad relevante
 *
 * @example
 * availabilityBadge('Torre A') → <span class="availability-tag occupied-tag" ...>En Proyecto: <strong>Torre A</strong></span>
 * availabilityBadge(null)      → <span class="availability-tag free-tag">Disponible / Libre</span>
 * availabilityBadge()          → '' (sin badge, usuario no es operario)
 */
export function availabilityBadge(projectName) {
    if (projectName === undefined) return ''; // No aplica (admin/líder sin tag)
    if (projectName) {
        return `<span class="availability-tag occupied-tag" title="Asignado a: ${projectName}">En Proyecto: <strong>${projectName}</strong></span>`;
    }
    return `<span class="availability-tag free-tag">Disponible / Libre</span>`;
}

/**
 * Pill de estado de una tarea (pendiente / en_progreso / finalizada).
 * Mapea el estado a una clase CSS semántica.
 *
 * @param {string} estado        - Estado de la tarea
 * @param {string} [finalizador] - Nombre de quien finalizó (opcional)
 * @returns {string} HTML del pill
 *
 * @example
 * taskStatusPill('pendiente')             → <span class="status-pill-task status-pendiente">PENDIENTE</span>
 * taskStatusPill('finalizada', 'Carlos')  → <span class="status-pill-task status-completada">FINALIZADA (Por: Carlos)</span>
 */
export function taskStatusPill(estado, finalizador = '') {
    const clsMap = {
        pendiente:    'status-pendiente',
        en_progreso:  'status-en-curso',
        finalizada:   'status-completada',
    };
    const cls = clsMap[estado] || 'status-pendiente';
    const suffix = finalizador ? ` (Por: ${finalizador})` : '';
    return `<span class="status-pill-task ${cls}">${estado.toUpperCase()}${suffix}</span>`;
}

/**
 * Badge de stock de inventario (stock normal / stock bajo).
 * Muestra la cantidad numérica con una clase que indica si el stock está bajo.
 *
 * @param {number}  cantidad - Cantidad actual en stock
 * @param {boolean} isLow   - true si el stock está por debajo del mínimo
 * @returns {string} HTML del badge
 *
 * @example
 * stockBadge(150, false) → <span class="badge-status-active" ...>150</span>
 * stockBadge(2, true)    → <span class="badge-status-inactive" ...>2</span>
 */
export function stockBadge(cantidad, isLow) {
    const cls = isLow ? 'badge-status-inactive' : 'badge-status-active';
    return `<span class="${cls}" style="padding:2px 8px; border-radius:4px; font-weight:bold;">${cantidad}</span>`;
}

/**
 * Badge genérico inline para listas pequeñas (ej: materiales en historial de tarea).
 *
 * @param {string} content - Contenido HTML interno del badge
 * @returns {string} HTML del badge
 *
 * @example
 * inlineBadge('Cemento: <strong>5 kg</strong>') → <span class="badge badge-inline">Cemento: <strong>5 kg</strong></span>
 */
export function inlineBadge(content) {
    return `<span class="badge badge-inline">${content}</span>`;
}
