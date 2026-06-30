import { API_URL, fetchJSON } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';

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
                const res = await fetch(`${API_URL}/proyectos/configurar-equipo`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify({ id_proyecto: parseInt(id), id_usuarios: ids }) 
                });
                if (res.ok) { 
                    alert("Equipo actualizado correctamente."); 
                    document.getElementById("teamModal").style.display = "none"; 
                    cargarEquipoProyecto(id); 
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo actualizar el equipo"));
                }
            } catch (err) { alert("Error de conexión"); }
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
        const res = await fetch(`${API_URL}/proyectos/${id}`, { headers: getAuthHeaders() });
        const p = await res.json();
        if (res.ok) {
            document.getElementById("detNombre").textContent = p.nombre;
            document.getElementById("detEstado").textContent = p.estado;
            document.getElementById("detAvance").textContent = `${p.avance_general}%`;
            document.getElementById("detLider").textContent = p.lider ? `${p.lider.nombre} ${p.lider.apellido}` : 'No asignado';
            document.getElementById("detPresupuesto").textContent = `$${p.presupuesto.toLocaleString()}`;
            const isProjectActive = p.estado.toLowerCase() !== 'finalizado';
            
            // Ocultar botón de asignación de equipo si el proyecto está finalizado o el usuario no es Admin
            const payload = getPayload();
            const isAdmin = payload && payload.role === 1;
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
            let url = `${API_URL}/proyectos/${id}`;
            let method = 'PUT';
            let body = JSON.stringify({ estado: nuevoEstado });

            if (nuevoEstado === 'finalizado') {
                url = `${API_URL}/proyectos/${id}/finalizar`;
                method = 'POST';
                body = null;
            }

            const res = await fetch(url, {
                method: method,
                headers: getAuthHeaders(),
                body: body
            });

            if (res.ok) {
                alert(`Proyecto marcado como ${nuevoEstado.toUpperCase()} exitosamente.`);
                cerrar();
                // Recargar detalles
                refrescarDetallesProyecto(id);
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "No se pudo cambiar el estado del proyecto"));
            }
        } catch (err) {
            console.error("Error al cambiar estado de proyecto:", err);
            alert("Error de conexión al servidor.");
        }
    };

    modal.style.display = "block";
}

async function cargarTareasProyecto(id, isProjectActive = true) {
    const tCont = document.getElementById("listadoTareas");
    if (!tCont) return;
    try {
        const res = await fetch(`${API_URL}/proyectos/${id}/tareas`, { headers: getAuthHeaders() });
        const tasks = await res.json();
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
        const res = await fetch(`${API_URL}/proyectos/${id}/estado-equipo`, { headers: getAuthHeaders() });
        const team = await res.json();
        eCont.innerHTML = team.length ? "" : "<p>Sin personal.</p>";
        team.forEach(e => {
            const tareasText = e.tareas_activas && e.tareas_activas.length ? `En: ${e.tareas_activas.join(", ")}` : 'Disponible';
            eCont.innerHTML += `<div class="list-item"><div><strong>${e.nombre} ${e.apellido}</strong><br><small class="${e.en_tarea ? 'badge-status-inactive' : 'badge-status-active'}">${tareasText}</small></div></div>`;
        });
    } catch (e) { console.error(e); }
}

async function cargarInventarioProyecto(id) {
    const iCont = document.getElementById("listadoInventario");
    if (!iCont) return;
    try {
        const res = await fetch(`${API_URL}/inventario/proyecto/${id}`, { headers: getAuthHeaders() });
        const inv = await res.json();
        iCont.innerHTML = inv.length ? "" : "<p>Sin materiales.</p>";
        inv.forEach(i => iCont.innerHTML += `<div class="list-item"><div><strong>${i.nombre_material}</strong></div><span>${i.stock_actual} ${i.unidad_medida}</span></div>`);
    } catch (e) { console.error(e); }
}

async function desvincularOperario(projectId, userId) {
    if (confirm("¿Sacar del proyecto?")) {
        try {
            const res = await fetch(`${API_URL}/proyectos/${projectId}/equipo/${userId}`, { method: 'DELETE', headers: getAuthHeaders() });
            if (res.ok) {
                alert("Operario desvinculado.");
                await refrescarDetallesProyecto(projectId);
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "No se pudo desvincular"));
            }
        } catch (e) { alert("Error de conexión"); }
    }
}

async function cargarOperariosDisponibles(currentProjectId) {
    const container = document.getElementById("availableOperatorsList");
    if(!container) return;
    try {
        // 1. Obtener operarios libres (sin proyecto activo)
        const resDisp = await fetch(`${API_URL}/usuarios/operarios-disponibles`, { headers: getAuthHeaders() });
        const disponibles = await resDisp.json();

        // 2. Obtener operarios ya asignados a este proyecto para mantenerlos marcados
        const resProj = await fetch(`${API_URL}/proyectos/${currentProjectId}`, { headers: getAuthHeaders() });
        const proyecto = await resProj.json();
        const asignadosIds = proyecto.id_operarios || [];

        // 3. Obtener nombres de los ya asignados (usamos /usuarios?id_rol_fk=3 para todos los operarios)
        const resAll = await fetch(`${API_URL}/usuarios?id_rol_fk=3`, { headers: getAuthHeaders() });
        const todos = await resAll.json();
        const misAsignados = todos.filter(u => asignadosIds.includes(u.id_usuario));

        // Combinar listas sin duplicados
        const listaCompleta = [...disponibles];
        misAsignados.forEach(a => {
            if (!listaCompleta.find(l => l.id_usuario === a.id_usuario)) listaCompleta.push(a);
        });

        container.innerHTML = listaCompleta.length ? "" : "<p>No hay operarios disponibles.</p>";
        listaCompleta.forEach(op => {
            const isChecked = asignadosIds.includes(op.id_usuario) ? "checked" : "";
            container.innerHTML += `
                <div class="notification-card">
                    <input type="checkbox" value="${op.id_usuario}" ${isChecked}>
                    <div class="flex-column">
                        <span class="notification-title">${op.nombre} ${op.apellido}</span>
                        <span class="notification-text">${op.correo}</span>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

