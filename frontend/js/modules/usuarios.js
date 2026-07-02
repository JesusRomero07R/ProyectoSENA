import { API_URL, fetchJSON, getAuthHeaders } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';

let cachedUsers = [];

export async function setupUserPage() {
    console.log("setupUserPage: Inicializando filtros...");
    const roleChips = document.querySelectorAll("#roleFilters .chip");
    const availabilityChips = document.querySelectorAll("#availabilityFilters .chip");

    roleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            roleChips.forEach(c => c.classList.remove("chip-active"));
            chip.classList.add("chip-active");
            cargarUsuarios();
        });
    });

    availabilityChips.forEach(chip => {
        chip.addEventListener('click', () => {
            availabilityChips.forEach(c => c.classList.remove("chip-active"));
            chip.classList.add("chip-active");
            cargarUsuarios();
        });
    });

    const search = document.getElementById("userInputSearch");
    if(search) {
        search.addEventListener('input', () => {
            cargarUsuarios();
        });
    }

    cargarUsuarios();
    
    // Configurar event delegation
    const container = document.getElementById("userList");
    if (container && !container.dataset.bound) {
        container.dataset.bound = "true";
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = parseInt(btn.dataset.id);
            
            if (action === 'editar') {
                const u = cachedUsers.find(user => user.id_usuario === id);
                if (u) abrirModalEditarUsuario(u.id_usuario, u.nombre || '', u.apellido || '', u.correo || '', u.telefono || '', u.id_rol_fk);
            } else if (action === 'desactivar') {
                desactivarUsuario(id);
            } else if (action === 'reactivar') {
                reactivarUsuario(id);
            }
        });
    }
    
    // Abrir modal agregar
    const btnAdd = document.getElementById("btnAddUser");
    if(btnAdd) btnAdd.onclick = () => { document.getElementById("userModal").style.display = "block"; document.getElementById("userForm").reset(); };
    if(document.getElementById("closeUserModal")) document.getElementById("closeUserModal").onclick = () => document.getElementById("userModal").style.display = "none";
    if(document.getElementById("closeEditUserModal")) document.getElementById("closeEditUserModal").onclick = () => document.getElementById("editUserModal").style.display = "none";

    // Formulario de agregar
    const userForm = document.getElementById("userForm");
    if (userForm) {
        userForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(userForm));
            // Construir el correo completo
            formData.correo = (formData.correo_prefix || "") + "@constructora-gg.com";
            delete formData.correo_prefix;
            
            // Asegurar tipos correctos
            formData.id_rol_fk = parseInt(formData.id_rol_fk);
            
            try {
                const res = await fetch(`${API_URL}/usuarios`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    toast("Usuario creado correctamente.", 'success');
                    document.getElementById("userModal").style.display = "none";
                    userForm.reset();
                    cargarUsuarios();
                } else {
                    const err = await res.json();
                    toast("Error: " + (err.detail || "No se pudo crear el usuario"), 'error');
                }
            } catch (err) { toast("Error de conexión", 'error'); }
        };
    }

    // Formulario de edición
    const editForm = document.getElementById("editUserForm");
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit_user_id").value;
            const formData = Object.fromEntries(new FormData(editForm));
            
            // Asegurar tipos correctos
            if(formData.id_rol_fk) formData.id_rol_fk = parseInt(formData.id_rol_fk);
            
            // Limpiar password si está vacío para no enviarlo
            if (!formData.password) delete formData.password;

            try {
                const res = await fetch(`${API_URL}/usuarios/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    toast("Usuario actualizado correctamente.", 'success');
                    document.getElementById("editUserModal").style.display = "none";
                    cargarUsuarios();
                } else {
                    const err = await res.json();
                    toast("Error: " + (err.detail || "No se pudo actualizar"), 'error');
                }
            } catch (err) { toast("Error de conexión", 'error'); }
        };
    }
}

async function cargarUsuarios() {
    const container = document.getElementById("userList");
    if(!container) return;

    // Obtener filtros seleccionados de la UI
    const activeRoleChip = document.querySelector("#roleFilters .chip-active");
    const role = activeRoleChip ? activeRoleChip.getAttribute('data-role') : 'all';

    const activeAvailChip = document.querySelector("#availabilityFilters .chip-active");
    const availability = activeAvailChip ? activeAvailChip.getAttribute('data-availability') : 'all';

    const searchInput = document.getElementById("userInputSearch");
    const term = searchInput ? searchInput.value : "";

    console.log(`cargarUsuarios: Cargando con filtros ui -> rol=${role}, disponibilidad=${availability}, term=${term}`);

    try {
        let url = `${API_URL}/usuarios`;
        if (role !== 'all') url += `?id_rol_fk=${role}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Error al cargar usuarios:", res.status);
            return;
        }
        let users = await res.json();
        if (!Array.isArray(users)) {
            console.error("Usuarios cargados no es un array:", users);
            return;
        }
        cachedUsers = users;
        console.log(`cargarUsuarios: Recibidos ${users.length} usuarios`);

        // Cargar proyectos para ver asignaciones reales
        let projects = [];
        try {
            const projRes = await fetch(`${API_URL}/proyectos`, { headers: getAuthHeaders() });
            if (projRes.ok) projects = await projRes.json();
        } catch (projErr) {
            console.error("Error al cargar proyectos para mapeo:", projErr);
        }

        // Mapear id_usuario -> nombre_proyecto para proyectos activos
        const userProjectMap = {};
        if (Array.isArray(projects)) {
            projects.forEach(p => {
                if (p.estado === 'activo') {
                    if (p.id_lider_fk) {
                        userProjectMap[p.id_lider_fk] = p.nombre;
                    }
                    if (Array.isArray(p.id_operarios)) {
                        p.id_operarios.forEach(opId => {
                            userProjectMap[opId] = p.nombre;
                        });
                    }
                }
            });
        }

        // Filtrar por término de búsqueda
        if (term) {
            const t = term.toLowerCase();
            users = users.filter(u => 
                (u.nombre && u.nombre.toLowerCase().includes(t)) || 
                (u.apellido && u.apellido.toLowerCase().includes(t)) || 
                (u.correo && u.correo.toLowerCase().includes(t))
            );
        }

        // Filtrar por disponibilidad
        if (availability !== 'all') {
            users = users.filter(u => {
                if (u.id_rol_fk === 1) return availability === 'free'; // Admins no se asignan a proyectos
                
                const hasProject = !!userProjectMap[u.id_usuario];
                if (availability === 'free') {
                    return !hasProject;
                } else if (availability === 'occupied') {
                    return hasProject;
                }
                return true;
            });
        }

        container.innerHTML = "";
        if (users.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--muted);">No se encontraron usuarios con los filtros seleccionados.</p>`;
            return;
        }

        users.forEach(u => {
            const roleName = u.id_rol_fk === 1 ? "Admin" : (u.id_rol_fk === 2 ? "Líder" : "Operario");
            
            let availabilityTag = '';
            if (u.id_rol_fk === 2 || u.id_rol_fk === 3) {
                const projectName = userProjectMap[u.id_usuario];
                if (projectName) {
                    availabilityTag = `<span class="availability-tag occupied-tag" title="Asignado a: ${projectName}">En Proyecto: <strong>${projectName}</strong></span>`;
                } else {
                    availabilityTag = `<span class="availability-tag free-tag">Disponible / Libre</span>`;
                }
            }

            container.innerHTML += `<div class="user-card ${u.activo ? '' : 'inactive'}" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom:12px; flex-wrap:wrap; gap:15px;">
                <div class="user-details" style="flex:2; min-width:250px;">
                    <strong style="color:var(--text); font-size:1.1rem; display:block; margin-bottom:4px;">${u.nombre || ''} ${u.apellido || ''}</strong>
                    <span style="color:var(--muted); font-size:0.9rem;">${u.correo || ''} | <span style="color:var(--primary); font-weight:600;">${roleName}</span></span>
                </div>
                <div class="user-role-status" style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:8px;">
                    <div><span class="status-tag ${u.activo ? 'badge-status-active' : 'badge-status-inactive'}" style="padding:2px 8px; border-radius:4px; font-weight:bold; color:#fff;">${u.activo ? 'Activo':'Inactivo'}</span></div>
                    ${availabilityTag ? `<div>${availabilityTag}</div>` : ''}
                </div>
                <div class="user-actions flex-row" style="display:flex; gap:8px;">
                    <button class="btn-small-muted" style="padding:6px 12px;" data-action="editar" data-id="${u.id_usuario}">Editar</button>
                    <button class="${u.activo ? 'btn-danger':'btn-success'} btn-small" style="padding:6px 12px;" data-action="${u.activo ? 'desactivar':'reactivar'}" data-id="${u.id_usuario}">${u.activo ? 'Desactivar':'Reactivar'}</button>
                </div>
            </div>`;
        });
    } catch(e) {
        console.error("Error en cargarUsuarios:", e);
    }
}

