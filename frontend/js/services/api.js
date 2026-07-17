/**
 * services/api.js
 * ----------------
 * Cliente HTTP centralizado para la capa de servicios.
 *
 * Re-exporta todo lo que ya provee el api.js original para que los módulos
 * nuevos solo necesiten importar desde esta ruta.
 *
 * Añade métodos de conveniencia (get, post, put, patch, del) que:
 *   1. Llaman a fetchJSON (que ya inyecta auth headers y maneja 401)
 *   2. Parsean la respuesta a JSON automáticamente
 *   3. Lanzan un Error descriptivo si la respuesta no es ok
 *
 * USO:
 *   import { api } from '../services/api.js';
 *
 *   const proyectos = await api.get('/proyectos');
 *   const nuevo    = await api.post('/proyectos', { nombre: 'Torre A' });
 *   const updated  = await api.patch('/proyectos/1', { estado: 'finalizado' });
 *   await api.del('/proyectos/1');
 *
 * NOTA: Los archivos originales en modules/ siguen funcionando sin cambios.
 *       Este archivo es exclusivo para los nuevos módulos en services/.
 */

export { API_URL, getAuthHeaders, fetchJSON } from '../api.js';

import { fetchJSON } from '../api.js';

/**
 * Parsea la respuesta y lanza un error claro si el servidor devuelve un error HTTP.
 * @param {Response} res
 * @returns {Promise<any>}
 */
async function parseResponse(res) {
    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            message = body.detail || body.message || message;
        } catch (_) {
            // body no es JSON, usamos el status
        }
        throw new Error(message);
    }

    // 204 No Content u otras respuestas sin cuerpo
    const contentType = res.headers.get('Content-Type') || '';
    if (res.status === 204 || !contentType.includes('application/json')) {
        return null;
    }

    return res.json();
}

/**
 * Objeto cliente con métodos semánticos REST.
 * Todos los métodos devuelven el payload JSON directamente (o null en 204).
 */
export const api = {
    /**
     * GET /endpoint
     * @param {string} endpoint  - Ruta relativa, ej: '/proyectos?estado=activo'
     * @returns {Promise<any>}
     */
    async get(endpoint) {
        const res = await fetchJSON(endpoint);
        return parseResponse(res);
    },

    /**
     * POST /endpoint con body JSON
     * @param {string} endpoint
     * @param {object} body
     * @returns {Promise<any>}
     */
    async post(endpoint, body) {
        const res = await fetchJSON(endpoint, {
            method: 'POST',
            body: JSON.stringify(body),
        });
        return parseResponse(res);
    },

    /**
     * PUT /endpoint con body JSON
     * @param {string} endpoint
     * @param {object} body
     * @returns {Promise<any>}
     */
    async put(endpoint, body) {
        const opts = { method: 'PUT' };
        if (body != null) opts.body = JSON.stringify(body);
        const res = await fetchJSON(endpoint, opts);
        return parseResponse(res);
    },

    /**
     * PATCH /endpoint con body JSON parcial
     * @param {string} endpoint
     * @param {object} body
     * @returns {Promise<any>}
     */
    async patch(endpoint, body) {
        const opts = { method: 'PATCH' };
        if (body != null) opts.body = JSON.stringify(body);
        const res = await fetchJSON(endpoint, opts);
        return parseResponse(res);
    },

    /**
     * DELETE /endpoint
     * Nombrado `del` para evitar conflicto con palabra reservada `delete`.
     * @param {string} endpoint
     * @returns {Promise<any>}
     */
    async del(endpoint) {
        const res = await fetchJSON(endpoint, { method: 'DELETE' });
        return parseResponse(res);
    },

    /**
     * POST /endpoint con FormData (para uploads de archivos)
     * No establece Content-Type; el navegador lo hace automáticamente con el boundary.
     * @param {string} endpoint
     * @param {FormData} formData
     * @returns {Promise<any>}
     */
    async upload(endpoint, formData) {
        const res = await fetchJSON(endpoint, {
            method: 'POST',
            body: formData,
        });
        return parseResponse(res);
    },
};
