import { API_URL, fetchJSON } from '../api.js';
import { getPayload } from '../auth.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';

let modalProjectMaterials = [];

export async function setupTasksPage() {
    const payload = getPayload();
    if (!payload) return goToLogin();
    const isOperario = payload.role === 3;

    const projectFilter = document.getElementById("projectFilterSelect");
    const projectWrapper = document.getElementById("projectSelectorWrapper");
    
    if (isOperario && projectWrapper) {
        projectWrapper.style.display = "none";
    }

    await cargarSelectProyectosTareas(projectFilter, true);
    
    const params = new URLSearchParams(window.location.search);
    const urlProjectId = params.get("project_id") || "all";
    
    if (urlProjectId !== "all") {
        if (projectFilter) {
            projectFilter.value = urlProjectId;
        }
        if (projectWrapper) {
            projectWrapper.style.display = "none";
        }
        
        // Cargar el nombre del proyecto seleccionado para mostrarlo en el encabezado
        try {
            const pRes = await fetch(`${API_URL}/proyectos/${urlProjectId}`, { headers: getAuthHeaders() });
            if (pRes.ok) {
                const project = await pRes.json();
                const subtitle = document.querySelector(".content-title p");
                if (subtitle) {
                    subtitle.innerHTML = `Tareas asignadas al proyecto <strong>${project.nombre}</strong>.`;
                }
                if (project.estado && project.estado.toLowerCase() === "finalizado") {
                    const btnNewTask = document.getElementById("btnNewTask");
                    if (btnNewTask) btnNewTask.style.display = "none";
                }
            }
        } catch (err) {
            console.error("Error al cargar nombre del proyecto:", err);
        }
    }

    const tasks = await cargarTareas('active', '', urlProjectId);
    
    // Abrir modal automáticamente si viene de un link de "Ver" del dashboard
    const reportTaskId = params.get("report_task_id");
    if (reportTaskId && tasks.length) {
        const task = tasks.find(t => t.id_tarea == reportTaskId);
        if (task) abrirModalReporte(task.id_tarea, task.titulo, task.avance, task.id_proyecto_fk);
    }

    const detailTaskId = params.get("detail_task_id");
    if (detailTaskId) {
        abrirModalDetalleTask(parseInt(detailTaskId));
    }

    if (projectFilter) {
        projectFilter.onchange = () => cargarTareas(document.querySelector("#taskFilters .chip-active").dataset.status, "", projectFilter.value);
    }
    
    document.querySelectorAll("#taskFilters .chip").forEach(chip => {
        chip.onclick = () => { 
            document.querySelectorAll("#taskFilters .chip").forEach(c => c.classList.remove("chip-active")); 
            chip.classList.add("chip-active"); 
            
            if (isOperario && projectWrapper && urlProjectId === "all") {
                if (chip.dataset.status === 'finalizada') {
                    projectWrapper.style.display = "block";
                } else {
                    projectWrapper.style.display = "none";
                    if (projectFilter) projectFilter.value = "all";
                }
            }
            
            cargarTareas(chip.dataset.status, "", projectFilter ? projectFilter.value : "all"); 
        };
    });
    
    if (document.getElementById("btnNewTask")) { 
        document.getElementById("btnNewTask").onclick = async () => { 
            const currentProjId = urlProjectId !== "all" ? urlProjectId : (projectFilter ? projectFilter.value : "all");
            if (currentProjId === "all") {
                alert("Por favor, selecciona un proyecto en el filtro superior antes de crear una tarea.");
                return;
            }
            
            document.getElementById("newTaskModal").style.display = "block"; 
            
            const selectProj = document.getElementById("task_project_id");
            if (selectProj) {
                selectProj.innerHTML = "";
                try {
                    const pRes = await fetch(`${API_URL}/proyectos/${currentProjId}`, { headers: getAuthHeaders() });
                    if (pRes.ok) {
                        const proj = await pRes.json();
                        selectProj.innerHTML = `<option value="${proj.id_proyecto}" selected>${proj.nombre}</option>`;
                    } else {
                        selectProj.innerHTML = `<option value="${currentProjId}" selected>Proyecto #${currentProjId}</option>`;
                    }
                } catch(e) {
                    selectProj.innerHTML = `<option value="${currentProjId}" selected>Proyecto #${currentProjId}</option>`;
                }
                selectProj.disabled = true;
            }
            
            await cargarOperariosPorProyecto(currentProjId);
        }; 
    }
    if (document.getElementById("closeNewTaskModal")) document.getElementById("closeNewTaskModal").onclick = () => document.getElementById("newTaskModal").style.display = "none";
    
    const btnAddMat = document.getElementById("btnModalAddMaterial");
    const materialsList = document.getElementById("modalMaterialsList");
    if (btnAddMat && materialsList) {
        btnAddMat.onclick = () => {
            let div = document.createElement('div');
            div.className = 'mat-item';
            div.style.display = 'flex';
            div.style.gap = '10px';
            div.style.marginBottom = '10px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <select class="mat-id input-borderless" style="flex-grow: 1;">
                    <option value="">¿Qué material?</option>
                </select>
                <input type="number" class="mat-qty input-borderless" placeholder="Cant." style="width: 50px; text-align: center;" min="1">
                <button type="button" class="btn-remove-icon" data-action="remove-mat">✕</button>
            `;
            div.querySelector(".mat-id").onchange = () => actualizarOpcionesMateriales();
            materialsList.appendChild(div);
            actualizarOpcionesMateriales();
        };
    }

    const newTaskForm = document.getElementById("newTaskForm");
    if (newTaskForm) {
        newTaskForm.onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(newTaskForm));
            const ops = Array.from(document.getElementById("taskOperatorsList").querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
            if (!ops.length) return alert("Asigna operarios");
            const projIdSelect = document.getElementById("task_project_id");
            const finalProjId = projIdSelect ? projIdSelect.value : data.id_proyecto_fk;
            const res = await fetch(`${API_URL}/tareas`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...data, id_operarios: ops, id_proyecto_fk: parseInt(finalProjId) }) });
            if (res.ok) { alert("Tarea creada"); document.getElementById("newTaskModal").style.display = "none"; newTaskForm.reset(); cargarTareas(); }
        };
    }
    if (document.getElementById("closeReportModal")) document.getElementById("closeReportModal").onclick = () => document.getElementById("reportModal").style.display = "none";
    const reportForm = document.getElementById("reportForm");
    if (reportForm) {
        reportForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById("report_task_id").value;
            const data = Object.fromEntries(new FormData(reportForm));
            
            // Recolectar materiales del modal
            const matRows = document.querySelectorAll(".mat-item");
            const materiales_usados = [];
            matRows.forEach(row => {
                const mid = row.querySelector(".mat-id").value;
                const mqty = row.querySelector(".mat-qty").value;
                if (mid && mqty) materiales_usados.push({ id_material: parseInt(mid), cantidad: parseInt(mqty) });
            });

            const res = await fetch(`${API_URL}/reportes`, { 
                method: 'POST', 
                headers: getAuthHeaders(), 
                body: JSON.stringify({ 
                    ...data, 
                    id_tarea_fk: parseInt(id), 
                    porcentaje: parseInt(data.porcentaje), 
                    horas_trabajadas: parseFloat(data.horas_trabajadas), 
                    materiales_usados: materiales_usados 
                }) 
            });
            if (res.ok) { alert("Reporte enviado"); document.getElementById("reportModal").style.display = "none"; reportForm.reset(); cargarTareas(); }
            else { const err = await res.json(); alert(err.detail || "Error al enviar"); }
        };
    }

    if (document.getElementById("closeReassignModal")) {
        document.getElementById("closeReassignModal").onclick = () => {
            document.getElementById("reassignModal").style.display = "none";
        };
    }
    const reassignForm = document.getElementById("reassignForm");
    if (reassignForm) {
        reassignForm.onsubmit = async (e) => {
            e.preventDefault();
            const taskId = document.getElementById("reassign_task_id").value;
            const projectId = document.getElementById("reassign_project_id").value;
            const selectedCheckbox = Array.from(document.getElementById("reassignOperatorsList").querySelectorAll('input:checked'));
            const ops = selectedCheckbox.map(cb => parseInt(cb.value));

            if (!ops.length) return alert("Por favor selecciona al menos un operario.");

            try {
                const res = await fetch(`${API_URL}/tareas/${taskId}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ id_operarios: ops })
                });

                if (res.ok) {
                    alert("Operarios reasignados con éxito.");
                    document.getElementById("reassignModal").style.display = "none";
                    reassignForm.reset();
                    cargarTareas(document.querySelector("#taskFilters .chip-active").dataset.status, "", projectFilter ? projectFilter.value : "all");
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo reasignar operarios"));
                }
            } catch (err) {
                console.error("Error de conexión al reasignar:", err);
                alert("Error de conexión");
            }
        };
    }

    renderProjectSubNavigation('tareas');
}

