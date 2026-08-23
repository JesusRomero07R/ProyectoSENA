import { getPayload } from '../auth.js';
import { toast } from '../toast.js';
import { api, API_URL } from '../services/api.js';

// ponytail: visor modal de imágenes nativo ultraligero (Lightbox)
window.abrirVistaPreviaImagen = function(imgUrl) {
    let modal = document.getElementById("lightboxImageModal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "lightboxImageModal";
        modal.className = "modal";
        modal.style.background = "rgba(0,0,0,0.85)";
        modal.style.zIndex = "99999";
        modal.innerHTML = `
            <div style="position:relative; max-width:90vw; max-height:90vh; margin:40px auto; text-align:center;">
                <span id="closeLightbox" style="position:absolute; top:-35px; right:0; color:#fff; font-size:2rem; cursor:pointer; font-weight:bold;">&times;</span>
                <img id="lightboxImgTarget" src="" style="max-width:100%; max-height:80vh; border-radius:8px; box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector("#closeLightbox").onclick = () => modal.style.display = "none";
        modal.onclick = (e) => { if (e.target === modal) modal.style.display = "none"; };
    }
    modal.querySelector("#lightboxImgTarget").src = imgUrl;
    modal.style.display = "block";
};

function renderHistorialItem(item, userId, tareaId, tareaEstado) {
    const fecha = `${item.date.toLocaleDateString()} ${item.date.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    if (item.type === 'report') {
        const r = item.data;
        const canDelete = userId && r.id_operario_fk === userId && tareaEstado !== 'finalizada';
        const photoHTML = r.foto_url ? `
            <div style="margin-top: 8px; margin-bottom: 8px;">
                <a href="javascript:void(0)" onclick="abrirVistaPreviaImagen('${API_URL}${r.foto_url}')">
                    <img src="${API_URL}${r.foto_url}" alt="Evidencia" style="max-height: 90px; border-radius: var(--radius-sm); border: 1px solid var(--border); cursor: pointer;" title="Hacer clic para ampliar evidencia fotográfica">
                </a>
            </div>
        ` : '';

        return `
        <div class="report-item">
            <div class="report-item-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                <div>
                    <strong class="report-date">${fecha}</strong>
                    <span class="report-percentage">Avance: ${r.porcentaje}%</span>
                </div>
                ${canDelete ? `<button class="btn-danger btn-small" style="padding:2px 6px;font-size:0.75rem;width:auto;height:auto;border-radius:4px;" data-action="eliminar-reporte" data-id="${r.id_reporte}" data-tarea="${tareaId}">Eliminar</button>` : ''}
            </div>
            <div style="font-size:0.8rem; color:var(--accent); margin-bottom:4px;">👷 ${r.nombre_operario || 'Operario desconocido'}</div>
            <p class="notification-text" style="margin-bottom:5px;">${r.observaciones || 'Sin observaciones'}</p>
            ${photoHTML}
            <div style="font-size:0.75rem; color:var(--muted);">
                Horas: <strong>${r.horas_trabajadas}</strong>
                ${r.materiales_detalles.length ? ` | <span style="color:var(--text);">Materiales: ${r.materiales_detalles.map(md => `${md.nombre_material} (${md.cantidad_usada})`).join(', ')}</span>` : ''}
            </div>
        </div>`;
    }
    const ev = item.data;
    const esFin = ev.tipo === 'finalizada';
    const esProgreso = ev.motivo === 'progreso_completado';
    const color = esFin ? '#22c55e' : '#f59e0b';
    const icono = esFin ? '✅' : '🔄';
    const etiqueta = esFin ? (esProgreso ? 'Progreso Completado (100%)' : 'Finalizado por Líder') : 'Tarea Reactivada';
    const desc = esFin
        ? (esProgreso ? `Registrado por <strong>${ev.nombre_usuario}</strong> al alcanzar el 100%.` : `Finalización manual por el líder <strong>${ev.nombre_usuario}</strong>.`)
        : `Reactivada por <strong>${ev.nombre_usuario}</strong>.`;
    return `
    <div class="report-item" style="border-left:3px solid ${color};padding-left:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="font-size:0.8rem;color:${color};font-weight:600;">${icono} ${etiqueta}</div>
            <span style="font-size:0.7rem;color:var(--muted);">${fecha}</span>
        </div>
        <div style="font-size:0.8rem;color:var(--muted);margin-top:2px;">${desc}</div>
    </div>`;
}

export async function abrirModalDetalleTask(id) {
    try {
        const t = await api.get(`/tareas/mis-tareas/${id}`);
        document.getElementById('detail_task_title_h2').textContent = t.titulo;
        document.getElementById('detail_total_hours').textContent = `${t.horas_totales}h`;
        document.getElementById('detail_progress').textContent = `${t.avance}%`;

        const matSum = document.getElementById('detail_materials_summary');
        matSum.innerHTML = t.materiales_totales.length
            ? t.materiales_totales.map(m => `<span class="badge badge-inline">${m.nombre_material}: <strong>${m.cantidad_usada} ${m.unidad_medida}</strong></span>`).join('')
            : '<span style="font-size:0.8rem;color:var(--muted);">Sin materiales</span>';

        const payload = getPayload();
        const userId = payload?.id ?? null;

        const history = [
            ...(t.historial_reportes || []).map(r => ({ type: 'report', date: new Date(r.fecha_reporte), data: r })),
            ...(t.eventos_historial || []).map(ev => ({ type: 'event', date: new Date(ev.fecha), data: ev }))
        ].sort((a, b) => b.date - a.date);

        const histCont = document.getElementById('detail_reports_history');
        histCont.innerHTML = history.length
            ? history.map(item => renderHistorialItem(item, userId, id, t.estado)).join('')
            : "<p style='text-align:center;color:var(--muted);padding:20px;'>No hay reportes registrados.</p>";

        document.getElementById('taskDetailModal').style.display = 'block';

        if (!histCont.dataset.bound) {
            histCont.dataset.bound = 'true';
            histCont.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="eliminar-reporte"]');
                if (btn) eliminarReporteAvance(parseInt(btn.dataset.id), parseInt(btn.dataset.tarea));
            });
        }
    } catch (e) {
        console.error('abrirModalDetalleTask error:', e);
        toast(`Error: ${e.message}`, 'error');
    }
}

export async function eliminarReporteAvance(idReporte, idTarea) {
    if (!confirm('¿Eliminar este reporte? El stock y el progreso serán recalculados.')) return;
    try {
        await api.del(`/reportes/${idReporte}`);
        toast('Reporte eliminado exitosamente.', 'success');
        await abrirModalDetalleTask(idTarea);
    } catch (e) {
        toast('Error: ' + (e.message || 'No se pudo eliminar el reporte'), 'error');
    }
}
