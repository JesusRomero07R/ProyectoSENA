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

    /**
     * Compresor de imagen usando Canvas
     * @param {File} file - Archivo de imagen original
     * @param {number} maxWidth - Ancho máximo permitido (px)
     * @returns {Promise<File>} - Archivo comprimido
     */
    async compressImage(file, maxWidth = 1000) {
        return new Promise((resolve, reject) => {
            if (!file.type.match(/image.*/)) return resolve(file);
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
                const image = new Image();
                image.onload = () => {
                    let width = image.width;
                    let height = image.height;
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(image, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        const newFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(newFile);
                    }, 'image/jpeg', 0.8);
                };
                image.src = readerEvent.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * Comprime y sube una imagen al backend genérico
     * @param {File} file - El archivo a subir
     * @returns {Promise<string>} - La URL relativa devuelta por el servidor
     */
    async uploadImage(file) {
        const compressed = await this.compressImage(file);
        const fd = new FormData();
        fd.append('file', compressed);
        const res = await this.upload('/upload', fd);
        return res.url;
    }
};