async function cargarSelectProyectosTareas(selectEl, isFilter = true) {
    if (!selectEl) return;
    try {
        const payload = getPayload();
        let projects = [];
        if (payload && payload.role === 3) {
            const tRes = await fetch(`${API_URL}/tareas/mis-tareas`, { headers: getAuthHeaders() });
            if (tRes.ok) {
                const fetchedTasks = await tRes.json();
                const seenProjects = new Map();
                fetchedTasks.forEach(t => {
                    if (t.id_proyecto_fk && t.nombre_proyecto) {
                        seenProjects.set(t.id_proyecto_fk, t.nombre_proyecto);
                    }
                });
                projects = Array.from(seenProjects.entries()).map(([id, nombre]) => ({ id_proyecto: id, nombre: nombre }));
            }
        } else {
            const res = await fetch(`${API_URL}/proyectos?estado=activo`, { headers: getAuthHeaders() });
            if (res.ok) {
                projects = await res.json();
            }
        }
        selectEl.innerHTML = isFilter ? '<option value="all">-- Todos los Proyectos --</option>' : '<option value="">Selecciona un proyecto</option>';
        projects.forEach(p => { selectEl.innerHTML += `<option value="${p.id_proyecto}">${p.nombre}</option>`; });
    } catch (e) { console.error(e); }
}

