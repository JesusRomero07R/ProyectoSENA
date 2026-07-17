import { toast } from '../toast.js';
import { api } from '../services/api.js';

// ponytail: module-level var shared between abrirModalReporte and actualizarOpcionesMateriales
let modalProjectMaterials = [];

export async function abrirModalReporte(id, titulo, actual, projectId) {
    document.getElementById('report_task_id').value = id;
    document.getElementById('report_task_title').value = titulo;

    const percentageInput = document.getElementById('report_percentage');
    percentageInput.value = actual;
    percentageInput.min = actual;

    const badge = document.getElementById('current_progress_badge');
    if (badge) badge.textContent = `Actual: ${actual}%`;

    const list = document.getElementById('modalMaterialsList');
    if (list) list.innerHTML = '';
    modalProjectMaterials = [];

    if (projectId) {
        try {
            modalProjectMaterials = await api.get(`/inventario/proyecto/${projectId}`);
        } catch (e) { console.error('Error modal materiales:', e); }
    }

    document.getElementById('reportModal').style.display = 'block';

    if (list && !list.dataset.bound) {
        list.dataset.bound = 'true';
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="remove-mat"]');
            if (btn) { btn.parentElement.remove(); actualizarOpcionesMateriales(); }
        });
    }
}

export function actualizarOpcionesMateriales() {
    const rows = document.querySelectorAll('.mat-item');
    const selectedIds = Array.from(rows).map(r => r.querySelector('.mat-id').value).filter(Boolean);
    rows.forEach(row => {
        const select = row.querySelector('.mat-id');
        const cur = select.value;
        select.innerHTML = `<option value="">¿Qué material?</option>` +
            modalProjectMaterials
                .filter(m => !selectedIds.includes(m.id_material_fk.toString()) || m.id_material_fk.toString() === cur)
                .map(m => `<option value="${m.id_material_fk}" data-unit="${m.unidad_medida}">${m.nombre_material} (Disp: ${m.stock_actual})</option>`)
                .join('');
        select.value = cur;
    });
}

export async function abrirModalReasignarOperario(taskId, projectId, assignedOps = []) {
    const modal = document.getElementById('reassignModal');
    if (!modal) return;
    document.getElementById('reassign_task_id').value = taskId;
    document.getElementById('reassign_project_id').value = projectId;
    modal.style.display = 'block';
    await cargarOperariosParaReasignar(projectId, assignedOps);
}

async function cargarOperariosParaReasignar(projectId, assignedOps = []) {
    const container = document.getElementById('reassignOperatorsList');
    if (!container) return;
    try {
        container.innerHTML = "<p style='font-size:0.8rem;color:var(--muted);text-align:center;'>Buscando operarios...</p>";
        const team = await api.get(`/proyectos/${projectId}/estado-equipo`);
        container.innerHTML = team.length ? '' : "<p style='font-size:0.8rem;color:var(--muted);text-align:center;'>No hay operarios vinculados.</p>";
        team.forEach(op => {
            const tareasText = op.en_tarea ? `En tarea(s): ${op.tareas_activas.join(', ')}` : 'Disponible';
            const checked = assignedOps.includes(op.id_usuario) ? 'checked' : '';
            container.innerHTML += `
            <div class="flex-row" style="padding:8px 5px;gap:10px;align-items:center;border-bottom:1px solid var(--border);width:100%;">
                <input type="checkbox" name="operarios" value="${op.id_usuario}" id="reop_${op.id_usuario}" ${checked}>
                <label for="reop_${op.id_usuario}" style="flex:1;margin:0;cursor:pointer;display:flex;flex-direction:column;">
                    <span style="font-weight:500;">${op.nombre}</span>
                    <span style="font-size:0.75rem;color:var(--muted);">${tareasText}</span>
                </label>
            </div>`;
        });
    } catch (e) {
        container.innerHTML = "<p style='font-size:0.8rem;color:var(--danger);text-align:center;'>Error al cargar operarios.</p>";
    }
}
