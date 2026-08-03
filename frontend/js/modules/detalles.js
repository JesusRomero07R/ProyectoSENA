import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { exportarProyectoPDF } from './pdf.js';
import { api, API_URL } from '../services/api.js';

export async function setupProjectDetailPage() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;
    const btn = document.getElementById("btnManageTeam");
    if (btn) btn.onclick = async () => { 
        document.getElementById("teamModal").style.display = "block"; 
        await cargarOperariosDisponibles(id); 
    };
    if (document.getElementById("closeTeamModal")) document.getElementById("closeTeamModal").onclick = () => document.getElementById("teamModal").style.display = "none";
    const form = document.getElementById("teamForm");
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const ids = Array.from(document.getElementById("availableOperatorsList").querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
            try {
                await api.post('/proyectos/configurar-equipo', { id_proyecto: parseInt(id), id_usuarios: ids });
                toast("Equipo actualizado correctamente.", 'success');
                document.getElementById("teamModal").style.display = "none";
                cargarEquipoProyecto(id);
            } catch (err) { toast("Error: " + (err.message || "No se pudo actualizar el equipo"), 'error'); }
        };
    }
    const btnPDF = document.getElementById("btnGenerarPDF");
    if (btnPDF) {
        btnPDF.onclick = () => exportarProyectoPDF(id);
    }
    
    renderProjectSubNavigation('detalles');

    await refrescarDetallesProyecto(id);
}

