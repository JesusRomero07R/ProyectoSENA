import { getPayload, goToLogin } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { perfilService } from '../services/perfil.js';

export async function setupProfilePage() {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("id");
    const token = localStorage.getItem("token");
    if (!token) return goToLogin();
    try {
        const payload = getPayload();
        if (!payload) return goToLogin();
        const myEmail = payload.sub;
        const u = await perfilService.getProfile(targetUserId);

        if (u) {
            const isMyProfile = (u.correo.toLowerCase() === myEmail.toLowerCase());
            console.log("Perfil: ¿Es mi perfil?", isMyProfile, u.correo, myEmail);

            document.getElementById("profile-name").textContent = `${u.nombre} ${u.apellido}`;
            if (document.getElementById("profile-avatar-large")) document.getElementById("profile-avatar-large").textContent = u.nombre[0] + (u.apellido ? u.apellido[0] : '');
            
            document.getElementById("profile-role").textContent = `${u.id_rol_fk === 3 ? 'Operario' : u.id_rol_fk === 2 ? 'Líder' : 'Administrador'} · Miembro ${u.activo ? 'activo' : 'inactivo'}`;
            if(document.getElementById("profile-email")) document.getElementById("profile-email").textContent = u.correo;
            if(document.getElementById("profile-phone")) document.getElementById("profile-phone").textContent = u.telefono || "Sin teléfono";

            const footerActions = document.getElementById("profile-footer-actions");
            const selfActions = document.getElementById("self-actions-container");

            if (!isMyProfile) {
                if (footerActions) footerActions.innerHTML = `<p class="text-subtle-italic">Estás visualizando el perfil público del miembro del equipo.</p>`;
            } else {
                // Personalizar mensaje según rol
                const msgEl = document.getElementById("motivational-msg");
                if (msgEl) {
                    if (u.id_rol_fk === 3) {
                        msgEl.innerHTML = `¡Buen trabajo! Has completado el <span class="profile-highlight">${u.rendimiento || 0}%</span> de tus tareas asignadas.`;
                    } else if (u.id_rol_fk === 2) {
                        msgEl.innerHTML = `Liderando <span class="profile-highlight">${u.proyectos_activos || 0}</span> proyectos activos con éxito.`;
                    } else {
                        msgEl.innerHTML = `Administrando la plataforma de Constructora GG.`;
                    }
                }
                
                if (selfActions) {
                    selfActions.style.display = "block";
                    selfActions.innerHTML = `<button class="btn-primary" id="btnEditProfile">Configuración de cuenta</button>`;
                }
            }

            // Pre-llenar modal siempre que haya datos del usuario
            const elNombre = document.getElementById("edit_nombre");
            const elApellido = document.getElementById("edit_apellido");
            const elTelefono = document.getElementById("edit_telefono");
            if (elNombre)   { elNombre.value   = u.nombre   || ""; elNombre.placeholder   = u.nombre   || "Nombre"; }
            if (elApellido) { elApellido.value = u.apellido || ""; elApellido.placeholder = u.apellido || "Apellido"; }
            if (elTelefono) { elTelefono.value = u.telefono || ""; elTelefono.placeholder = u.telefono || "Sin teléfono registrado"; }

            const btnEdit = document.getElementById("btnEditProfile");
            if (btnEdit) btnEdit.onclick = () => document.getElementById("editProfileModal").style.display = "block";

            // Manejo del Modal de Edición
            const modal = document.getElementById("editProfileModal");
            const closeBtn = document.getElementById("closeEditProfileModal");
            if (closeBtn) closeBtn.onclick = () => modal.style.display = "none";
            
            const editForm = document.getElementById("editProfileForm");
            if (editForm) {
                editForm.onsubmit = async (e) => {
                    e.preventDefault();
                    const formData = Object.fromEntries(new FormData(editForm));
                    
                    // Validación de contraseña
                    const pass = document.getElementById("edit_password").value;
                    const confirm = document.getElementById("edit_password_confirm").value;
                    
                    if (pass) {
                        if (pass.length < 6) return toast("La contraseña debe tener al menos 6 caracteres.", 'warn');
                        if (pass !== confirm) return toast("Las contraseñas no coinciden.", 'warn');
                    } else {
                        delete formData.password; // No enviar si está vacío
                    }

                    try {
                        await perfilService.update(u.id_usuario, formData);
                        toast("Perfil actualizado correctamente.", 'success');
                        if (pass) {
                            toast("Como cambiaste tu contraseña, por seguridad debes iniciar sesión nuevamente.", 'warn');
                            goToLogin();
                        } else {
                            location.reload();
                        }
                    } catch (err) {
                        toast("Error: " + (err.message || "No se pudo actualizar el perfil"), 'error');
                    }
                };
            }
        }
    } catch (e) { console.error("Perfil:", e); }
}