async function cargarOperariosPorProyecto(projectId) {
    const container = document.getElementById("taskOperatorsList");
    if (!container || !projectId) return;
    try {
        const res = await fetch(`${API_URL}/proyectos/${projectId}/estado-equipo`, { headers: getAuthHeaders() });
        const team = await res.json();
        container.innerHTML = team.length ? "" : "<p>No hay operarios.</p>";
        team.forEach(op => { container.innerHTML += `<div class="flex-row" style="padding:5px;"><input type="checkbox" value="${op.id_usuario}"><span>${op.nombre} ${op.apellido}</span></div>`; });
    } catch (e) { console.error(e); }
}

async function cargarTareas(status = 'active', search = '', projectId = 'all') {
    const container = document.getElementById("tasksList");
    if(!container) return [];
    try {
        const payload = getPayload();
        if (!payload) return [];

        let tasks = [];
        if (payload.role === 3) {
            const tRes = await fetch(`${API_URL}/tareas/mis-tareas`, { headers: getAuthHeaders() });
            if (tRes.ok) {
                let fetchedTasks = await tRes.json();
                if (Array.isArray(fetchedTasks)) {
                    if (projectId !== 'all') {
                        fetchedTasks = fetchedTasks.filter(t => t.id_proyecto_fk == projectId);
                    }
                    tasks = fetchedTasks;
                }
            }
        } else {
            const urlProj = projectId !== 'all' ? `${API_URL}/proyectos` : `${API_URL}/proyectos?estado=activo`;
            const projRes = await fetch(urlProj, { headers: getAuthHeaders() });
            if (projRes.ok) {
                let projects = await projRes.json();
                if (Array.isArray(projects)) {
                    if (projectId !== 'all') projects = projects.filter(p => p.id_proyecto == projectId);
                    for (const p of projects) {
                        const tRes = await fetch(`${API_URL}/proyectos/${p.id_proyecto}/tareas`, { headers: getAuthHeaders() });
                        if (tRes.ok) {
                            const pTasks = await tRes.json();
                            if (Array.isArray(pTasks)) {
                                pTasks.forEach(t => { 
                                    t.nombre_proyecto = p.nombre; 
                                    t.id_proyecto_fk = p.id_proyecto; 
                                    t.proyecto_estado = p.estado;
                                });
                                tasks = tasks.concat(pTasks);
                            }
                        }
                    }
                }
            }
        }

        if (!Array.isArray(tasks)) tasks = [];

        if (status === 'active') {
            tasks = tasks.filter(t => t.estado !== 'finalizada');
        } else if (status !== 'all') {
            tasks = tasks.filter(t => t.estado === status);
        }
        
        // Actualizar KPIs de la página de tareas
        if (document.getElementById("valTareasPendientes")) document.getElementById("valTareasPendientes").textContent = tasks.filter(t => t.estado === 'pendiente').length;
        if (document.getElementById("valTareasEnCurso")) document.getElementById("valTareasEnCurso").textContent = tasks.filter(t => t.estado === 'en_progreso').length;
        if (document.getElementById("valTareasFinalizadas")) document.getElementById("valTareasFinalizadas").textContent = tasks.filter(t => t.estado === 'finalizada').length;

        container.innerHTML = tasks.length ? "" : "<p style='padding:40px; text-align:center;'>Sin tareas.</p>";
        tasks.forEach(t => {
            const sClass = t.estado === 'pendiente' ? 'status-pendiente' : (t.estado === 'en_progreso' ? 'status-en-curso' : 'status-completada');
            const isLider = payload.role === 2;
            const isProjActive = t.proyecto_estado ? t.proyecto_estado.toLowerCase() !== 'finalizado' : true;
            container.innerHTML += `<div class="task-card">
                <div class="task-header"><strong>${t.nombre_proyecto || 'S/P'}</strong><span class="status-pill-task ${sClass}">${t.estado.toUpperCase()} ${t.finalizador_nombre ? `(Por: ${t.finalizador_nombre})` : ''}</span></div>
                <div class="task-title">${t.titulo}</div>
                <div class="task-meta"><span>Avance: ${t.avance}% | Prioridad: ${t.prioridad}</span><span>Equipo: ${t.operarios_nombres && t.operarios_nombres.length ? t.operarios_nombres.join(", ") : 'Sin asignar'}</span></div>
                <div class="task-actions">
                    ${payload.role === 3 && t.estado !== 'finalizada' && isProjActive ? `<button class="btn-primary btn-small" data-action="reportar" data-id="${t.id_tarea}" data-title="${t.titulo.replace(/'/g, "\\'").replace(/"/g, "&quot;")}" data-avance="${t.avance}" data-proyecto="${t.id_proyecto_fk}">Reportar</button>` : ''}
                    <button class="btn-small-muted" data-action="historial" data-id="${t.id_tarea}">Historial</button>
                    ${isLider && t.estado !== 'finalizada' && isProjActive && (!t.operarios_nombres || t.operarios_nombres.length === 0) ? `<button class="btn-primary btn-small" data-action="reasignar" data-id="${t.id_tarea}" data-proyecto="${t.id_proyecto_fk}">Reasignar Operario</button>` : ''}
                    ${isLider && t.estado !== 'finalizada' && isProjActive ? `<button class="btn-success btn-small" data-action="finalizar" data-id="${t.id_tarea}">Finalizar Tarea</button>` : ''}
                    ${isLider && t.estado === 'finalizada' && isProjActive ? `<button class="btn-success btn-small" data-action="reactivar" data-id="${t.id_tarea}">Reactivar</button>` : ''}
                </div></div>`;
        });
        
        // Event delegation
        if (!container.dataset.bound) {
            container.dataset.bound = "true";
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                
                const action = btn.dataset.action;
                const id = parseInt(btn.dataset.id);
                
                if (action === 'reportar') abrirModalReporte(id, btn.dataset.title, parseInt(btn.dataset.avance), parseInt(btn.dataset.proyecto));
                else if (action === 'historial') abrirModalDetalleTask(id);
                else if (action === 'reasignar') abrirModalReasignarOperario(id, parseInt(btn.dataset.proyecto));
                else if (action === 'finalizar') finalizarTarea(id);
                else if (action === 'reactivar') reactivarTarea(id);
            });
        }
        
        return tasks;
                } catch (e) { console.error("CargarTareas error:", e); return []; }
                }

async function finalizarTarea(id) {
    if (confirm("¿Finalizar?")) { const res = await fetch(`${API_URL}/tareas/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ estado: 'finalizada' }) }); if (res.ok) location.reload(); }
}

