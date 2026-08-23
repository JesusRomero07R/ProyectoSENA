import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation } from '../ui.js';
import { toast } from '../toast.js';
import { api } from '../services/api.js';
import { taskCard } from '../components/cards.js';
import { abrirModalDetalleTask } from './modal-historial.js';
import { abrirModalReporte, actualizarOpcionesMateriales, abrirModalReasignarOperario } from './modal-reporte.js';

export async function setupTasksPage() {
    const payload = getPayload();
    if (!payload) return goToLogin();
    const isOperario = payload.role === 3;

    const projectFilter = document.getElementById('projectFilterSelect');
    const projectWrapper = document.getElementById('projectSelectorWrapper');

    if (isOperario && projectWrapper) projectWrapper.style.display = 'none';

    await cargarSelectProyectosTareas(projectFilter, true);

    const params = new URLSearchParams(window.location.search);
    const urlProjectId = params.get('project_id') || 'all';

    if (urlProjectId !== 'all') {
        if (projectFilter) projectFilter.value = urlProjectId;
        if (projectWrapper) projectWrapper.style.display = 'none';
        try {
            const project = await api.get(`/proyectos/${urlProjectId}`);
            const subtitle = document.querySelector('.content-title p');
            if (subtitle) subtitle.innerHTML = `Tareas asignadas al proyecto <strong>${project.nombre}</strong>.`;
            if (project.estado?.toLowerCase() === 'finalizado') {
                const btnNewTask = document.getElementById('btnNewTask');
                if (btnNewTask) btnNewTask.style.display = 'none';
            }
        } catch (err) { console.error('Error al cargar nombre del proyecto:', err); }
    }

    const tasks = await cargarTareas('active', '', urlProjectId);

    const reportTaskId = params.get('report_task_id');
    if (reportTaskId && tasks.length) {
        const task = tasks.find(t => t.id_tarea == reportTaskId);
        if (task) abrirModalReporte(task.id_tarea, task.titulo, task.avance, task.id_proyecto_fk);
    }

    const detailTaskId = params.get('detail_task_id');
    if (detailTaskId) abrirModalDetalleTask(parseInt(detailTaskId));

    if (projectFilter) {
        projectFilter.onchange = () => cargarTareas(document.querySelector('#taskFilters .chip-active').dataset.status, '', projectFilter.value);
    }

    document.querySelectorAll('#taskFilters .chip').forEach(chip => {
        chip.onclick = () => {
            document.querySelectorAll('#taskFilters .chip').forEach(c => c.classList.remove('chip-active'));
            chip.classList.add('chip-active');
            if (isOperario && projectWrapper && urlProjectId === 'all') {
                const show = chip.dataset.status === 'finalizada';
                projectWrapper.style.display = show ? 'block' : 'none';
                if (!show && projectFilter) projectFilter.value = 'all';
            }
            cargarTareas(chip.dataset.status, '', projectFilter ? projectFilter.value : 'all');
        };
    });

    const btnNewTask = document.getElementById('btnNewTask');
    if (btnNewTask) {
        btnNewTask.onclick = async () => {
            const currentProjId = urlProjectId !== 'all' ? urlProjectId : (projectFilter ? projectFilter.value : 'all');
            if (currentProjId === 'all') return toast('Selecciona un proyecto antes de crear una tarea.', 'warn');

            document.getElementById('newTaskModal').style.display = 'block';
            const selectProj = document.getElementById('task_project_id');
            if (selectProj) {
                try {
                    const proj = await api.get(`/proyectos/${currentProjId}`);
                    selectProj.innerHTML = `<option value="${proj.id_proyecto}" selected>${proj.nombre}</option>`;
                } catch(e) {
                    selectProj.innerHTML = `<option value="${currentProjId}" selected>Proyecto #${currentProjId}</option>`;
                }
                selectProj.disabled = true;
            }
            await cargarOperariosPorProyecto(currentProjId);
        };
    }

    document.getElementById('closeNewTaskModal')?.addEventListener('click', () => document.getElementById('newTaskModal').style.display = 'none');
    document.getElementById('closeTaskDetailModal')?.addEventListener('click', () => document.getElementById('taskDetailModal').style.display = 'none');

    // Botón agregar material en modal nueva tarea
    const btnAddMat = document.getElementById('btnModalAddMaterial');
    const materialsList = document.getElementById('modalMaterialsList');
    if (btnAddMat && materialsList) {
        btnAddMat.onclick = () => {
            const div = document.createElement('div');
            div.className = 'mat-item';
            Object.assign(div.style, { display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' });
            div.innerHTML = `
                <select class="mat-id input-borderless" style="flex-grow:1;"><option value="">¿Qué material?</option></select>
                <input type="number" class="mat-qty input-borderless" placeholder="Cant." style="width:50px;text-align:center;" min="1">
                <button type="button" class="btn-remove-icon" data-action="remove-mat">✕</button>`;
            div.querySelector('.mat-id').onchange = actualizarOpcionesMateriales;
            materialsList.appendChild(div);
            actualizarOpcionesMateriales();
        };
    }

    const newTaskForm = document.getElementById('newTaskForm');
    if (newTaskForm) {
        newTaskForm.onsubmit = async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(newTaskForm));
            const ops = Array.from(document.getElementById('taskOperatorsList').querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
            if (!ops.length) return toast('Asigna operarios', 'warn');
            const finalProjId = document.getElementById('task_project_id')?.value || data.id_proyecto_fk;
            try {
                await api.post('/tareas', { ...data, id_operarios: ops, id_proyecto_fk: parseInt(finalProjId) });
                toast('Tarea creada', 'success');
                document.getElementById('newTaskModal').style.display = 'none';
                newTaskForm.reset();
                cargarTareas(document.querySelector('#taskFilters .chip-active')?.dataset.status || 'active', '', finalProjId);
            } catch (err) { toast('Error: ' + (err.message || 'No se pudo crear la tarea'), 'error'); }
        };
    }

    document.getElementById('closeReportModal')?.addEventListener('click', () => document.getElementById('reportModal').style.display = 'none');

    const reportForm = document.getElementById('reportForm');
    if (reportForm) {
        reportForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('report_task_id').value;
            const data = Object.fromEntries(new FormData(reportForm));
            const materiales_usados = Array.from(document.querySelectorAll('.mat-item'))
                .filter(row => row.querySelector('.mat-id').value && row.querySelector('.mat-qty').value)
                .map(row => ({ id_material: parseInt(row.querySelector('.mat-id').value), cantidad: parseInt(row.querySelector('.mat-qty').value) }));
            const payload = { 
                ...data, 
                id_tarea_fk: parseInt(id), 
                porcentaje: parseInt(data.porcentaje), 
                horas_trabajadas: parseFloat(data.horas_trabajadas), 
                materiales_usados 
            };
            delete payload.foto_reporte;

            const fileInput = document.getElementById('foto_reporte');
            if (fileInput && fileInput.files.length > 0) {
                try {
                    payload.foto_url = await api.uploadImage(fileInput.files[0]);
                } catch(e) {
                    console.error("Error subiendo foto de reporte:", e);
                    toast("No se pudo subir la foto del reporte", "error");
                    return;
                }
            }

            try {
                await api.post('/reportes', payload);
                toast('Reporte enviado con éxito', 'success');
                document.getElementById('reportModal').style.display = 'none';
                reportForm.reset();
                try {
                    const activeStatus = document.querySelector('#taskFilters .chip-active')?.dataset.status || 'active';
                    const activeProj = document.getElementById('projectFilterSelect')?.value || 'all';
                    await cargarTareas(activeStatus, '', activeProj);
                } catch (recErr) {
                    console.error('Error al actualizar listado de tareas:', recErr);
                }
            } catch (err) { toast(err.message || 'Error al enviar', 'error'); }
        };
    }

    document.getElementById('closeReassignModal')?.addEventListener('click', () => document.getElementById('reassignModal').style.display = 'none');

    const reassignForm = document.getElementById('reassignForm');
    if (reassignForm) {
        reassignForm.onsubmit = async (e) => {
            e.preventDefault();
            const taskId = document.getElementById('reassign_task_id').value;
            const ops = Array.from(document.getElementById('reassignOperatorsList').querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
            if (!ops.length) return toast('Selecciona al menos un operario.', 'warn');
            try {
                await api.put(`/tareas/${taskId}`, { id_operarios: ops });
                toast('Operarios reasignados con éxito.', 'success');
                document.getElementById('reassignModal').style.display = 'none';
                reassignForm.reset();
                cargarTareas(document.querySelector('#taskFilters .chip-active').dataset.status, '', projectFilter ? projectFilter.value : 'all');
            } catch (err) { toast('Error: ' + (err.message || 'No se pudo reasignar operarios'), 'error'); }
        };
    }

    renderProjectSubNavigation('tareas');
}

async function cargarSelectProyectosTareas(selectEl, isFilter = true) {
    if (!selectEl) return;
    try {
        const payload = getPayload();
        let projects;
        if (payload?.role === 3) {
            const tasks = await api.get('/tareas/mis-tareas');
            const map = new Map(tasks.filter(t => t.id_proyecto_fk).map(t => [t.id_proyecto_fk, t.nombre_proyecto]));
            projects = Array.from(map.entries()).map(([id, nombre]) => ({ id_proyecto: id, nombre }));
        } else {
            projects = await api.get('/proyectos?estado=activo');
        }
        selectEl.innerHTML = isFilter ? '<option value="all">-- Todos los Proyectos --</option>' : '<option value="">Selecciona un proyecto</option>';
        projects.forEach(p => { selectEl.innerHTML += `<option value="${p.id_proyecto}">${p.nombre}</option>`; });
    } catch (e) { console.error(e); }
}

async function cargarOperariosPorProyecto(projectId) {
    const container = document.getElementById('taskOperatorsList');
    if (!container || !projectId) return;
    try {
        const team = await api.get(`/proyectos/${projectId}/estado-equipo`);
        container.innerHTML = team.length ? '' : '<p>No hay operarios.</p>';
        team.forEach(op => { container.innerHTML += `<div class="flex-row" style="padding:5px;"><input type="checkbox" value="${op.id_usuario}"><span>${op.nombre} ${op.apellido}</span></div>`; });
    } catch (e) { console.error(e); }
}

async function cargarTareas(status = 'active', search = '', projectId = 'all') {
    const container = document.getElementById('tasksList');
    if (!container) return [];
    try {
        const payload = getPayload();
        if (!payload) return [];

        let tasks = [];
        if (payload.role === 3) {
            let fetched = await api.get('/tareas/mis-tareas');
            if (!Array.isArray(fetched)) fetched = [];
            tasks = projectId !== 'all' ? fetched.filter(t => t.id_proyecto_fk == projectId) : fetched;
        } else {
            const urlProj = projectId !== 'all' ? '/proyectos' : '/proyectos?estado=activo';
            let projects = await api.get(urlProj);
            if (!Array.isArray(projects)) projects = [];
            if (projectId !== 'all') projects = projects.filter(p => p.id_proyecto == projectId);
            for (const p of projects) {
                const pTasks = await api.get(`/proyectos/${p.id_proyecto}/tareas`);
                if (Array.isArray(pTasks)) {
                    pTasks.forEach(t => { t.nombre_proyecto = p.nombre; t.id_proyecto_fk = p.id_proyecto; t.proyecto_estado = p.estado; });
                    tasks = tasks.concat(pTasks);
                }
            }
        }

        if (status === 'active') tasks = tasks.filter(t => t.estado !== 'finalizada');
        else if (status !== 'all') tasks = tasks.filter(t => t.estado === status);

        const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        setText('valTareasPendientes', tasks.filter(t => t.estado === 'pendiente').length);
        setText('valTareasEnCurso', tasks.filter(t => t.estado === 'en_progreso').length);
        setText('valTareasFinalizadas', tasks.filter(t => t.estado === 'finalizada').length);

        container.innerHTML = tasks.length ? '' : "<p style='padding:40px;text-align:center;'>Sin tareas.</p>";
        tasks.forEach(t => {
            const isProjActive = t.proyecto_estado ? t.proyecto_estado.toLowerCase() !== 'finalizado' : true;
            container.innerHTML += taskCard(t, { role: payload.role, projectId });
        });

        if (!container.dataset.bound) {
            container.dataset.bound = 'true';
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const { action, id, title, avance, proyecto, operarios } = btn.dataset;
                if (action === 'reportar') abrirModalReporte(parseInt(id), title, parseInt(avance), parseInt(proyecto));
                else if (action === 'historial') abrirModalDetalleTask(parseInt(id));
                else if (action === 'reasignar') abrirModalReasignarOperario(parseInt(id), parseInt(proyecto), JSON.parse(operarios || '[]'));
                else if (action === 'finalizar') finalizarTarea(parseInt(id));
                else if (action === 'reactivar') reactivarTarea(parseInt(id));
            });
        }

        return tasks;
    } catch (e) { console.error('cargarTareas error:', e); return []; }
}

async function finalizarTarea(id) {
    if (!confirm('¿Finalizar?')) return;
    try { await api.put(`/tareas/${id}`, { estado: 'finalizada' }); location.reload(); }
    catch (err) { toast('Error al finalizar', 'error'); }
}

async function reactivarTarea(id) {
    if (!confirm('¿Reabrir?')) return;
    try { await api.put(`/tareas/${id}`, { estado: 'en_progreso' }); location.reload(); }
    catch (err) { toast('Error al reactivar', 'error'); }
}
