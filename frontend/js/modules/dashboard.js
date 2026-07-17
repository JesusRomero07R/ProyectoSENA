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
            // KPI: Proyectos Activos (val-proyectos)
            const valProj = document.getElementById('val-proyectos');
            if (valProj) {
                valProj.textContent = projects.length;
            }

            // KPI: Usuarios Registrados (val-usuarios)
            try {
                const users = await api.get('/usuarios');
                const valUsers = document.getElementById('val-usuarios');
                if (valUsers) valUsers.textContent = Array.isArray(users) ? users.length : 0;
            } catch (err) {
                console.error("Excepción al buscar usuarios:", err);
            }

            // KPI: Alertas Pendientes (val-avance) y lista de notificaciones de admin
            try {
                const notifications = await api.get('/notificaciones');
                if (Array.isArray(notifications)) {
                        const pending = notifications.filter(n => !n.leida);
                        
                        // Badge de acción requerida en la sección de alertas del sistema
                        const badge = document.getElementById("adminAlertBadge");
                        if (badge) {
                            badge.style.display = pending.length ? "inline-block" : "none";
                        }

                        // Indicador "Alertas Pendientes" (anteriormente avance global)
                        const valAvance = document.getElementById('val-avance');
                        if (valAvance) {
                            valAvance.textContent = pending.length;
                        }

                        // Lista visual de alertas pendientes
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
                        console.log("Alertas cargadas para KPI:", pending.length);
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
                    
                    // Poblar lista de tareas de hoy para el operario
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
                if (document.getElementById('valMisTareasPendientes')) {
                    document.getElementById('valMisTareasPendientes').textContent = myTasks.filter(t => t.estado === 'pendiente').length;
                }
                if (document.getElementById('valMisTareasEnCurso')) {
                    document.getElementById('valMisTareasEnCurso').textContent = myTasks.filter(t => t.estado === 'en_progreso').length;
                }
                if (document.getElementById('valMisTareasFinalizadas')) {
                    document.getElementById('valMisTareasFinalizadas').textContent = myTasks.filter(t => t.estado === 'finalizada').length;
                }
                if (document.getElementById('valMisProyectosActivos')) {
                    document.getElementById('valMisProyectosActivos').textContent = Array.isArray(projects) ? projects.length : 0;
                }
            }
        }

        // 3. KPI: Materiales Críticos (val-inventario) - para Admin (o quien tenga el elemento val-inventario)
        const valI = document.getElementById('val-inventario');
        if (valI) {
            try {
                const inventory = await api.get('/inventario');
                if (Array.isArray(inventory)) {
                    const lowCount = inventory.filter(i => i.stock_actual <= i.stock_minimo).length;
                    valI.textContent = lowCount;
                    valI.style.color = lowCount > 0 ? "#ef4444" : "#059669";
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

window.marcarNotificacionLeida = async function(id) {
    try { await api.patch(`/notificaciones/${id}/leer`, null); } catch(e) {}
    cargarDashboardResumen();
};

export function setupKPIShortcuts() {
    const ids = { 'kpi-usuarios': 'pages/usuarios.html', 'kpi-proyectos': 'pages/proyectos.html', 'kpi-inventario': 'pages/inventario.html', 'kpi-avance': 'pages/reportes.html' };
    Object.keys(ids).forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => window.location.href = ids[id]; });
}