async function reactivarTarea(id) {
    if (confirm("¿Reabrir?")) { const res = await fetch(`${API_URL}/tareas/${id}`, { method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify({ estado: 'en_progreso' }) }); if (res.ok) location.reload(); }
}

async function abrirModalDetalleTask(id) {
    try {
        const res = await fetch(`${API_URL}/tareas/mis-tareas/${id}`, { headers: getAuthHeaders() });
        if (!res.ok) throw new Error("Error al obtener detalles");
        const t = await res.json();

        document.getElementById("detail_task_title_h2").textContent = t.titulo;
        document.getElementById("detail_total_hours").textContent = `${t.horas_totales}h`;
        document.getElementById("detail_progress").textContent = `${t.avance}%`;

        // Resumen de materiales
        const matSum = document.getElementById("detail_materials_summary");
        matSum.innerHTML = t.materiales_totales.length 
            ? t.materiales_totales.map(m => `<span class="badge badge-inline">${m.nombre_material}: <strong>${m.cantidad_usada} ${m.unidad_medida}</strong></span>`).join('')
            : '<span style="font-size:0.8rem; color:var(--muted);">Sin materiales</span>';

        // Historial de reportes
        const user = await ensureLoggedInUser();
        const userId = user ? user.id_usuario : null;

        const histCont = document.getElementById("detail_reports_history");
        histCont.innerHTML = t.historial_reportes.length
            ? t.historial_reportes.map(r => {
                const canDelete = userId && r.id_operario_fk === userId && t.estado !== 'finalizada';
                return `
                <div class="report-item">
                    <div class="report-item-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                        <div>
                            <strong class="report-date">${new Date(r.fecha_reporte).toLocaleDateString()} ${new Date(r.fecha_reporte).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong>
                            <span class="report-percentage">Avance: ${r.porcentaje}%</span>
                        </div>
                        ${canDelete ? `<button class="btn-danger btn-small" style="padding: 2px 6px; font-size: 0.75rem; width: auto; height: auto; border-radius: 4px;" data-action="eliminar-reporte" data-id="${r.id_reporte}" data-tarea="${id}">Eliminar</button>` : ''}
                    </div>
                    <p class="notification-text" style="margin-bottom:5px;">${r.observaciones || 'Sin observaciones'}</p>
                    <div style="font-size:0.75rem; color:var(--muted);">
                        Horas: <strong>${r.horas_trabajadas}</strong>
                        ${r.materiales_detalles.length ? ` | <span style="color:var(--text);">Materiales: ${r.materiales_detalles.map(md => `${md.nombre_material} (${md.cantidad_usada})`).join(', ')}</span>` : ''}
                    </div>
                </div>
                `;
            }).join('')
            : "<p style='text-align:center; color:var(--muted); padding:20px;'>No hay reportes registrados.</p>";

        document.getElementById("taskDetailModal").style.display = "block";
        
        if (!histCont.dataset.bound) {
            histCont.dataset.bound = "true";
            histCont.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="eliminar-reporte"]');
                if (btn) eliminarReporteAvance(parseInt(btn.dataset.id), parseInt(btn.dataset.tarea));
            });
        }
    } catch (e) {
        console.error(e);
        alert("No se pudo cargar el historial de la tarea.");
    }
}