async function refrescarDetallesProyecto(id) {
    try {
        const p = await api.get(`/proyectos/${id}`);
        if (p) {
            const headerContainer = document.getElementById("projectHeaderContainer");
            if (headerContainer) {
                const oldBanner = headerContainer.querySelector('.project-header-detail-banner');
                if (oldBanner) oldBanner.remove();

                if (p.foto_render_url) {
                    headerContainer.classList.add('has-banner');
                    const banner = document.createElement('div');
                    banner.className = 'project-header-detail-banner';
                    banner.style.backgroundImage = `url('${API_URL}${p.foto_render_url}')`;
                    headerContainer.insertBefore(banner, headerContainer.firstChild);
                } else {
                    headerContainer.classList.remove('has-banner');
                }
            }

            document.getElementById("detNombre").textContent = p.nombre;
            document.getElementById("detEstado").textContent = p.estado;
            document.getElementById("detAvance").textContent = `${p.avance_general}%`;
            const payload = getPayload();
            const isAdmin = payload && payload.role === 1;
            const isProjectActive = p.estado.toLowerCase() !== 'finalizado';

            let liderHtml = p.lider ? `${p.lider.nombre} ${p.lider.apellido}` : 'No asignado';
            if (isAdmin && isProjectActive) {
                liderHtml += ` <button id="btnChangeLider" class="btn-ghost btn-sm" style="padding:0 5px; font-size:0.8rem; margin-left:5px; color:var(--primary);">✏️ Cambiar</button>`;
            }
            document.getElementById("detLider").innerHTML = liderHtml;

            const btnChangeLider = document.getElementById("btnChangeLider");
            if (btnChangeLider) {
                btnChangeLider.onclick = async () => {
                    try {
                        const leaders = await api.get('/usuarios?id_rol_fk=2');
                        const options = leaders.map(l => `<option value="${l.id_usuario}" ${p.id_lider_fk === l.id_usuario ? 'selected' : ''}>${l.nombre} ${l.apellido}</option>`).join('');
                        
                        document.getElementById("detLider").innerHTML = `
                            <select id="selNewLider" style="padding:2px 4px; font-size:0.85rem; border-radius:4px; border:1px solid var(--border); background:var(--bg-card); color:var(--text);">
                                <option value="">-- Seleccionar --</option>
                                ${options}
                            </select> 
                            <button id="btnSaveLider" style="background:none; border:none; color:var(--success); cursor:pointer; font-size:1rem; margin-left:4px;">✓</button> 
                            <button id="btnCancelLider" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:1rem; margin-left:4px;">✕</button>
                        `;
                        
                        document.getElementById("btnCancelLider").onclick = () => refrescarDetallesProyecto(id);
                        document.getElementById("btnSaveLider").onclick = async () => {
                            const newLiderId = document.getElementById("selNewLider").value;
                            if (!newLiderId) return;
                            try {
                                await api.put(`/proyectos/${id}`, { id_lider_fk: parseInt(newLiderId) });
                                import('../toast.js').then(m => m.toast("Líder actualizado", "success"));
                                refrescarDetallesProyecto(id);
                            } catch (e) {
                                import('../toast.js').then(m => m.toast("Error al cambiar líder", "error"));
                            }
                        };
                    } catch (e) { console.error(e); }
                };
            }

            document.getElementById("detPresupuesto").textContent = `$${p.presupuesto.toLocaleString()}`;
            
            // Ocultar botón de asignación de equipo si el proyecto está finalizado o el usuario no es Admin
            const btnManageTeam = document.getElementById("btnManageTeam");
            if (btnManageTeam) {
                btnManageTeam.style.display = (isProjectActive && isAdmin) ? "block" : "none";
            }

            await cargarTareasProyecto(id, isProjectActive);
            await cargarEquipoProyecto(id, isProjectActive);
            await cargarInventarioProyecto(id);

            // Generar botón de Finalizar/Reactivar Proyecto si es Admin o Líder
            if (payload && (payload.role === 1 || payload.role === 2)) {
                // Eliminar botón previo si existe
                const existingBtn = document.getElementById("btnToggleProjectState");
                if (existingBtn) existingBtn.remove();

                const actionsContainer = document.getElementById("projectDetailActions");
                if (actionsContainer) {
                    const toggleBtn = document.createElement("button");
                    toggleBtn.id = "btnToggleProjectState";
                    
                    const isFinished = p.estado.toLowerCase() === 'finalizado';
                    if (isFinished) {
                        toggleBtn.className = "btn-success";
                        toggleBtn.textContent = "Reactivar Proyecto";
                        toggleBtn.onclick = () => abrirModalConfirmacionEstado(p.id_proyecto, p.nombre, 'activo');
                    } else {
                        toggleBtn.className = "btn-danger";
                        toggleBtn.textContent = "Finalizar Proyecto";
                        toggleBtn.onclick = () => abrirModalConfirmacionEstado(p.id_proyecto, p.nombre, 'finalizado');
                    }
                    toggleBtn.style.height = "41px";
                    toggleBtn.style.display = "inline-flex";
                    toggleBtn.style.alignItems = "center";
                    toggleBtn.style.gap = "6px";
                    actionsContainer.appendChild(toggleBtn);
                }
            }

            if (payload && payload.role === 1) {
                const actionsContainer = document.getElementById("projectDetailActions");
                if (actionsContainer && !document.getElementById("btnUpdateRender")) {
                    const btnUploadRender = document.createElement("button");
                    btnUploadRender.id = "btnUpdateRender";
                    btnUploadRender.className = "btn-outline";
                    btnUploadRender.innerHTML = `<span class="icon">🖼️</span> Cambiar Render`;
                    btnUploadRender.style.height = "41px";
                    btnUploadRender.style.display = "inline-flex";
                    btnUploadRender.style.alignItems = "center";
                    btnUploadRender.style.gap = "6px";
                    
                    const fileInput = document.createElement("input");
                    fileInput.type = "file";
                    fileInput.accept = "image/*";
                    fileInput.style.display = "none";
                    
                    btnUploadRender.onclick = () => fileInput.click();
                    
                    fileInput.onchange = async (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        try {
                            const url = await api.uploadImage(file);
                            await api.put(`/proyectos/${id}`, { foto_render_url: url });
                            import('../toast.js').then(m => m.toast("Render actualizado", "success"));
                            refrescarDetallesProyecto(id);
                        } catch (err) {
                            console.error(err);
                            import('../toast.js').then(m => m.toast("Error al actualizar render", "error"));
                        }
                    };
                    
                    actionsContainer.appendChild(fileInput);
                    actionsContainer.appendChild(btnUploadRender);
                }
            }
        }
    } catch (e) { console.error(e); }
}

