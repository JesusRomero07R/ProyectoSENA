import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { api } from '../services/api.js';

export async function cargarDashboardResumen() {
    const container = document.getElementById("dashboardProjectList");
    const notifContainer = document.getElementById("adminNotificationsList");
    if (!container) return;

    console.log("Iniciando carga de resumen del dashboard...");

    try {
        const payload = getPayload();
        if (!payload) return goToLogin();
        const isAdmin = payload.role === 1;

        // 1. Cargar proyectos activos (compartido por admin y líder)
        let projects = [];
        try {
            projects = await api.get('/proyectos?estado=activo');
        } catch (err) {
            console.error("Excepción al cargar proyectos activos:", err);
        }

        // Renderizar proyectos en la lista lateral/principal
        container.innerHTML = projects.length ? "" : "<p style='text-align:center; padding:15px; color:var(--muted);'>No hay proyectos activos asignados.</p>";
        if (Array.isArray(projects)) {
            projects.forEach(p => {
                container.innerHTML += `
                <div class="clickable-card" style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:15px; border-radius:var(--radius-sm); border:1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom:12px;" onclick="window.location.href='pages/detalles_proyecto.html?id=${p.id_proyecto}'">
                    <div>
                        <strong style="color:var(--text); font-size:1.05rem; display:block; margin-bottom:4px;">${p.nombre}</strong>
                        <span style="color:var(--muted); font-size:0.8rem;">Líder: ${p.lider ? p.lider.nombre : 'S/A'}</span>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.1rem; font-weight:bold; color:var(--primary);">${p.avance_general}%</div>
                        <div style="font-size:0.7rem; color:var(--muted);">Progreso</div>
                    </div>
                </div>`;
            });
        }

        // Si es Admin, cargamos los indicadores globales específicos de admin
        if (isAdmin) {
            // 1. KPI & Gráfico: Proyectos Activos
            const valProj = document.getElementById('val-proyectos');
            const avgAvance = projects.length ? Math.round(projects.reduce((acc, p) => acc + (p.avance_general || 0), 0) / projects.length) : 0;
            if (valProj) valProj.textContent = projects.length;
            const pctProj = document.getElementById('pct-proyectos');
            if (pctProj) pctProj.textContent = `${avgAvance}% prom`;
            const barProj = document.getElementById('bar-proyectos');
            if (barProj) barProj.style.width = `${avgAvance}%`;
            
            renderSvgDonut('chart-proyectos-box', [
                { label: 'Completado', val: avgAvance, color: '#2563eb' },
                { label: 'Pendiente', val: Math.max(0, 100 - avgAvance), color: '#475569' }
            ]);

            // 2. KPI & Gráfico: Usuarios Registrados
            try {
                const users = await api.get('/usuarios');
                if (Array.isArray(users)) {
                    const valUsers = document.getElementById('val-usuarios');
                    if (valUsers) valUsers.textContent = users.length;
                    const pctUsers = document.getElementById('pct-usuarios');
                    if (pctUsers) pctUsers.textContent = '100%';
                    const barUsers = document.getElementById('bar-usuarios');
                    if (barUsers) barUsers.style.width = '100%';

                    const operarios = users.filter(u => u.id_rol_fk === 3).length;
                    const lideres = users.filter(u => u.id_rol_fk === 2).length;
                    const admins = users.filter(u => u.id_rol_fk === 1).length;

                    renderSvgDonut('chart-usuarios-box', [
                        { label: 'Operarios', val: operarios, color: '#10b981' },
                        { label: 'Líderes', val: lideres, color: '#2563eb' },
                        { label: 'Admins', val: admins, color: '#8b5cf6' }
                    ]);
                }
            } catch (err) {
                console.error("Excepción al buscar usuarios:", err);
            }

            // 3. KPI & Gráfico: Alertas Pendientes y Notificaciones
            try {
                const notifications = await api.get('/notificaciones');
                if (Array.isArray(notifications)) {
                        const pending = notifications.filter(n => !n.leida);
                        const read = notifications.filter(n => n.leida);
                        const pctPending = notifications.length > 0 ? Math.round((pending.length / notifications.length) * 100) : 0;
                        
                        const badge = document.getElementById("adminAlertBadge");
                        if (badge) badge.style.display = pending.length ? "inline-block" : "none";

                        const valAvance = document.getElementById('val-avance');
                        if (valAvance) valAvance.textContent = pending.length;
                        const pctAdv = document.getElementById('pct-avance');
                        if (pctAdv) pctAdv.textContent = `${pctPending}% pend`;
                        const barAdv = document.getElementById('bar-avance');
                        if (barAdv) barAdv.style.width = `${pctPending}%`;

                        renderSvgDonut('chart-alertas-box', [
                            { label: 'Atendidas', val: read.length, color: '#059669' },
                            { label: 'Pendientes', val: pending.length, color: '#f59e0b' }
                        ]);

                        if (notifContainer) {
                            notifContainer.innerHTML = pending.length ? "" : "<p style='text-align:center; color:var(--muted); font-size:0.85rem;'>No hay alertas pendientes.</p>";
                            pending.slice(0, 5).forEach(n => {
                                let targetPage = "";
                                let targetText = "";
                                const msg = n.mensaje ? n.mensaje.toLowerCase() : "";
                                if (n.tipo === "alarma_stock" || msg.includes("stock")) {
                                    targetPage = "pages/inventario.html";
                                    targetText = "Ver Inventario";
                                } else if (n.tipo === "password_reset" || msg.includes("contraseña")) {
                                    targetPage = "pages/usuarios.html";
                                    targetText = "Gestionar Usuarios";
                                }

                                notifContainer.innerHTML += `
                                    <div class="notification-card">
                                        <div class="notification-header">
                                            <div>
                                                <strong class="notification-title">${n.titulo}</strong>
                                                <p class="notification-text">${n.mensaje || ''}</p>
                                            </div>
                                            <button onclick="marcarNotificacionLeida(${n.id_notificacion})" title="Marcar como leída" class="btn-small-muted btn-remove-icon" style="color: var(--success);">✓</button>
                                        </div>
                                        ${targetPage ? `
                                            <button onclick="window.location.href='${targetPage}'" class="btn-outline btn-small" style="width:fit-content; border-color:var(--danger-light); color:var(--danger);">
                                                ${targetText} →
                                            </button>
                                        ` : ''}
                                    </div>`;
                            });
                        }
                }
            } catch (err) {
                console.error("Excepción al cargar notificaciones:", err);
            }
        }

        // 2. Sección para Líder / Operario (Tareas Pendientes, etc.)
        const valPen = document.getElementById('valMisTareasPendientes');
        if (valPen) {
            let myTasks = [];
            try {
                if (payload.role === 3) {
                    myTasks = await api.get('/tareas/mis-tareas');
                    
                    const taskContainer = document.getElementById("operarioTodayTasks");
                    if (taskContainer && Array.isArray(myTasks)) {
                        const todayTasks = myTasks.filter(t => t.estado !== 'finalizada');
                        taskContainer.innerHTML = todayTasks.length ? "" : "<p style='text-align:center; padding:15px; color:var(--muted);'>No tienes tareas pendientes para hoy.</p>";
                        todayTasks.forEach(t => {
                            taskContainer.innerHTML += `<div class="project-item clickable-card" onclick="window.location.href='pages/tareas.html?report_task_id=${t.id_tarea}'">
                                <div>
                                    <div class="project-title">${t.titulo}</div>
                                    <div class="project-leader">${t.nombre_proyecto}</div>
                                </div>
                            </div>`;
                        });
                    }
                } else if (Array.isArray(projects)) {
                    for (const p of projects) {
                        try {
                            const pTasks = await api.get(`/proyectos/${p.id_proyecto}/tareas`);
                            if (Array.isArray(pTasks)) myTasks = myTasks.concat(pTasks);
                        } catch (err) {
                            console.error(`Excepción al obtener tareas del proyecto ${p.id_proyecto}:`, err);
                        }
                    }
                }
            } catch (err) {
                console.error("Excepción al cargar tareas de rol:", err);
            }
            
            if (Array.isArray(myTasks)) {
                const pendCount = myTasks.filter(t => t.estado === 'pendiente').length;
                const progCount = myTasks.filter(t => t.estado === 'en_progreso').length;
                const finCount  = myTasks.filter(t => t.estado === 'finalizada').length;

                if (document.getElementById('valMisTareasPendientes')) {
                    document.getElementById('valMisTareasPendientes').textContent = pendCount;
                }
                if (document.getElementById('valMisTareasEnCurso')) {
                    document.getElementById('valMisTareasEnCurso').textContent = progCount;
                }
                if (document.getElementById('valMisTareasFinalizadas')) {
                    document.getElementById('valMisTareasFinalizadas').textContent = finCount;
                }
                if (document.getElementById('valMisProyectosActivos')) {
                    document.getElementById('valMisProyectosActivos').textContent = Array.isArray(projects) ? projects.length : 0;
                }

                // ponytail: 4 Gráficos visuales SVG nativos específicos para el Líder de Proyecto
                if (document.getElementById('chart-lider-tareas')) {
                    renderSvgDonut('chart-lider-tareas', [
                        { label: 'En Curso', val: progCount, color: '#2563eb' },
                        { label: 'Finalizadas', val: finCount, color: '#059669' },
                        { label: 'Pendientes', val: pendCount, color: '#f59e0b' }
                    ]);
                }
                if (document.getElementById('chart-lider-proyectos')) {
                    const avgAvance = projects.length ? Math.round(projects.reduce((s, p) => s + (p.avance_general || 0), 0) / projects.length) : 0;
                    renderSvgDonut('chart-lider-proyectos', [
                        { label: 'Avance %', val: avgAvance, color: '#2563eb' },
                        { label: 'Pendiente %', val: Math.max(0, 100 - avgAvance), color: '#475569' }
                    ]);
                }
                if (document.getElementById('chart-lider-inventario')) {
                    const lowCount = inventory.filter(i => i.stock_actual <= i.stock_minimo).length;
                    const healthyCount = Math.max(0, inventory.length - lowCount);
                    renderSvgDonut('chart-lider-inventario', [
                        { label: 'Óptimo', val: healthyCount, color: '#059669' },
                        { label: 'Crítico', val: lowCount, color: '#ef4444' }
                    ]);
                }
                if (document.getElementById('chart-lider-equipo')) {
                    const assigned = myTasks.filter(t => t.operarios_nombres && t.operarios_nombres.length > 0).length;
                    const unassigned = Math.max(0, myTasks.length - assigned);
                    renderSvgDonut('chart-lider-equipo', [
                        { label: 'Asignadas', val: assigned, color: '#059669' },
                        { label: 'Sin Asignar', val: unassigned, color: '#ef4444' }
                    ]);
                }
            }
        }

        // 4. KPI & Gráfico: Salud del Inventario (val-inventario)
        const valI = document.getElementById('val-inventario');
        if (valI) {
            try {
                const inventory = await api.get('/inventario');
                if (Array.isArray(inventory)) {
                    const lowCount = inventory.filter(i => i.stock_actual <= i.stock_minimo).length;
                    const healthyCount = Math.max(0, inventory.length - lowCount);
                    const pctCrit = inventory.length > 0 ? Math.round((lowCount / inventory.length) * 100) : 0;
                    
                    valI.textContent = lowCount;
                    valI.style.color = lowCount > 0 ? "#ef4444" : "#059669";

                    const pctInv = document.getElementById('pct-inventario');
                    if (pctInv) pctInv.textContent = `${pctCrit}% crít`;
                    const barInv = document.getElementById('bar-inventario');
                    if (barInv) barInv.style.width = `${pctCrit}%`;

                    renderSvgDonut('chart-inventario-box', [
                        { label: 'Óptimo', val: healthyCount, color: '#059669' },
                        { label: 'Crítico', val: lowCount, color: '#ef4444' }
                    ]);
                }
            } catch (err) {
                console.error("Excepción al cargar inventario:", err);
            }
        }

        setupKPIShortcuts();
    } catch (e) {
        console.error("Error crítico en cargarDashboardResumen:", e);
    }
}