async function eliminarReporteAvance(idReporte, idTarea) {
    if (confirm("¿Está seguro de que desea eliminar este reporte de avance? El stock de materiales utilizados será restablecido y el progreso de la tarea será recalculado.")) {
        try {
            const res = await fetch(`${API_URL}/reportes/${idReporte}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                alert("Reporte de avance eliminado exitosamente.");
                await abrirModalDetalleTask(idTarea);
                if (typeof cargarTareas === 'function') {
                    cargarTareas();
                }
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "No se pudo eliminar el reporte"));
            }
        } catch (e) {
            console.error("Error al eliminar reporte:", e);
            alert("Error de conexión");
        }
    }
}

async function abrirModalReporte(id, titulo, actual, projectId) {
    document.getElementById("report_task_id").value = id;
    document.getElementById("report_task_title").value = titulo;
    
    // Configurar validación de porcentaje
    const percentageInput = document.getElementById("report_percentage");
    percentageInput.value = actual;
    percentageInput.min = actual; // No permitir reportar menos de lo que ya hay
    
    const badge = document.getElementById("current_progress_badge");
    if (badge) badge.textContent = `Actual: ${actual}%`;
    
    const list = document.getElementById("modalMaterialsList");
    if (list) list.innerHTML = "";
    modalProjectMaterials = [];

    if (projectId) {
        try {
            const res = await fetch(`${API_URL}/inventario/proyecto/${projectId}`, { headers: getAuthHeaders() });
            modalProjectMaterials = res.ok ? await res.json() : [];
        } catch (e) { console.error("Error modal materiales:", e); }
    }

    document.getElementById("reportModal").style.display = "block";
    
    if (list && !list.dataset.bound) {
        list.dataset.bound = "true";
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-mat"]');
            if (btn) {
                btn.parentElement.remove();
                actualizarOpcionesMateriales();
            }
        });
    }
}

function actualizarOpcionesMateriales() {
    const rows = document.querySelectorAll(".mat-item");
    const selectedIds = Array.from(rows)
        .map(row => row.querySelector(".mat-id").value)
        .filter(id => id !== "");

    rows.forEach(row => {
        const select = row.querySelector(".mat-id");
        const currentValue = select.value;

        let optionsHtml = `<option value="">¿Qué material?</option>`;
        modalProjectMaterials.forEach(m => {
            const isSelectedElsewhere = selectedIds.includes(m.id_material_fk.toString()) && m.id_material_fk.toString() !== currentValue;
            if (!isSelectedElsewhere) {
                optionsHtml += `<option value="${m.id_material_fk}" data-unit="${m.unidad_medida}">${m.nombre_material} (Disp: ${m.stock_actual})</option>`;
            }
        });

        select.innerHTML = optionsHtml;
        select.value = currentValue;
    });
}

async function abrirModalReasignarOperario(taskId, projectId) {
    const modal = document.getElementById("reassignModal");
    if (!modal) return;
    document.getElementById("reassign_task_id").value = taskId;
    document.getElementById("reassign_project_id").value = projectId;
    modal.style.display = "block";
    await cargarOperariosParaReasignar(projectId);
}

async function cargarOperariosParaReasignar(projectId) {
    const container = document.getElementById("reassignOperatorsList");
    if (!container) return;
    try {
        container.innerHTML = "<p style='font-size: 0.8rem; color: var(--muted); text-align: center;'>Buscando operarios...</p>";
        
        // Obtener únicamente los operarios ya asignados a este proyecto
        const resProjTeam = await fetch(`${API_URL}/proyectos/${projectId}/estado-equipo`, { headers: getAuthHeaders() });
        const team = await resProjTeam.json();

        container.innerHTML = team.length ? "" : "<p style='font-size: 0.8rem; color: var(--muted); text-align: center;'>No hay operarios vinculados a este proyecto.</p>";
        team.forEach(op => {
            const tareasText = op.en_tarea ? `En tarea(s): ${op.tareas_activas.join(", ")}` : 'Disponible';
            container.innerHTML += `
                <div class="flex-row" style="padding: 8px 5px; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); width: 100%;">
                    <input type="checkbox" value="${op.id_usuario}">
                    <div class="flex-column" style="font-size: 0.85rem; flex-grow: 1; text-align: left;">
                        <strong>${op.nombre} ${op.apellido}</strong>
                        <span style="font-size: 0.75rem; color: var(--muted);">${tareasText}</span>
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error("Error al cargar operarios para reasignar:", e);
        container.innerHTML = "<p style='font-size: 0.8rem; color: var(--danger); text-align: center;'>Error al cargar operarios.</p>";
    }
}

