/**
 * services/perfil.js
 * -------------------
 * Capa de comunicación con la API exclusiva para el dominio "Perfil de usuario".
 *
 * Responsabilidad única: peticiones HTTP. Sin lógica de DOM ni de negocio.
 *
 * USO (en el futuro módulo refactorizado):
 *   import { perfilService } from '../services/perfil.js';
 *
 *   const usuario = await perfilService.getMe();
 *   const usuario = await perfilService.getById(42);
 *   await perfilService.update(42, { nombre: 'Carlos', telefono: '300...' });
 *   await perfilService.update(42, { nombre: 'Carlos', password: 'nueva123' });
 *
 * NOTA: El módulo original modules/perfil.js sigue funcionando sin cambios.
 *       Este archivo es solo la capa de datos para la futura migración.
 */

import { api } from './api.js';

export const perfilService = {
    /**
     * Obtiene el perfil del usuario autenticado (el propio).
     * Equivale a: GET /usuarios/me
     * @returns {Promise<object>} Datos del usuario
     */
    async getMe() {
        return api.get('/usuarios/me');
    },

    /**
     * Obtiene el perfil de cualquier usuario por su ID.
     * Equivale a: GET /usuarios/:id
     * @param {number|string} id - ID del usuario
     * @returns {Promise<object>} Datos del usuario
     */
    async getById(id) {
        return api.get(`/usuarios/${id}`);
    },

    /**
     * Obtiene el perfil correcto según contexto:
     * - Si se pasa un ID, devuelve ese usuario (vista de admin/líder mirando otro perfil).
     * - Si no se pasa ID, devuelve el usuario autenticado.
     *
     * Encapsula la lógica de selección de URL que actualmente vive en el módulo.
     *
     * @param {string|null} targetId - ID del usuario objetivo, o null para "mi perfil"
     * @returns {Promise<object>} Datos del usuario
     */
    async getProfile(targetId = null) {
        return targetId ? this.getById(targetId) : this.getMe();
    },

    /**
     * Actualiza los datos de un usuario.
     * Equivale a: PUT /usuarios/:id
     *
     * El campo `password` solo debe incluirse en el objeto si el usuario
     * quiere cambiarla. La validación (longitud, confirmación) sigue siendo
     * responsabilidad del módulo de UI, no de este servicio.
     *
     * @param {number|string} id   - ID del usuario a actualizar
     * @param {object}        data - Campos a actualizar (nombre, apellido, telefono, password?)
     * @returns {Promise<object>}  Usuario actualizado
     */
    async update(id, data) {
        return api.put(`/usuarios/${id}`, data);
    },
};