function abrirModalConfirmacionEstado(id, nombre, nuevoEstado) {
    const modal = document.getElementById("confirmStateModal");
    if (!modal) return;

    const titleEl = document.getElementById("confirmModalTitle");
    const msgEl = document.getElementById("confirmModalMessage");
    const checkEl = document.getElementById("confirmDoubleCheck");
    const btnExecute = document.getElementById("btnExecuteConfirm");
    const btnCancel = document.getElementById("btnCancelConfirm");
    const btnClose = document.getElementById("closeConfirmModal");

    // Limpiar estado previo
    checkEl.checked = false;
    btnExecute.disabled = true;

    // Configurar textos dinámicos
    if (nuevoEstado === 'finalizado') {
        titleEl.textContent = "Finalizar Proyecto";
        msgEl.innerHTML = `¿Está seguro de que desea <strong>FINALIZAR</strong> el proyecto <strong>"${nombre}"</strong>?<br><br>Esto marcará el proyecto como completado y limitará las tareas activas.`;
        btnExecute.className = "btn-danger";
        btnExecute.textContent = "Confirmar Finalización";
    } else {
        titleEl.textContent = "Reactivar Proyecto";
        msgEl.innerHTML = `¿Está seguro de que desea <strong>REACTIVAR</strong> el proyecto <strong>"${nombre}"</strong>?<br><br>El proyecto volverá a estar en estado activo y se podrán gestionar tareas.`;
        btnExecute.className = "btn-success";
        btnExecute.textContent = "Confirmar Reactivación";
    }

    // Doble validación: habilitar el botón solo al marcar el checkbox
    checkEl.onchange = () => {
        btnExecute.disabled = !checkEl.checked;
    };

    // Funciones de cierre
    const cerrar = () => {
        modal.style.display = "none";
    };

    btnCancel.onclick = cerrar;
    btnClose.onclick = cerrar;
    
    // Ejecutar acción al confirmar
        btnExecute.onclick = async () => {
        try {
            if (nuevoEstado === 'finalizado') {
                await api.post(`/proyectos/${id}/finalizar`, null);
            } else {
                await api.put(`/proyectos/${id}`, { estado: nuevoEstado });
            }
            toast(`Proyecto marcado como ${nuevoEstado.toUpperCase()} exitosamente.`, 'success');
            cerrar();
            refrescarDetallesProyecto(id);
        } catch (err) {
            console.error("Error al cambiar estado de proyecto:", err);
            toast("Error: " + (err.message || "No se pudo cambiar el estado del proyecto"), 'error');
        }
    };

    modal.style.display = "block";
}