function abrirModalEditarUsuario(id, nombre, apellido, correo, telefono, role) {
    document.getElementById("edit_user_id").value = id;
    document.getElementById("edit_u_nombre").value = nombre;
    document.getElementById("edit_u_apellido").value = apellido;
    const inputCorreo = document.getElementById("edit_u_correo");
    if(inputCorreo) inputCorreo.value = correo;
    document.getElementById("edit_u_telefono").value = telefono;
    document.getElementById("edit_u_rol").value = role;
    document.getElementById("edit_u_password").value = ""; // Siempre vacío al abrir
    document.getElementById("editUserModal").style.display = "block";
}

async function desactivarUsuario(id) {
    if (confirm("¿Está seguro de que desea desactivar este usuario? Se desvinculará de todos sus proyectos y tareas activos.")) {
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                toast("Usuario desactivado con éxito.", 'success');
                cargarUsuarios();
            } else {
                const err = await res.json();
                toast("Error: " + (err.detail || "No se pudo desactivar el usuario"), 'error');
            }
        } catch (err) {
            console.error("Error al desactivar usuario:", err);
            toast("Error de conexión", 'error');
        }
    }
}

async function reactivarUsuario(id) {
    if (confirm("¿Está seguro de que desea reactivar este usuario?")) {
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}/activar`, {
                method: 'PATCH',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                toast("Usuario reactivado con éxito.", 'success');
                cargarUsuarios();
            } else {
                const err = await res.json();
                toast("Error: " + (err.detail || "No se pudo reactivar el usuario"), 'error');
            }
        } catch (err) {
            console.error("Error al reactivar usuario:", err);
            toast("Error de conexión", 'error');
        }
    }
}