// ponytail: función universal para dona SVG de 2 a 4 segmentos sin dependencias
function renderSvgDonut(containerId, items) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const total = items.reduce((acc, i) => acc + (i.val || 0), 0);
    if (!total) {
        el.innerHTML = "<p style='color:var(--muted); font-size:0.85rem; padding:15px 0;'>Sin datos registrados.</p>";
        return;
    }
    let offsetAcc = 0;
    const circles = items.map(i => {
        const pct = (i.val / total) * 100;
        const strokeDash = `${pct} ${100 - pct}`;
        const offset = -offsetAcc;
        offsetAcc += pct;
        return `<circle cx="18" cy="18" r="15.915" fill="none" stroke="${i.color}" stroke-width="4" stroke-dasharray="${strokeDash}" stroke-dashoffset="${offset}"></circle>`;
    }).join('');
    const legend = items.map(i => `
        <span class="chart-legend-item"><span class="chart-dot" style="background:${i.color}"></span>${i.label} (${i.val})</span>
    `).join('');
    el.innerHTML = `
        <svg viewBox="0 0 36 36" style="width: 90px; height: 90px; transform: rotate(-90deg);">
            ${circles}
        </svg>
        <div class="chart-legend">${legend}</div>
    `;
}

window.marcarNotificacionLeida = async function(id) {
    try { await api.patch(`/notificaciones/${id}/leer`, null); } catch(e) {}
    cargarDashboardResumen();
};

export function setupKPIShortcuts() {
    const ids = { 'kpi-usuarios': 'pages/usuarios.html', 'kpi-proyectos': 'pages/proyectos.html', 'kpi-inventario': 'pages/inventario.html', 'kpi-avance': 'pages/reportes.html' };
    Object.keys(ids).forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => window.location.href = ids[id]; });
}