async function cargarTareasProyecto(id, isProjectActive = true) {
    const tCont = document.getElementById("listadoTareas");
    if (!tCont) return;
    try {
        const tasks = await api.get(`/proyectos/${id}/tareas`);
        const payload = getPayload();
        if (!payload) return goToLogin();
        tCont.innerHTML = tasks.length ? "" : "<p>No hay tareas.</p>";
        tasks.forEach(t => {
            const tieneOperarios = t.operarios_nombres && t.operarios_nombres.length > 0;
            const sinOperario = !tieneOperarios && t.estado !== 'finalizada';
            const operarios = tieneOperarios ? t.operarios_nombres.join(', ') : (sinOperario ? '<span style="color: #dc2626; font-weight: 700;">Sin asignar</span>' : 'Sin asignar');
            const avance = t.avance !== undefined ? t.avance : 0;
            tCont.innerHTML += `<div class="list-item clickable-card" style="cursor: pointer;" data-action="navigate-tarea" data-tarea="${t.id_tarea}"><div><strong>${t.titulo}</strong><br><small>${t.estado.toUpperCase()} ${t.finalizador_nombre ? `(Por: ${t.finalizador_nombre})` : ''}</small><br><small><strong>Asignado a:</strong> ${operarios} | <strong>Avance:</strong> ${avance}%</small></div><div class="flex-row">${sinOperario ? '<span style="color: #dc2626; background-color: #fef2f2; border: 1px solid #fee2e2; padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-right: 8px;">⚠️ SIN OPERARIO</span>' : ''}<span class="badge-inline">${t.prioridad.toUpperCase()}</span></div></div>`;
        });
        
        if (!tCont.dataset.bound) {
            tCont.dataset.bound = "true";
            tCont.addEventListener('click', (e) => {
                const card = e.target.closest('[data-action="navigate-tarea"]');
                if (card) window.location.href = `tareas.html?project_id=${id}&detail_task_id=${card.dataset.tarea}`;
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarEquipoProyecto(id, isProjectActive = true) {
    const eCont = document.getElementById("listadoEquipo");
    if (!eCont) return;
    try {
        const team = await api.get(`/proyectos/${id}/estado-equipo`);
        const payload = getPayload();
        const canManage = payload && payload.role !== 3 && isProjectActive;
        eCont.innerHTML = team.length ? "" : "<p>Sin personal.</p>";
        team.forEach(e => {
            const tareasText = e.tareas_activas && e.tareas_activas.length ? `En: ${e.tareas_activas.join(", ")}` : 'Disponible';
            const btn = canManage ? `<button data-action="desvincular" data-user="${e.id_usuario}" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.8rem;font-weight:bold;">✕ Quitar</button>` : '';
            eCont.innerHTML += `<div class="list-item" style="display:flex; justify-content:space-between; align-items:center;"><div><strong>${e.nombre} ${e.apellido}</strong><br><small class="${e.en_tarea ? 'badge-status-inactive' : 'badge-status-active'}">${tareasText}</small></div>${btn}</div>`;
        });
        if (!eCont.dataset.bound) {
            eCont.dataset.bound = "true";
            eCont.addEventListener('click', e => {
                if (e.target.dataset.action === "desvincular") desvincularOperario(id, e.target.dataset.user);
            });
        }
    } catch (e) { console.error(e); }
}

async function cargarInventarioProyecto(id) {
    const iCont = document.getElementById("listadoInventario");
    if (!iCont) return;
    try {
        const inv = await api.get(`/inventario/proyecto/${id}`);
        iCont.innerHTML = inv.length ? "" : "<p>Sin materiales.</p>";
        inv.forEach(i => iCont.innerHTML += `<div class="list-item"><div><strong>${i.nombre_material}</strong></div><span>${i.stock_actual} ${i.unidad_medida}</span></div>`);
    } catch (e) { console.error(e); }
}

async function desvincularOperario(projectId, userId) {
    if (confirm("¿Sacar del proyecto?")) {
        try {
            await api.del(`/proyectos/${projectId}/equipo/${userId}`);
            toast("Operario desvinculado.", 'success');
            await refrescarDetallesProyecto(projectId);
        } catch (e) { toast("Error: " + (e.message || "No se pudo desvincular"), 'error'); }
    }
}

async function cargarOperariosDisponibles(currentProjectId) {
    const container = document.getElementById("availableOperatorsList");
    if(!container) return;
    try {
        const disponibles = await api.get('/usuarios/operarios-disponibles');
        container.innerHTML = disponibles.length ? "" : "<p>No hay operarios disponibles.</p>";
        disponibles.forEach(op => {
            container.innerHTML += `
                <div class="notification-card">
                    <input type="checkbox" value="${op.id_usuario}">
                    <div class="flex-column">
                        <span class="notification-title">${op.nombre} ${op.apellido}</span>
                        <span class="notification-text">${op.correo}</span>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

