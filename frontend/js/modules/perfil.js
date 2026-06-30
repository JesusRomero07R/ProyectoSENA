import { API_URL, fetchJSON } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';

export async function setupProfilePage() {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get("id");
    const token = localStorage.getItem("access_token");
    if (!token) return goToLogin();
    try {
        const payload = getPayload();
        if (!payload) return goToLogin();
        const myEmail = payload.sub;
        let url = targetUserId ? `${API_URL}/usuarios/${targetUserId}` : `${API_URL}/usuarios/me`;
        
        const resUser = await fetch(url, { headers: getAuthHeaders() });
        const u = await resUser.json();

        if (resUser.ok) {
            const isMyProfile = (u.correo.toLowerCase() === myEmail.toLowerCase());
            console.log("Perfil: ¿Es mi perfil?", isMyProfile, u.correo, myEmail);

            document.getElementById("profile-name").textContent = `${u.nombre} ${u.apellido}`;
            if (document.getElementById("profile-avatar-large")) document.getElementById("profile-avatar-large").textContent = u.nombre[0] + (u.apellido ? u.apellido[0] : '');
            
            // Actualizar etiquetas según rol
            const labelTasks = document.getElementById("label-kpi-tasks");
            const labelCompleted = document.getElementById("label-kpi-completed");
            const labelProjects = document.getElementById("label-kpi-projects");
            const labelPerformance = document.getElementById("label-kpi-performance");
            const kpiDesc = document.getElementById("kpi-desc");

            if (u.id_rol_fk === 1) { // ADMIN
                if(labelTasks) labelTasks.textContent = "Usuarios Activos";
                if(labelCompleted) labelCompleted.textContent = "Proyectos Terminados";
                if(labelProjects) labelProjects.textContent = "Proyectos Activos";
                if(labelPerformance) labelPerformance.textContent = "Avance Global";
                if(kpiDesc) kpiDesc.textContent = "Promedio de avance en todas las obras";
            } else if (u.id_rol_fk === 2) { // LIDER
                if(labelTasks) labelTasks.textContent = "Tareas a Cargo";
                if(labelCompleted) labelCompleted.textContent = "Tareas Finalizadas";
                if(labelProjects) labelProjects.textContent = "Mis Proyectos";
                if(labelPerformance) labelPerformance.textContent = "Eficiencia Obra";
                if(kpiDesc) kpiDesc.textContent = "Avance promedio de sus proyectos";
            } else { // OPERARIO
                if(labelTasks) labelTasks.textContent = "Tareas Totales";
                if(labelCompleted) labelCompleted.textContent = "Completadas";
                if(labelProjects) labelProjects.textContent = "Proyectos en curso";
                if(labelPerformance) labelPerformance.textContent = "Rendimiento (KPI)";
                if(kpiDesc) kpiDesc.textContent = "Tareas completadas vs totales";
            }

            document.getElementById("profile-role").textContent = `${u.id_rol_fk === 3 ? 'Operario' : u.id_rol_fk === 2 ? 'Líder' : 'Administrador'} · Miembro ${u.activo ? 'activo' : 'inactivo'}`;
            document.getElementById("profile-email").textContent = u.correo;
            document.getElementById("profile-phone").textContent = u.telefono || "Sin teléfono";
            document.getElementById("kpi-tasks").textContent = u.tareas_totales || 0;
            document.getElementById("kpi-completed").textContent = u.tareas_completadas || 0;
            document.getElementById("kpi-projects").textContent = u.proyectos_activos || 0;
            document.getElementById("kpi-performance").textContent = `${u.rendimiento || 0}%`;

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
                
                const btnEdit = document.getElementById("btnEditProfile");
                if (btnEdit) {
                    btnEdit.onclick = () => {
                        document.getElementById("edit_nombre").value = u.nombre;
                        document.getElementById("edit_apellido").value = u.apellido;
                        document.getElementById("edit_telefono").value = u.telefono || "";
                        document.getElementById("editProfileModal").style.display = "block";
                    };
                }
            }

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
                        if (pass.length < 6) return alert("La contraseña debe tener al menos 6 caracteres.");
                        if (pass !== confirm) return alert("Las contraseñas no coinciden.");
                    } else {
                        delete formData.password; // No enviar si está vacío
                    }

                    try {
                        const res = await fetch(`${API_URL}/usuarios/${u.id_usuario}`, {
                            method: 'PUT',
                            headers: getAuthHeaders(),
                            body: JSON.stringify(formData)
                        });
                        if (res.ok) {
                            alert("Perfil actualizado correctamente.");
                            if (pass) {
                                alert("Como cambiaste tu contraseña, por seguridad debes iniciar sesión nuevamente.");
                                goToLogin();
                            } else {
                                location.reload();
                            }
                        } else {
                            const err = await res.json();
                            alert("Error: " + (err.detail || "No se pudo actualizar el perfil"));
                        }
                    } catch (err) {
                        alert("Error de conexión al actualizar perfil");
                    }
                };
            }
        }
    } catch (e) { console.error("Perfil:", e); }
}

