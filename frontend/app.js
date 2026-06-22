/**
 * Constructora GG - Script Maestro Unificado (v3.4)
 * Estabilización definitiva de datos y visibilidad para todos los roles.
 */

// 1. CONFIGURACIÓN GLOBAL
const API_URL = "http://localhost:8000";
console.log("Constructora GG: API_URL configurada en", API_URL);

let loggedInUser = null;
async function ensureLoggedInUser() {
    if (loggedInUser) return loggedInUser;
    try {
        const res = await fetch(`${API_URL}/usuarios/me`, { headers: getAuthHeaders() });
        if (res.ok) {
            loggedInUser = await res.json();
            return loggedInUser;
        }
    } catch (e) {
        console.error("Error fetching logged in user:", e);
    }
    return null;
}

const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
};

const getPayload = () => {
    const token = localStorage.getItem("access_token");
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        return JSON.parse(window.atob(parts[1]));
    } catch (e) {
        console.error("Error decoding token:", e);
        return null;
    }
};

const goToLogin = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("my_user_id");
    const path = window.location.pathname;
    if (path.includes('/pages/') || path.includes('/shared/')) {
        window.location.href = '../index.html';
    } else {
        window.location.href = 'index.html';
    }
};

// Interceptor global de fetch para redirigir a login en caso de 401 (token expirado o inválido)
const originalFetch = window.fetch;
window.fetch = async function (...args) {
    const res = await originalFetch(...args);
    if (res.status === 401) {
        const url = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) || "";
        if (typeof url === 'string' && !url.includes("/auth/login")) {
            console.warn("Acceso no autorizado (401). Redirigiendo a login.");
            goToLogin();
        }
    }
    return res;
};

// 2. LÓGICA DE UI Y ROLES
const setupUIByRole = (roleId) => {
    const roleMap = {
        1: { name: "admin", label: "Administrador", display: "Panel de Administración" },
        2: { name: "lider", label: "Líder", display: "Panel del Líder" },
        3: { name: "operario", label: "Operario", display: "Panel de Operario" }
    };

    const role = roleMap[roleId] || { name: "anonimo", label: "Invitado", display: "Panel" };
    document.body.classList.add(`role-${role.name}`);

    // Mostrar/Ocultar elementos según clases
    const roleClasses = ['.role-admin', '.role-lider', '.role-operario', '.role-admin-only', '.role-lider-only', '.role-operario-only'];
    document.querySelectorAll(roleClasses.join(', ')).forEach(el => el.style.display = 'none');
    document.querySelectorAll(`.role-${role.name}`).forEach(el => {
        el.style.display = (el.tagName === 'A' ? 'flex' : 'block');
    });
    document.querySelectorAll(`.role-${role.name}-only`).forEach(el => {
        el.style.display = (el.tagName === 'A' ? 'flex' : 'block');
    });

    // Ajustes específicos del Administrador y Líder (remover accesos del menú a Tareas, Equipo y Materiales de la barra lateral, ya que son contextuales por proyecto)
    if (roleId === 1 || roleId === 2) {
        document.querySelectorAll('a.nav-link[href*="tareas.html"], a.nav-link[href*="equipo.html"], a.nav-link[href*="materiales.html"]').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
        document.querySelectorAll('.mobile-bottom-nav a[href*="tareas.html"]').forEach(el => {
            el.style.setProperty('display', 'none', 'important');
        });
    }

    // Etiquetas de texto
    const labels = {
        'role-display-name': role.display,
        'user-role-label': role.label,
        'header-userrole': role.label,
        'welcome-title': `Bienvenido, ${role.label}`
    };
    Object.keys(labels).forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = labels[id];
    });
};

// 3. CARGA INICIAL
window.onload = () => {
    console.log("Constructora GG: Iniciando v3.4");

    const token = localStorage.getItem("access_token");
    if (token) {
        try {
            const payload = getPayload();
        if (!payload) return goToLogin();
            setupUIByRole(payload.role);
            const nameElements = ['user-full-name', 'header-username'];
            const avatarElements = ['user-initials', 'header-avatar'];
            nameElements.forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = payload.sub; });
            avatarElements.forEach(id => { if(document.getElementById(id)) document.getElementById(id).textContent = payload.sub.substring(0, 2).toUpperCase(); });
        } catch (e) { console.error("Error token:", e); }
    }

    // Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const params = new URLSearchParams();
            for (const pair of formData) { params.append(pair[0], pair[1]); }
            try {
                const res = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST', body: params, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                
                let data;
                try {
                    data = await res.json();
                } catch (jsonErr) {
                    console.error("Error parsing JSON:", jsonErr);
                    throw new Error("El servidor no respondió correctamente.");
                }

                if (res.ok) { 
                    localStorage.setItem("access_token", data.access_token); 
                    window.location.href = 'dashboard.html'; 
                }
                else { 
                    alert(data.detail || "Error al iniciar sesión"); 
                }
            } catch (err) { 
                console.error("Login connection error details:", err);
                alert(err.message === "El servidor no respondió correctamente." ? err.message : "No se pudo conectar con el servidor. Verifica tu conexión."); 
            }
        };
    }

    // Recuperación de Contraseña (Alerta al Admin)
    const recoveryForm = document.getElementById('recovery-form');
    if (recoveryForm) {
        recoveryForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById("username").value;
            const btn = recoveryForm.querySelector("button");
            btn.disabled = true;
            btn.textContent = "Enviando...";

            try {
                const res = await fetch(`${API_URL}/auth/solicitar-recuperacion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: username })
                });

                if (res.ok) {
                    alert("Solicitud enviada. El administrador ha sido notificado y se pondrá en contacto contigo o restablecerá tu acceso pronto.");
                    window.location.href = '../index.html';
                } else {
                    const err = await res.json();
                    alert(err.detail || "Error al enviar la solicitud.");
                }
            } catch (err) {
                alert("Error de conexión. Intenta más tarde.");
            } finally {
                btn.disabled = false;
                btn.textContent = "Enviar Solicitud";
            }
        };
    }

    // Logout
    const logoutBtn = document.getElementById('logout-button') || document.getElementById('logout-button-unified');
    if (logoutBtn) logoutBtn.onclick = () => { if(confirm("¿Cerrar sesión?")) goToLogin(); };

    // Despacho de funciones según la página actual
    const initPage = (id, fn) => { if (document.getElementById(id)) { try { fn(); } catch(e) { console.error(`Error en ${id}:`, e); } } };

    initPage("userList", () => { setupUserPage(); cargarUsuarios(); });
    initPage("projectList", () => { cargarProyectos(); setupProjectPage(); });
    initPage("inventoryList", () => { cargarInventarioGlobal(); setupInventoryPage(); });
    initPage("reportTableBody", () => { generarReporteInventario(); });
    initPage("projectDetailContent", () => { setupProjectDetailPage(); });
    initPage("dashboardProjectList", () => { cargarDashboardResumen(); });
    initPage("latestReportsList", () => { setupReportsPage(); });
    initPage("tasksList", () => { setupTasksPage(); });
    initPage("teamListContainer", () => { const params = new URLSearchParams(window.location.search); const pid = params.get("project_id") || "all"; cargarEquipoPagina('all', '', pid); setupEquipoPage(pid); });
    initPage("profile-name", () => { setupProfilePage(); });
    initPage("projectMaterialsContainer", () => { setupMaterialesPage(); });
    initPage("btnEnviarReporte", () => { setupAvancesPage(); });
};

// 4. MÓDULOS DE GESTIÓN

// --- DASHBOARD ---
async function cargarDashboardResumen() {
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
            const projRes = await fetch(`${API_URL}/proyectos?estado=activo`, { headers: getAuthHeaders() });
            if (projRes.ok) {
                projects = await projRes.json();
                console.log("Proyectos activos cargados:", projects.length);
            } else {
                console.error("Error al buscar proyectos activos:", projRes.status);
            }
        } catch (err) {
            console.error("Excepción al cargar proyectos activos:", err);
        }

        // Renderizar proyectos en la lista lateral/principal
        container.innerHTML = projects.length ? "" : "<p style='text-align:center; padding:15px; color:var(--muted);'>No hay proyectos activos asignados.</p>";
        if (Array.isArray(projects)) {
            projects.forEach(p => {
                container.innerHTML += `<div class="project-item clickable-card" onclick="window.location.href='pages/detalles_proyecto.html?id=${p.id_proyecto}'">
                    <div>
                        <div class="project-title">${p.nombre}</div>
                        <div class="project-leader">Líder: ${p.lider ? p.lider.nombre : 'S/A'}</div>
                    </div>
                    <div class="project-progress-value">${p.avance_general}%</div>
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
                const uRes = await fetch(`${API_URL}/usuarios`, { headers: getAuthHeaders() });
                if (uRes.ok) {
                    const users = await uRes.json();
                    const valUsers = document.getElementById('val-usuarios');
                    if (valUsers) {
                        valUsers.textContent = Array.isArray(users) ? users.length : 0;
                    }
                    console.log("Usuarios cargados para KPI:", Array.isArray(users) ? users.length : 0);
                } else {
                    console.error("Error al buscar usuarios:", uRes.status);
                }
            } catch (err) {
                console.error("Excepción al buscar usuarios:", err);
            }

            // KPI: Alertas Pendientes (val-avance) y lista de notificaciones de admin
            try {
                const nRes = await fetch(`${API_URL}/notificaciones`, { headers: getAuthHeaders() });
                if (nRes.ok) {
                    const notifications = await nRes.json();
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
                } else {
                    console.error("Error al buscar notificaciones:", nRes.status);
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
                    const tRes = await fetch(`${API_URL}/tareas/mis-tareas`, { headers: getAuthHeaders() });
                    if (tRes.ok) {
                        myTasks = await tRes.json();
                    } else {
                        console.error("Error al buscar mis tareas:", tRes.status);
                    }
                    
                    // Poblar lista de tareas de hoy para el operario
                    const taskContainer = document.getElementById("operarioTodayTasks");
                    if (taskContainer && Array.isArray(myTasks)) {
                        const todayTasks = myTasks.filter(t => t.estado !== 'finalizada');
                        taskContainer.innerHTML = todayTasks.length ? "" : "<p style='text-align:center; padding:15px; color:var(--muted);'>No tienes tareas pendientes para hoy.</p>";
                        todayTasks.forEach(t => {
                            taskContainer.innerHTML += `<div class="project-item">
                                <div>
                                    <div class="project-title">${t.titulo}</div>
                                    <div class="project-leader">${t.nombre_proyecto}</div>
                                </div>
                                <button class="btn-small" onclick="window.location.href='pages/tareas.html?report_task_id=${t.id_tarea}'">Ver</button>
                            </div>`;
                        });
                    }
                } else if (Array.isArray(projects)) {
                    // Para líderes, obtenemos las tareas de cada proyecto activo
                    for (const p of projects) {
                        try {
                            const tasksR = await fetch(`${API_URL}/proyectos/${p.id_proyecto}/tareas`, { headers: getAuthHeaders() });
                            if (tasksR.ok) {
                                const pTasks = await tasksR.json();
                                if (Array.isArray(pTasks)) {
                                    myTasks = myTasks.concat(pTasks);
                                }
                            }
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
                const invRes = await fetch(`${API_URL}/inventario`, { headers: getAuthHeaders() });
                if (invRes.ok) {
                    const inventory = await invRes.json();
                    if (Array.isArray(inventory)) {
                        // Materiales críticos son aquellos donde stock_actual <= stock_minimo
                        const lowCount = inventory.filter(i => i.stock_actual <= i.stock_minimo).length;
                        valI.textContent = lowCount;
                        valI.style.color = lowCount > 0 ? "#ef4444" : "#059669";
                        console.log("Materiales críticos cargados:", lowCount);
                    }
                } else {
                    console.error("Error al buscar inventario:", invRes.status);
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

async function marcarNotificacionLeida(id) {
    await fetch(`${API_URL}/notificaciones/${id}/leer`, { method: 'PATCH', headers: getAuthHeaders() });
    cargarDashboardResumen();
}

function setupKPIShortcuts() {
    const ids = { 'kpi-usuarios': 'pages/usuarios.html', 'kpi-proyectos': 'pages/proyectos.html', 'kpi-inventario': 'pages/inventario.html', 'kpi-avance': 'pages/reportes.html' };
    Object.keys(ids).forEach(id => { const el = document.getElementById(id); if (el) el.onclick = () => window.location.href = ids[id]; });
}

// --- PERFIL ---
async function setupProfilePage() {
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

// --- EQUIPO ---
async function setupEquipoPage(projectId = 'all') {
    const filters = document.querySelectorAll("#teamFilters .chip");
    filters.forEach(chip => chip.onclick = () => { 
        document.querySelectorAll("#teamFilters .chip").forEach(c => c.classList.remove("chip-active")); 
        chip.classList.add("chip-active"); 
        cargarEquipoPagina(chip.dataset.status, document.getElementById("teamInputSearch") ? document.getElementById("teamInputSearch").value : "", projectId); 
    });
    if (document.getElementById("teamInputSearch")) {
        document.getElementById("teamInputSearch").oninput = (e) => {
            const activeChip = document.querySelector("#teamFilters .chip-active");
            cargarEquipoPagina(activeChip ? activeChip.dataset.status : 'all', e.target.value, projectId);
        };
    }

    const btn = document.getElementById("btnManageTeam");
    const payload = getPayload();
    const isAdmin = payload && payload.role === 1;

    if (btn) {
        let isProjectActive = true;
        if (projectId !== "all") {
            try {
                const pRes = await fetch(`${API_URL}/proyectos/${projectId}`, { headers: getAuthHeaders() });
                if (pRes.ok) {
                    const project = await pRes.json();
                    isProjectActive = project.estado && project.estado.toLowerCase() !== "finalizado";
                }
            } catch (err) {
                console.error("Error al validar estado del proyecto para botón de asignación:", err);
            }
        }
        
        if (isProjectActive && isAdmin && projectId !== "all") {
            btn.style.display = "block";
            btn.onclick = async () => { 
                document.getElementById("teamModal").style.display = "block"; 
                await cargarOperariosDisponibles(projectId); 
            };
        } else {
            btn.style.display = "none";
        }
    }

    if (document.getElementById("closeTeamModal")) {
        document.getElementById("closeTeamModal").onclick = () => {
            document.getElementById("teamModal").style.display = "none";
        };
    }

    const form = document.getElementById("teamForm");
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const ids = Array.from(document.getElementById("availableOperatorsList").querySelectorAll('input:checked')).map(cb => parseInt(cb.value));
            try {
                const res = await fetch(`${API_URL}/proyectos/configurar-equipo`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify({ id_proyecto: parseInt(projectId), id_usuarios: ids }) 
                });
                if (res.ok) { 
                    alert("Equipo actualizado correctamente."); 
                    document.getElementById("teamModal").style.display = "none"; 
                    cargarEquipoPagina('all', '', projectId);
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo actualizar el equipo"));
                }
            } catch (err) {
                console.error("Error al configurar equipo desde página de equipo:", err);
                alert("Error de conexión");
            }
        };
    }

    if (projectId !== "all") {
        try {
            const pRes = await fetch(`${API_URL}/proyectos/${projectId}`, { headers: getAuthHeaders() });
            if (pRes.ok) {
                const project = await pRes.json();
                const subtitle = document.getElementById("teamSummary");
                if (subtitle) {
                    subtitle.innerHTML = `Personal asignado al proyecto <strong>${project.nombre}</strong>.`;
                }
            }
        } catch (err) {
            console.error("Error al cargar nombre del proyecto para equipo:", err);
        }
    } else {
        const subtitle = document.getElementById("teamSummary");
        if (subtitle) {
            subtitle.textContent = "Supervisa al personal y operarios del sistema.";
        }
    }
    renderProjectSubNavigation('equipo');
}

async function cargarEquipoPagina(filterStatus = 'all', term = '', projectId = 'all') {
    const container = document.getElementById("teamListContainer");
    if (!container) return;
    try {
        const token = localStorage.getItem("access_token");
        const payload = getPayload();
        if (!payload) return goToLogin();
        let members = [];
        if (payload.role === 1 && projectId === 'all') {
            const res = await fetch(`${API_URL}/usuarios?id_rol_fk=3`, { headers: getAuthHeaders() });
            if (res.ok) {
                members = await res.json();
            } else {
                console.error("Error al cargar operarios:", res.status);
                return;
            }
        } else {
            const urlProj = projectId !== 'all' ? `${API_URL}/proyectos` : `${API_URL}/proyectos?estado=activo`;
            const projRes = await fetch(urlProj, { headers: getAuthHeaders() });
            let projects = projRes.ok ? await projRes.json() : [];
            if (!Array.isArray(projects)) projects = [];
            if (projectId !== 'all') {
                projects = projects.filter(p => p.id_proyecto == projectId);
            }
            const memberMap = new Map();
            for (const p of projects) {
                const teamRes = await fetch(`${API_URL}/proyectos/${p.id_proyecto}/estado-equipo`, { headers: getAuthHeaders() });
                if (teamRes.ok) { 
                    const tData = await teamRes.json();
                    if (Array.isArray(tData)) {
                        tData.forEach(m => memberMap.set(m.id_usuario, m)); 
                    }
                }
            }
            members = Array.from(memberMap.values());
        }
        if (!Array.isArray(members)) {
            console.error("Members no es un array:", members);
            return;
        }
        if (filterStatus !== 'all') members = members.filter(m => (m.en_tarea ? 'ocupado' : 'disponible') === filterStatus);
        if (term) { const t = term.toLowerCase(); members = members.filter(m => m.nombre.toLowerCase().includes(t) || m.correo.toLowerCase().includes(t)); }
        container.innerHTML = members.length ? "" : "<p style='text-align:center; padding:40px;'>Sin personal asignado.</p>";
        members.forEach(m => {
            const tareasText = m.tareas_activas && m.tareas_activas.length ? `En: ${m.tareas_activas.join(", ")}` : 'Disponible';
            container.innerHTML += `<div class="user-card"><div class="user-avatar-small">${m.nombre[0]}</div><div class="user-details"><strong>${m.nombre} ${m.apellido}</strong><span>${m.correo}</span></div><div class="user-status-tasks"><span class="role-tag">Operario</span><span class="${m.en_tarea ? 'status-tag-ocupado':'status-tag-disponible'}">${tareasText}</span></div><div class="user-actions"><button class="btn-small-muted" onclick="window.location.href='perfil.html?id=${m.id_usuario}'">Perfil</button></div></div>`;
        });
    } catch (e) { console.error(e); }
}

// --- PROYECTOS ---
function setupProjectPage() {
    if (document.getElementById("btnNewProject")) {
        document.getElementById("btnNewProject").onclick = async () => {
            document.getElementById("projectModal").style.display = "block";
            const res = await fetch(`${API_URL}/usuarios?id_rol_fk=2`, { headers: getAuthHeaders() });
            const leaders = await res.json();
            document.getElementById("id_lider_fk").innerHTML = '<option value="">Selecciona líder</option>' + leaders.map(l => `<option value="${l.id_usuario}">${l.nombre} ${l.apellido}</option>`).join('');
        };
    }
    if (document.getElementById("closeProjectModal")) document.getElementById("closeProjectModal").onclick = () => document.getElementById("projectModal").style.display = "none";
    
    const searchInput = document.getElementById("projectInputSearch");
    if (searchInput) {
        searchInput.oninput = (e) => {
            const activeChip = document.querySelector("#projectFilters .chip-active");
            cargarProyectos(activeChip ? activeChip.dataset.status : 'activo', e.target.value);
        };
    }

    const form = document.getElementById("projectForm");
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            console.log("projectForm: Enviando solicitud de creación...");
            const data = Object.fromEntries(new FormData(form));
            
            // Validaciones y transformaciones
            const payload = { 
                ...data, 
                presupuesto: parseFloat(data.presupuesto), 
                id_lider_fk: parseInt(data.id_lider_fk)
            };

            if (isNaN(payload.presupuesto)) { alert("Presupuesto no válido"); return; }
            if (isNaN(payload.id_lider_fk)) { alert("Debe seleccionar un líder"); return; }

            try {
                const res = await fetch(`${API_URL}/proyectos`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify(payload) 
                });
                
                if (res.ok) {
                    alert("Proyecto creado exitosamente.");
                    document.getElementById("projectModal").style.display = "none";
                    form.reset();
                    cargarProyectos();
                } else {
                    const err = await res.json();
                    console.error("Error API Proyectos:", err);
                    alert("Error: " + (err.detail || "No se pudo crear el proyecto"));
                }
            } catch (err) {
                console.error("Error conexión:", err);
                alert("Error de conexión con el servidor");
            }
        };
    }
    document.querySelectorAll("#projectFilters .chip").forEach(chip => chip.onclick = () => { 
        document.querySelectorAll("#projectFilters .chip").forEach(c => c.classList.remove("chip-active")); 
        chip.classList.add("chip-active"); 
        cargarProyectos(chip.dataset.status, searchInput ? searchInput.value : ''); 
    });
}

async function cargarProyectos(status = 'activo', search = '') {
    const container = document.getElementById("projectList");
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/proyectos`, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Error al cargar proyectos:", res.status);
            return;
        }
        let projects = await res.json();
        if (!Array.isArray(projects)) {
            console.error("Proyectos cargados no es un array:", projects);
            return;
        }
        
        if (status !== 'all') projects = projects.filter(p => p.estado.toLowerCase() === status.toLowerCase());
        
        if (search) {
            const s = search.toLowerCase();
            projects = projects.filter(p => 
                p.nombre.toLowerCase().includes(s) || 
                p.ciudad.toLowerCase().includes(s) || 
                (p.lider && p.lider.nombre.toLowerCase().includes(s))
            );
        }

        container.innerHTML = "";
        projects.forEach(p => {
            const payload = getPayload();
            const isAdmin = payload && payload.role === 1;
            const isLider = payload && payload.role === 2;
            const isFin = p.estado.toLowerCase() === 'finalizado';
            
            // Un admin puede gestionar TODO. Un líder solo lo suyo (el backend ya filtra la lista para el líder).
            const canManage = isAdmin || isLider;

            let leaderProjectLinks = '';
            if (isLider) {
                leaderProjectLinks = `
                    <button class="btn-small btn-outline" onclick="event.stopPropagation(); window.location.href='tareas.html?project_id=${p.id_proyecto}'" style="border-color: var(--primary); color: var(--primary);">Tareas</button>
                    <button class="btn-small btn-outline" onclick="event.stopPropagation(); window.location.href='equipo.html?project_id=${p.id_proyecto}'" style="border-color: var(--primary); color: var(--primary);">Equipo</button>
                    <button class="btn-small btn-outline" onclick="event.stopPropagation(); window.location.href='materiales.html?project_id=${p.id_proyecto}'" style="border-color: var(--primary); color: var(--primary);">Inventario</button>
                `;
            }
            
            container.innerHTML += `<div class="project-card clickable-card" onclick="window.location.href='detalles_proyecto.html?id=${p.id_proyecto}'"><div class="project-header"><div class="project-title"><strong>${p.nombre}</strong><span>${p.ciudad}</span></div><span class="status-tag ${isFin ? 'status-tag-finalizado':''}">${p.estado.toUpperCase()}</span></div><div class="progress-section"><div class="progress-header"><span>Avance General</span><span class="progress-percentage">${p.avance_general}%</span></div><div class="project-progress-bar"><div class="progress-fill" style="width:${p.avance_general}%"></div></div></div><div class="project-meta-grid"><div class="meta-item"><span class="label">Presupuesto</span><span class="value">$${p.presupuesto.toLocaleString()}</span></div><div class="meta-item"><span class="label">Líder</span><span class="value">${p.lider ? p.lider.nombre : 'S/A'}</span></div></div><div class="task-actions" style="margin-top:10px; display: flex; flex-wrap: wrap; gap: 8px;">${canManage && !isFin ? `<button class="btn-danger btn-small" onclick="event.stopPropagation(); cambiarEstadoProyecto(${p.id_proyecto}, 'finalizado')">Finalizar</button>` : ''}${canManage && isFin ? `<button class="btn-success btn-small" onclick="event.stopPropagation(); cambiarEstadoProyecto(${p.id_proyecto}, 'activo')">Reactivar</button>` : ''}${leaderProjectLinks}</div></div>`;
        });
    } catch (e) { console.error("Error cargando proyectos:", e); }
}

async function cambiarEstadoProyecto(id, nuevo) {
    if (confirm(`¿Cambiar estado a ${nuevo.toUpperCase()}?`)) {
        try {
            console.log(`cambiarEstadoProyecto: Cambiando proyecto ${id} a ${nuevo}`);
            
            let url = `${API_URL}/proyectos/${id}`;
            let method = 'PUT';
            let body = JSON.stringify({ estado: nuevo });

            // Si es finalizar, usamos el endpoint especializado POST
            if (nuevo === 'finalizado') {
                url = `${API_URL}/proyectos/${id}/finalizar`;
                method = 'POST';
                body = null; // El endpoint no requiere body
            }

            const res = await fetch(url, { 
                method: method, 
                headers: getAuthHeaders(), 
                body: body 
            });
            
            if (res.ok) {
                alert(`Proyecto marcado como ${nuevo.toUpperCase()} exitosamente.`);
                cargarProyectos();
            } else {
                const err = await res.json();
                console.error("Error al cambiar estado:", err);
                alert("Error: " + (err.detail || "No se pudo cambiar el estado"));
            }
        } catch (err) {
            console.error("Error de conexión:", err);
            alert("Error de conexión con el servidor. Asegúrese de que el backend esté corriendo.");
        }
    }
}

// --- TAREAS ---
async function setupTasksPage() {
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

    if (projectFilter) {
        projectFilter.onchange = () => cargarTareas(document.querySelector("#taskFilters .chip-active").dataset.status, "", projectFilter.value);
    }
    
    document.querySelectorAll("#taskFilters .chip").forEach(chip => {
        chip.onclick = () => { 
            document.querySelectorAll("#taskFilters .chip").forEach(c => c.classList.remove("chip-active")); 
            chip.classList.add("chip-active"); 
            cargarTareas(chip.dataset.status, "", projectFilter ? projectFilter.value : "all"); 
        };
    });
    
    if (document.getElementById("btnNewTask")) { document.getElementById("btnNewTask").onclick = async () => { document.getElementById("newTaskModal").style.display = "block"; await cargarSelectProyectosTareas(document.getElementById("task_project_id"), false); }; }
    if (document.getElementById("closeNewTaskModal")) document.getElementById("closeNewTaskModal").onclick = () => document.getElementById("newTaskModal").style.display = "none";
    if (document.getElementById("task_project_id")) document.getElementById("task_project_id").onchange = (e) => cargarOperariosPorProyecto(e.target.value);
    
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
                <button type="button" class="btn-remove-icon" onclick="this.parentElement.remove(); actualizarOpcionesMateriales();">✕</button>
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
            const res = await fetch(`${API_URL}/tareas`, { method: 'POST', headers: getAuthHeaders(), body: JSON.stringify({ ...data, id_operarios: ops, id_proyecto_fk: parseInt(data.id_proyecto_fk) }) });
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
        const res = await fetch(`${API_URL}/proyectos?estado=activo`, { headers: getAuthHeaders() });
        const projects = await res.json();
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
                const fetchedTasks = await tRes.json();
                if (Array.isArray(fetchedTasks)) tasks = fetchedTasks;
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
                    ${payload.role === 3 && t.estado !== 'finalizada' && isProjActive ? `<button class="btn-primary btn-small" onclick="abrirModalReporte(${t.id_tarea}, '${t.titulo.replace(/'/g, "\\'").replace(/"/g, "&quot;")}', ${t.avance}, ${t.id_proyecto_fk})">Reportar</button>` : ''}
                    <button class="btn-small-muted" onclick="abrirModalDetalleTask(${t.id_tarea})">Historial</button>
                    ${isLider && t.estado !== 'finalizada' && isProjActive && (!t.operarios_nombres || t.operarios_nombres.length === 0) ? `<button class="btn-primary btn-small" onclick="abrirModalReasignarOperario(${t.id_tarea}, ${t.id_proyecto_fk})">Reasignar Operario</button>` : ''}
                    ${isLider && t.estado !== 'finalizada' && isProjActive ? `<button class="btn-success btn-small" onclick="finalizarTarea(${t.id_tarea})">Finalizar Tarea</button>` : ''}
                    ${isLider && t.estado === 'finalizada' && isProjActive ? `<button class="btn-success btn-small" onclick="reactivarTarea(${t.id_tarea})">Reactivar</button>` : ''}
                </div></div>`;
                });
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
                const canDelete = userId && r.id_operario_fk === userId;
                return `
                <div class="report-item">
                    <div class="report-item-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:5px;">
                        <div>
                            <strong class="report-date">${new Date(r.fecha_reporte).toLocaleDateString()} ${new Date(r.fecha_reporte).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong>
                            <span class="report-percentage">Avance: ${r.porcentaje}%</span>
                        </div>
                        ${canDelete ? `<button class="btn-danger btn-small" style="padding: 2px 6px; font-size: 0.75rem; width: auto; height: auto; border-radius: 4px;" onclick="eliminarReporteAvance(${r.id_reporte}, ${id})">Eliminar</button>` : ''}
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

// Cerrar modal detalle
const closeDetailBtn = document.getElementById("closeTaskDetailModal");
if (closeDetailBtn) closeDetailBtn.onclick = () => document.getElementById("taskDetailModal").style.display = "none";

let modalProjectMaterials = [];

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

// --- DETALLES ---
// --- DETALLES ---
async function setupProjectDetailPage() {
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
            const operarios = t.operarios_nombres && t.operarios_nombres.length ? t.operarios_nombres.join(', ') : 'Sin asignar';
            const avance = t.avance !== undefined ? t.avance : 0;
            tCont.innerHTML += `<div class="list-item"><div><strong>${t.titulo}</strong><br><small>${t.estado.toUpperCase()} ${t.finalizador_nombre ? `(Por: ${t.finalizador_nombre})` : ''}</small><br><small><strong>Asignado a:</strong> ${operarios} | <strong>Avance:</strong> ${avance}%</small></div><div class="flex-row"><span class="badge-inline">${t.prioridad.toUpperCase()}</span></div></div>`;
        });
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

// --- MATERIALES (LÍDER / OPERARIO) ---
async function setupMaterialesPage() {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project_id") || "all";
    
    cargarMaterialesProyectos(pid);

    if (pid !== "all") {
        try {
            const pRes = await fetch(`${API_URL}/proyectos/${pid}`, { headers: getAuthHeaders() });
            if (pRes.ok) {
                const project = await pRes.json();
                const subtitle = document.querySelector(".content-title p");
                if (subtitle) {
                    subtitle.innerHTML = `Inventario y existencias en obra para el proyecto <strong>${project.nombre}</strong>.`;
                }
                if (project.estado && project.estado.toLowerCase() === "finalizado") {
                    const btnRequestGlobal = document.getElementById("btnRequestGlobal");
                    if (btnRequestGlobal) btnRequestGlobal.style.display = "none";
                }
            }
        } catch (err) {
            console.error("Error al cargar nombre del proyecto para materiales:", err);
        }
    } else {
        const subtitle = document.querySelector(".content-title p");
        if (subtitle) {
            subtitle.textContent = "Existencias disponibles en los proyectos asignados.";
        }
    }

    if (document.getElementById("btnRequestGlobal")) document.getElementById("btnRequestGlobal").onclick = async () => { document.getElementById("transferModal").style.display = "block"; await cargarSelectsTransferencia(); };
    if (document.getElementById("closeTransferModal")) document.getElementById("closeTransferModal").onclick = () => document.getElementById("transferModal").style.display = "none";
    const transForm = document.getElementById("transferForm");
    if (transForm) {
        transForm.onsubmit = async (e) => {
            e.preventDefault();
            const btn = transForm.querySelector("button");
            btn.disabled = true;
            btn.textContent = "Procesando...";

            try {
                const data = Object.fromEntries(new FormData(transForm));
                const res = await fetch(`${API_URL}/proyectos/trasladar-material`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify({ 
                        id_proyecto: parseInt(pid !== "all" ? pid : data.id_proyecto), 
                        id_material: parseInt(data.id_material), 
                        cantidad: parseInt(data.cantidad) 
                    }) 
                });
                
                let responseData;
                const text = await res.text();
                try {
                    responseData = JSON.parse(text);
                } catch (e) {
                    console.error("Non-JSON response:", text);
                    throw new Error("El servidor devolvió un error inesperado.");
                }
                
                if (res.ok) { 
                    alert("Solicitud procesada: " + responseData.message); 
                    document.getElementById("transferModal").style.display = "none"; 
                    cargarMaterialesProyectos(pid); 
                    transForm.reset();
                } else { 
                    alert(responseData.detail || "Error en la solicitud"); 
                }
            } catch (err) { 
                console.error("Transfer error:", err);
                alert(err.message.includes("servidor devolvió") ? err.message : "No se pudo completar la solicitud. Verifica la conexión."); 
            } finally {
                btn.disabled = false;
                btn.textContent = "Confirmar Solicitud";
            }
        };
    }

    renderProjectSubNavigation('inventario');
}

async function cargarSelectsTransferencia() {
    const params = new URLSearchParams(window.location.search);
    const pid = params.get("project_id") || "all";

    const projRes = await fetch(`${API_URL}/proyectos?estado=activo`, { headers: getAuthHeaders() });
    const invRes = await fetch(`${API_URL}/inventario`, { headers: getAuthHeaders() });
    const projects = await projRes.json();
    const inventory = await invRes.json();
    
    const projectSelect = document.getElementById("trans_project");
    const materialSelect = document.getElementById("trans_material");
    const stockSpan = document.getElementById("valGlobalStock");
    const projectGroup = document.getElementById("trans_project_group");

    if (projectSelect) {
        projectSelect.innerHTML = '<option value="">Selecciona proyecto</option>' + projects.map(p => `<option value="${p.id_proyecto}">${p.nombre}</option>`).join('');
        if (pid !== "all") {
            projectSelect.value = pid;
            projectSelect.removeAttribute("required");
            if (projectGroup) projectGroup.style.display = "none";
        } else {
            projectSelect.setAttribute("required", "required");
            if (projectGroup) projectGroup.style.display = "block";
        }
    }
    
    if (materialSelect) {
        materialSelect.innerHTML = '<option value="">Selecciona un material...</option>' + 
            inventory.map(i => `<option value="${i.id_material_fk}" data-stock="${i.stock_actual}" data-unit="${i.unidad_medida}">${i.nombre_material}</option>`).join('');
        
        materialSelect.onchange = (e) => {
            const opt = e.target.options[e.target.selectedIndex];
            if (stockSpan) stockSpan.textContent = opt.dataset.stock ? `${opt.dataset.stock} ${opt.dataset.unit}` : "--";
        };
    }
}



async function cargarMaterialesProyectos(projectId = 'all') {
    const container = document.getElementById("projectMaterialsContainer");
    if(!container) return;
    try {
        const projRes = await fetch(`${API_URL}/proyectos?estado=activo`, { headers: getAuthHeaders() });
        if (!projRes.ok) throw new Error("Error cargando proyectos");
        let projects = await projRes.json();
        
        if (projectId !== 'all') {
            projects = projects.filter(p => p.id_proyecto == projectId);
        }
        
        if (projects.length === 0) {
            container.innerHTML = "<p style='text-align: center; padding: 40px; color: var(--muted);'>No hay proyectos activos asignados.</p>";
            return;
        }

        container.innerHTML = "";
        for (const p of projects) {
            const res = await fetch(`${API_URL}/inventario/proyecto/${p.id_proyecto}`, { headers: getAuthHeaders() });
            const materials = res.ok ? await res.json() : [];
            const section = document.createElement("div");
            section.className = "project-section";
            section.innerHTML = `<div class="project-header-title">${p.nombre}</div><div class="materials-grid"></div>`;
            const grid = section.querySelector(".materials-grid");
            
            if (materials.length === 0) {
                grid.innerHTML = "<p style='padding:10px; color:var(--muted);'>Sin materiales en obra.</p>";
            } else {
                materials.forEach(m => grid.innerHTML += `<div class="material-card"><div class="material-main"><div><strong>${m.nombre_material}</strong></div><div class="stock-badge">${m.stock_actual}</div></div><small>${m.unidad_medida}</small></div>`);
            }
            container.appendChild(section);
        }
    } catch (e) {
        console.error("Materiales error:", e);
        container.innerHTML = "<p style='text-align: center; color: #ef4444; padding: 40px;'>Error al cargar los materiales. Por favor, intente de nuevo.</p>";
    }
}


async function cargarInventarioGlobal(filter = 'all', term = '') {
    const container = document.getElementById("inventoryList");
    if(!container) return;
    try {
        const res = await fetch(`${API_URL}/inventario`, { headers: getAuthHeaders() });
        let items = await res.json();
        if (filter === 'low') items = items.filter(i => i.stock_actual <= i.stock_minimo);
        if (term) { const t = term.toLowerCase(); items = items.filter(i => i.nombre_material.toLowerCase().includes(t) || i.categoria_nombre.toLowerCase().includes(t)); }
        container.innerHTML = "";
        items.forEach(i => {
            const low = i.stock_actual <= i.stock_minimo;
            container.innerHTML += `<div class="material-card">
                <div class="material-info">
                    <span class="material-category">${i.categoria_nombre}</span>
                    <strong class="material-name">${i.nombre_material}</strong>
                </div>
                <div class="material-stock">
                    <span class="stock-value ${low ? 'badge-status-inactive' : 'badge-status-active'}">${i.stock_actual}</span>
                    <span class="stock-unit">${i.unidad_medida}</span>
                </div>
                <div class="flex-row" style="grid-column: 1 / 3; margin-top:10px; gap:8px;">
                    <button class="btn-success btn-small role-admin-only" onclick="modificarStock(${i.id_material_fk}, ${i.stock_actual}, 'subir', '${i.nombre_material.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">+ Agregar</button>
                    <button class="btn-danger btn-small role-admin-only" onclick="modificarStock(${i.id_material_fk}, ${i.stock_actual}, 'bajar', '${i.nombre_material.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">- Restar</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error("Inventario:", e); }
}


async function setupInventoryPage() {
    const filters = document.querySelectorAll("#inventoryFilters .chip");
    filters.forEach(chip => chip.onclick = () => {
        document.querySelectorAll("#inventoryFilters .chip").forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");
        cargarInventarioGlobal(chip.dataset.filter, document.getElementById("inventoryInputSearch").value);
    });
    const search = document.getElementById("inventoryInputSearch");
    if(search) search.oninput = (e) => cargarInventarioGlobal(document.querySelector("#inventoryFilters .chip-active").dataset.filter, e.target.value);

    // --- MODALES Y ACCIONES DE INVENTARIO ---
    const btnCreate = document.getElementById("btnCreateMaterial");
    const modalCreate = document.getElementById("materialModal");
    const closeCreate = document.getElementById("closeMaterialModal");
    const materialForm = document.getElementById("materialForm");

    if (btnCreate && modalCreate) {
        btnCreate.onclick = () => {
            modalCreate.style.display = "block";
            if (materialForm) materialForm.reset();
        };
    }

    if (closeCreate && modalCreate) {
        closeCreate.onclick = () => {
            modalCreate.style.display = "none";
        };
    }

    if (materialForm) {
        materialForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(materialForm));
            // Asegurar tipo correcto para enteros
            formData.stock = parseInt(formData.stock || 0);
            formData.stock_minimo = parseInt(formData.stock_minimo || 0);

            try {
                const res = await fetch(`${API_URL}/materiales`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    alert("Material creado correctamente.");
                    modalCreate.style.display = "none";
                    materialForm.reset();
                    cargarInventarioGlobal();
                } else {
                    let msg = "No se pudo crear el material";
                    try {
                        const err = await res.json();
                        msg = err.detail;
                        if (typeof msg === 'object') {
                            if (Array.isArray(msg)) {
                                msg = msg.map(m => (m.msg || JSON.stringify(m))).join(', ');
                            } else {
                                msg = JSON.stringify(msg);
                            }
                        }
                    } catch (jsonErr) {
                        msg = `Error del servidor (${res.status})`;
                    }
                    alert("Error: " + msg);
                }
            } catch (err) {
                alert("Error de conexión al crear el material");
            }
        };
    }
}


async function setupUserPage() {
    console.log("setupUserPage: Inicializando filtros...");
    const roleChips = document.querySelectorAll("#roleFilters .chip");
    const availabilityChips = document.querySelectorAll("#availabilityFilters .chip");

    roleChips.forEach(chip => {
        chip.addEventListener('click', () => {
            roleChips.forEach(c => c.classList.remove("chip-active"));
            chip.classList.add("chip-active");
            cargarUsuarios();
        });
    });

    availabilityChips.forEach(chip => {
        chip.addEventListener('click', () => {
            availabilityChips.forEach(c => c.classList.remove("chip-active"));
            chip.classList.add("chip-active");
            cargarUsuarios();
        });
    });

    const search = document.getElementById("userInputSearch");
    if(search) {
        search.addEventListener('input', () => {
            cargarUsuarios();
        });
    }
    
    // Abrir modal agregar
    const btnAdd = document.getElementById("btnAddUser");
    if(btnAdd) btnAdd.onclick = () => { document.getElementById("userModal").style.display = "block"; document.getElementById("userForm").reset(); };
    if(document.getElementById("closeUserModal")) document.getElementById("closeUserModal").onclick = () => document.getElementById("userModal").style.display = "none";
    if(document.getElementById("closeEditUserModal")) document.getElementById("closeEditUserModal").onclick = () => document.getElementById("editUserModal").style.display = "none";

    // Formulario de agregar
    const userForm = document.getElementById("userForm");
    if (userForm) {
        userForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(userForm));
            // Construir el correo completo
            formData.correo = (formData.correo_prefix || "") + "@constructora-gg.com";
            delete formData.correo_prefix;
            
            // Asegurar tipos correctos
            formData.id_rol_fk = parseInt(formData.id_rol_fk);
            
            try {
                const res = await fetch(`${API_URL}/usuarios`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    alert("Usuario creado correctamente.");
                    document.getElementById("userModal").style.display = "none";
                    userForm.reset();
                    cargarUsuarios();
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo crear el usuario"));
                }
            } catch (err) { alert("Error de conexión"); }
        };
    }

    // Formulario de edición
    const editForm = document.getElementById("editUserForm");
    if (editForm) {
        editForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit_user_id").value;
            const formData = Object.fromEntries(new FormData(editForm));
            
            // Asegurar tipos correctos
            if(formData.id_rol_fk) formData.id_rol_fk = parseInt(formData.id_rol_fk);
            
            // Limpiar password si está vacío para no enviarlo
            if (!formData.password) delete formData.password;

            try {
                const res = await fetch(`${API_URL}/usuarios/${id}`, {
                    method: 'PUT',
                    headers: getAuthHeaders(),
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    alert("Usuario actualizado correctamente.");
                    document.getElementById("editUserModal").style.display = "none";
                    cargarUsuarios();
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo actualizar"));
                }
            } catch (err) { alert("Error de conexión"); }
        };
    }
}

// --- USUARIOS CRUD ---
async function cargarUsuarios() {
    const container = document.getElementById("userList");
    if(!container) return;

    // Obtener filtros seleccionados de la UI
    const activeRoleChip = document.querySelector("#roleFilters .chip-active");
    const role = activeRoleChip ? activeRoleChip.getAttribute('data-role') : 'all';

    const activeAvailChip = document.querySelector("#availabilityFilters .chip-active");
    const availability = activeAvailChip ? activeAvailChip.getAttribute('data-availability') : 'all';

    const searchInput = document.getElementById("userInputSearch");
    const term = searchInput ? searchInput.value : "";

    console.log(`cargarUsuarios: Cargando con filtros ui -> rol=${role}, disponibilidad=${availability}, term=${term}`);

    try {
        let url = `${API_URL}/usuarios`;
        if (role !== 'all') url += `?id_rol_fk=${role}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Error al cargar usuarios:", res.status);
            return;
        }
        let users = await res.json();
        if (!Array.isArray(users)) {
            console.error("Usuarios cargados no es un array:", users);
            return;
        }
        console.log(`cargarUsuarios: Recibidos ${users.length} usuarios`);

        // Cargar proyectos para ver asignaciones reales
        let projects = [];
        try {
            const projRes = await fetch(`${API_URL}/proyectos`, { headers: getAuthHeaders() });
            if (projRes.ok) projects = await projRes.json();
        } catch (projErr) {
            console.error("Error al cargar proyectos para mapeo:", projErr);
        }

        // Mapear id_usuario -> nombre_proyecto para proyectos activos
        const userProjectMap = {};
        if (Array.isArray(projects)) {
            projects.forEach(p => {
                if (p.estado === 'activo') {
                    if (p.id_lider_fk) {
                        userProjectMap[p.id_lider_fk] = p.nombre;
                    }
                    if (Array.isArray(p.id_operarios)) {
                        p.id_operarios.forEach(opId => {
                            userProjectMap[opId] = p.nombre;
                        });
                    }
                }
            });
        }

        // Filtrar por término de búsqueda
        if (term) {
            const t = term.toLowerCase();
            users = users.filter(u => 
                (u.nombre && u.nombre.toLowerCase().includes(t)) || 
                (u.apellido && u.apellido.toLowerCase().includes(t)) || 
                (u.correo && u.correo.toLowerCase().includes(t))
            );
        }

        // Filtrar por disponibilidad
        if (availability !== 'all') {
            users = users.filter(u => {
                if (u.id_rol_fk === 1) return availability === 'free'; // Admins no se asignan a proyectos
                
                const hasProject = !!userProjectMap[u.id_usuario];
                if (availability === 'free') {
                    return !hasProject;
                } else if (availability === 'occupied') {
                    return hasProject;
                }
                return true;
            });
        }

        container.innerHTML = "";
        if (users.length === 0) {
            container.innerHTML = `<p style="text-align:center; padding:20px; color:var(--muted);">No se encontraron usuarios con los filtros seleccionados.</p>`;
            return;
        }

        users.forEach(u => {
            const roleName = u.id_rol_fk === 1 ? "Admin" : (u.id_rol_fk === 2 ? "Líder" : "Operario");
            
            let availabilityTag = '';
            if (u.id_rol_fk === 2 || u.id_rol_fk === 3) {
                const projectName = userProjectMap[u.id_usuario];
                if (projectName) {
                    availabilityTag = `<span class="availability-tag occupied-tag" title="Asignado a: ${projectName}">En Proyecto: <strong>${projectName}</strong></span>`;
                } else {
                    availabilityTag = `<span class="availability-tag free-tag">Disponible / Libre</span>`;
                }
            }

            container.innerHTML += `<div class="user-card">
                <div class="user-avatar-small">${u.nombre ? u.nombre[0].toUpperCase() : 'U'}</div>
                <div class="user-details">
                    <strong>${u.nombre || ''} ${u.apellido || ''}</strong>
                    <span>${u.correo || ''} | ${roleName}</span>
                </div>
                <div class="user-role-status">
                    <span class="status-tag ${u.activo ? 'badge-status-active' : 'badge-status-inactive'}">${u.activo ? 'Activo':'Inactivo'}</span>
                    ${availabilityTag}
                </div>
                <div class="user-actions flex-row" style="gap:8px;">
                    <button class="btn-small-muted" onclick="abrirModalEditarUsuario(${u.id_usuario}, '${(u.nombre || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${(u.apellido || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', '${(u.telefono || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}', ${u.id_rol_fk})">Editar</button>
                    <button class="${u.activo ? 'btn-danger':'btn-success'} btn-small" onclick="${u.activo ? `desactivarUsuario(${u.id_usuario})` : `reactivarUsuario(${u.id_usuario})`}">${u.activo ? 'Desactivar':'Reactivar'}</button>
                </div>
            </div>`;
        });
    } catch(e) {
        console.error("Error en cargarUsuarios:", e);
    }
}

function abrirModalEditarUsuario(id, nombre, apellido, telefono, role) {
    document.getElementById("edit_user_id").value = id;
    document.getElementById("edit_u_nombre").value = nombre;
    document.getElementById("edit_u_apellido").value = apellido;
    document.getElementById("edit_u_telefono").value = telefono;
    document.getElementById("edit_u_rol").value = role;
    document.getElementById("edit_u_password").value = ""; // Siempre vacío al abrir
    document.getElementById("editUserModal").style.display = "block";
}

async function desactivarUsuario(id) {
    if (confirm("¿Está seguro de que desea desactivar este usuario? Se desvinculará de todos sus proyectos y tareas activos.")) {
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                alert("Usuario desactivado con éxito.");
                cargarUsuarios();
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "No se pudo desactivar el usuario"));
            }
        } catch (err) {
            console.error("Error al desactivar usuario:", err);
            alert("Error de conexión");
        }
    }
}

async function reactivarUsuario(id) {
    if (confirm("¿Está seguro de que desea reactivar este usuario?")) {
        try {
            const res = await fetch(`${API_URL}/usuarios/${id}/activar`, {
                method: 'PATCH',
                headers: getAuthHeaders()
            });
            if (res.ok) {
                alert("Usuario reactivado con éxito.");
                cargarUsuarios();
            } else {
                const err = await res.json();
                alert("Error: " + (err.detail || "No se pudo reactivar el usuario"));
            }
        } catch (err) {
            console.error("Error al reactivar usuario:", err);
            alert("Error de conexión");
        }
    }
}

// --- REPORTES INVENTARIO ---
async function generarReporteInventario() {
    try {
        const res = await fetch(`${API_URL}/inventario`, { headers: getAuthHeaders() });
        if (!res.ok) {
            console.error("Error al generar reporte de inventario:", res.status);
            return;
        }
        const items = await res.json();
        if (!Array.isArray(items)) {
            console.error("Los items de inventario no son un array:", items);
            return;
        }
        const body = document.getElementById("reportTableBody");
        if(!body) return;
        body.innerHTML = items.map(i => {
            const low = i.stock_actual <= i.stock_minimo;
            return `<tr><td>${i.nombre_material}</td><td>${i.categoria_nombre}</td><td>${i.stock_actual}</td><td>${i.stock_minimo}</td><td><span class="status-badge ${low?'status-low':'status-ok'}">${low?'BAJO':'OK'}</span></td></tr>`;
        }).join('');
    } catch(e) {}
}

// --- REPORTES GLOBALES PAGE ---
async function setupReportsPage() {
    cargarDatosReportes();
    document.querySelectorAll("#reportFilters .chip").forEach(chip => chip.onclick = () => {
        document.querySelectorAll("#reportFilters .chip").forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");
        document.getElementById("reportsSection").style.display = chip.dataset.period === 'financial' ? "none" : "block";
    });

    const select = document.getElementById("proyectoReporteSelect");
    if (select) {
        try {
            const res = await fetch(`${API_URL}/proyectos`, { headers: getAuthHeaders() });
            if (res.ok) {
                const projects = await res.json();
                select.innerHTML = '<option value="">Selecciona un proyecto...</option>' + 
                    projects.map(p => `<option value="${p.id_proyecto}">${p.nombre} (${p.ciudad})</option>`).join('');
            } else {
                select.innerHTML = '<option value="">Error al cargar proyectos</option>';
            }
        } catch (e) {
            console.error("Error cargando proyectos para reporte:", e);
            select.innerHTML = '<option value="">Error de conexión</option>';
        }
    }

    const btnPDF = document.getElementById("btnGenerarPDF");
    if (btnPDF) {
        btnPDF.onclick = () => {
            const pId = document.getElementById("proyectoReporteSelect").value;
            if (!pId) {
                alert("Por favor seleccione un proyecto.");
                return;
            }
            exportarProyectoPDF(pId);
        };
    }
}

async function cargarDatosReportes() {
    try {
        const [projRes, invRes, repRes] = await Promise.all([
            fetch(`${API_URL}/proyectos`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/inventario`, { headers: getAuthHeaders() }),
            fetch(`${API_URL}/reportes?limit=5`, { headers: getAuthHeaders() })
        ]);
        const projects = await projRes.json();
        const inventory = await invRes.json();
        const reports = await repRes.json();
        if(document.getElementById("valTotalProyectos")) document.getElementById("valTotalProyectos").textContent = projects.length;
        if(document.getElementById("valAvancePromedio")) { const avg = projects.length ? (projects.reduce((s,p)=>s+p.avance_general,0)/projects.length).toFixed(1)+'%' : '0%'; document.getElementById("valAvancePromedio").textContent = avg; }
        if(document.getElementById("valMaterialesCriticos")) document.getElementById("valMaterialesCriticos").textContent = inventory.filter(i=>i.stock_actual<=i.stock_minimo).length;
        const cont = document.getElementById("latestReportsList");
        if(cont) cont.innerHTML = reports.map(r => `<div class="latest-report-item"><strong>${r.nombre_proyecto}</strong><p>${r.titulo_tarea}</p><small>${r.porcentaje}% - ${r.nombre_operario}</small></div>`).join('');
    } catch(e) {}
}

// --- AVANCES OPERARIO ---
async function setupAvancesPage() {
    const params = new URLSearchParams(window.location.search);
    const preSelectedTaskId = params.get("task_id");
    let projectMaterials = [];

    const select = document.getElementById("tareaSelect");
    const materialsList = document.getElementById("materialsUsedList");
    const btnAddMat = document.getElementById("btnAddMaterialReport");

    // Función para cargar materiales de un proyecto
    const cargarMaterialesDelProyecto = async (projectId) => {
        if (!projectId) {
            projectMaterials = [];
            return;
        }
        try {
            const res = await fetch(`${API_URL}/inventario/proyecto/${projectId}`, { headers: getAuthHeaders() });
            projectMaterials = res.ok ? await res.json() : [];
        } catch (e) { console.error("Error materiales:", e); }
    };

    // Cargar tareas y pre-seleccionar si es necesario
    const resT = await fetch(`${API_URL}/tareas/mis-tareas`, { headers: getAuthHeaders() });
    if(resT.ok) {
        const tasks = await resT.json();
        if (select) {
            select.innerHTML = '<option value="">Selecciona una tarea...</option>' + 
                tasks.filter(t=>t.estado!=='finalizada')
                .map(t=>`<option value="${t.id_tarea}" data-project-id="${t.id_proyecto_fk}" ${preSelectedTaskId == t.id_tarea ? 'selected' : ''}>${t.titulo} (${t.nombre_proyecto})</option>`)
                .join('');
            
            // Si hay una tarea pre-seleccionada, cargar sus materiales de una vez
            if (select.value) {
                const selectedOpt = select.options[select.selectedIndex];
                await cargarMaterialesDelProyecto(selectedOpt.dataset.projectId);
            }
        }
    }

    // Evento al cambiar de tarea: limpiar materiales y cargar los nuevos
    if (select) {
        select.onchange = async () => {
            if (materialsList) materialsList.innerHTML = "";
            const selectedOpt = select.options[select.selectedIndex];
            if (selectedOpt && selectedOpt.dataset.projectId) {
                await cargarMaterialesDelProyecto(selectedOpt.dataset.projectId);
            } else {
                projectMaterials = [];
            }
        };
    }

    if (btnAddMat && materialsList) {
        btnAddMat.onclick = () => {
            if (!select.value) return alert("Primero selecciona una tarea.");
            let opts = projectMaterials.map(m => `<option value="${m.id_material_fk}" data-unit="${m.unidad_medida}">${m.nombre_material} (Disp: ${m.stock_actual})</option>`).join('');
            
            let div = document.createElement('div');
            div.className = 'mat-item';
            div.style.display = 'flex';
            div.style.background = '#fff';
            div.style.border = '1px solid var(--border)';
            div.style.borderRadius = '8px';
            div.style.padding = '5px 10px';
            div.style.alignItems = 'center';
            div.innerHTML = `
                <select class="mat-id input-borderless" style="flex-grow: 1;">
                    <option value="">Seleccione material...</option>
                    ${opts}
                </select>
                <div class="flex-row" style="border-left: 1px solid var(--border); padding-left: 8px;">
                    <input type="number" class="mat-qty input-borderless mat-qty-input" placeholder="Cant." min="1">
                    <small class="mat-unit" style="color: var(--muted); font-size: 0.7rem; min-width: 30px;">--</small>
                </div>
                <button type="button" class="btn-remove-icon" onclick="this.parentElement.remove()">✕</button>
            `;
            
            // Mostrar unidad de medida al seleccionar material
            const rowSelect = div.querySelector(".mat-id");
            rowSelect.onchange = (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                div.querySelector(".mat-unit").textContent = opt.dataset.unit || "--";
            };

            materialsList.appendChild(div);
        };
    }

    const resR = await fetch(`${API_URL}/reportes?limit=5`, { headers: getAuthHeaders() });
    if(resR.ok) {
        const reports = await resR.json();
        const reportsList = document.getElementById("reportsList");
        if (reportsList) {
            reportsList.innerHTML = reports.map(r => `<div class="report-item"><div class="report-main"><span class="report-title">${r.titulo_tarea}</span><span class="report-meta">${new Date(r.fecha_reporte).toLocaleTimeString()}</span></div><span class="report-progress">${r.porcentaje}%</span></div>`).join('');
        }
    }
    const range = document.getElementById("progresoRange");
    if (range) {
        range.oninput = (e) => document.getElementById("progresoLabel").textContent = e.target.value + '%';
    }
    
    const btnEnviar = document.getElementById("btnEnviarReporte");
    if (btnEnviar) {
        btnEnviar.onclick = async () => {
            const tId = document.getElementById("tareaSelect").value;
            if(!tId) return alert("Selecciona una tarea para reportar.");
            
            const matRows = document.querySelectorAll(".material-usage-row");
            const materiales_usados = [];
            for (const row of matRows) {
                const id = row.querySelector(".mat-id").value;
                const qty = row.querySelector(".mat-qty").value;
                if (id && qty) {
                    materiales_usados.push({ id_material: parseInt(id), cantidad: parseInt(qty) });
                }
            }

            btnEnviar.disabled = true;
            btnEnviar.textContent = "Enviando...";

            try {
                const res = await fetch(`${API_URL}/reportes`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify({ 
                        id_tarea_fk: parseInt(tId), 
                        porcentaje: parseInt(document.getElementById("progresoRange").value), 
                        horas_trabajadas: 8, 
                        observaciones: document.getElementById("observaciones").value, 
                        materiales_usados: materiales_usados 
                    }) 
                });
                
                if(res.ok) {
                    alert("Reporte enviado con éxito.");
                    window.location.href = '../dashboard.html';
                } else {
                    const err = await res.json();
                    alert("Error: " + (err.detail || "No se pudo enviar el reporte."));
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = "Enviar reporte";
                }
            } catch (e) {
                alert("Error de conexión al enviar el reporte.");
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Enviar reporte";
            }
        };
    }
}

async function modificarStock(id, actual, operacion, nombre) {
    const verboAccion = operacion === 'subir' ? 'agregar' : 'restar';
    const cantidadStr = prompt(`Stock actual de "${nombre}": ${actual} unidades.\n¿Cuántas unidades desea ${verboAccion}?`);
    if (cantidadStr === null || cantidadStr === "") return;
    
    const cantidad = parseInt(cantidadStr);
    if (isNaN(cantidad) || cantidad <= 0) {
        alert("Por favor ingrese una cantidad válida mayor a cero.");
        return;
    }
    
    let nuevoStock = actual;
    if (operacion === 'subir') {
        nuevoStock = actual + cantidad;
    } else {
        if (cantidad > actual) {
            alert(`No es posible restar ${cantidad} unidades. El stock actual es de solo ${actual} unidades.`);
            return;
        }
        nuevoStock = actual - cantidad;
    }
    
    const confirmacion = confirm(`¿Confirmas que deseas ${verboAccion} ${cantidad} unidades al material "${nombre}"?\nEl stock final cambiará de ${actual} a ${nuevoStock} unidades.`);
    if (!confirmacion) return;
    
    try {
        const res = await fetch(`${API_URL}/materiales/${id}/stock?nueva_cantidad=${nuevoStock}`, {
            method: 'PUT',
            headers: getAuthHeaders()
        });
        if (res.ok) {
            cargarInventarioGlobal();
        } else {
            const err = await res.json();
            alert("Error al actualizar el stock: " + (err.detail || "Error desconocido"));
        }
    } catch (e) {
        alert("Error de conexión al actualizar el stock.");
    }
}

async function exportarProyectoPDF(idProyecto) {
    try {
        console.log("Generando reporte detallado para el proyecto ID:", idProyecto);
        const res = await fetch(`${API_URL}/proyectos/${idProyecto}/reporte-detallado`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            const err = await res.json();
            alert("Error al cargar reporte: " + (err.detail || "No autorizado"));
            return;
        }
        const p = await res.json();
        
        // Generar ventana de impresión
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert("El navegador bloqueó la ventana emergente. Por favor permita las ventanas emergentes para este sitio.");
            return;
        }
        
        // Formatear tablas y listas
        const operariosHTML = p.operarios.length 
            ? `<table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Correo</th>
                        <th>Teléfono</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.operarios.map(o => `
                        <tr>
                            <td>${o.nombre_completo}</td>
                            <td>${o.correo}</td>
                            <td>${o.telefono}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay operarios asignados a este proyecto.</p>`;

        const inventarioHTML = p.inventario.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Material</th>
                        <th>Cantidad en Obra</th>
                        <th>Unidad</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.inventario.map(i => `
                        <tr>
                            <td>${i.nombre_material}</td>
                            <td>${i.stock_actual}</td>
                            <td>${i.unidad_medida}</td>
                        </tr>
                    `).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay materiales en el inventario de esta obra.</p>`;

        const tareasHTML = p.tareas.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Tarea</th>
                        <th>Prioridad</th>
                        <th>Avance</th>
                        <th>Estado</th>
                        <th>Asignados</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.tareas.map(t => {
                        let badgeClass = 'badge-pending';
                        if (t.estado === 'finalizada') badgeClass = 'badge-finalized';
                        return `
                            <tr>
                                <td><strong>${t.titulo}</strong><br><small>${t.descripcion}</small></td>
                                <td><span class="badge">${t.prioridad}</span></td>
                                <td>${t.avance}%</td>
                                <td><span class="badge ${badgeClass}">${t.estado}</span></td>
                                <td>${t.operarios_nombres.join(', ') || 'Sin asignar'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No hay tareas creadas para este proyecto.</p>`;

        const reportesHTML = p.reportes_avance.length
            ? `<table>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Operario</th>
                        <th>Tarea</th>
                        <th>Avance</th>
                        <th>Observaciones</th>
                        <th>Materiales Reportados</th>
                    </tr>
                </thead>
                <tbody>
                    ${p.reportes_avance.map(r => {
                        const mats = r.materiales_usados.map(m => `${m.nombre_material} (${m.cantidad_usada} ${m.unidad_medida})`).join('<br>') || 'Ninguno';
                        return `
                            <tr>
                                <td>${new Date(r.fecha_reporte).toLocaleDateString()}</td>
                                <td>${r.nombre_operario}</td>
                                <td>${r.titulo_tarea}</td>
                                <td>${r.porcentaje}%</td>
                                <td>${r.observaciones}</td>
                                <td>${mats}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
               </table>`
            : `<p class="no-data">No se han registrado reportes de avance para este proyecto.</p>`;

        const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte de Obra - ${p.nombre}</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        color: #1e293b;
                        margin: 40px;
                        font-size: 13px;
                        line-height: 1.5;
                        background: #fff;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 3px solid #0f172a;
                        padding-bottom: 10px;
                        margin-bottom: 25px;
                    }
                    .brand-name {
                        font-size: 24px;
                        font-weight: bold;
                        color: #0f172a;
                    }
                    .report-title {
                        font-size: 14px;
                        color: #64748b;
                        text-align: right;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: bold;
                        color: #0f172a;
                        border-bottom: 1px solid #cbd5e1;
                        padding-bottom: 5px;
                        margin-top: 25px;
                        margin-bottom: 10px;
                        text-transform: uppercase;
                    }
                    .project-desc {
                        margin-bottom: 20px;
                        padding: 12px;
                        background: #f8fafc;
                        border-left: 4px solid #0284c7;
                        border-radius: 0 6px 6px 0;
                    }
                    .meta-grid {
                        display: grid;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px 20px;
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 15px;
                        border-radius: 6px;
                        margin-bottom: 20px;
                    }
                    .meta-item {
                        display: flex;
                        justify-content: space-between;
                    }
                    .meta-label {
                        font-weight: 600;
                        color: #475569;
                    }
                    .meta-value {
                        color: #0f172a;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        border: 1px solid #e2e8f0;
                        padding: 8px 10px;
                        text-align: left;
                    }
                    th {
                        background-color: #f1f5f9;
                        font-weight: 600;
                        color: #475569;
                    }
                    tr:nth-child(even) {
                        background-color: #f8fafc;
                    }
                    .badge {
                        display: inline-block;
                        padding: 2px 6px;
                        font-size: 11px;
                        font-weight: 600;
                        border-radius: 4px;
                        text-transform: uppercase;
                    }
                    .badge-active { background-color: #dcfce7; color: #15803d; }
                    .badge-pending { background-color: #fef9c3; color: #a16207; }
                    .badge-finalized { background-color: #e2e8f0; color: #475569; }
                    .no-data {
                        text-align: center;
                        color: #64748b;
                        font-style: italic;
                        padding: 15px;
                        border: 1px dashed #cbd5e1;
                        border-radius: 6px;
                    }
                    @media print {
                        body { margin: 20px; }
                        .no-print { display: none; }
                        .page-break { page-break-before: always; }
                        tr { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="brand-name">Constructora GG</div>
                    <div class="report-title">
                        <strong>Informe Ejecutivo de Proyecto</strong><br>
                        Fecha Emisión: ${new Date().toLocaleDateString()}<br>
                        Generado por: Plataforma GG
                    </div>
                </div>

                <div class="section-title">Detalles del Proyecto</div>
                <div class="project-desc">
                    <strong>${p.nombre}</strong><br>
                    ${p.descripcion}
                </div>

                <div class="meta-grid">
                    <div class="meta-item"><span class="meta-label">Estado:</span><span class="meta-value">${p.estado.toUpperCase()}</span></div>
                    <div class="meta-item"><span class="meta-label">Avance General:</span><span class="meta-value">${p.avance_general}%</span></div>
                    <div class="meta-item"><span class="meta-label">Ciudad:</span><span class="meta-value">${p.ciudad}</span></div>
                    <div class="meta-item"><span class="meta-label">Dirección:</span><span class="meta-value">${p.direccion}</span></div>
                    <div class="meta-item"><span class="meta-label">Líder Asignado:</span><span class="meta-value">${p.lider_nombre}</span></div>
                    <div class="meta-item"><span class="meta-label">Presupuesto:</span><span class="meta-value">$${p.presupuesto.toLocaleString()}</span></div>
                    <div class="meta-item"><span class="meta-label">Fecha Inicio:</span><span class="meta-value">${p.fecha_inicio ? new Date(p.fecha_inicio).toLocaleDateString() : 'No definida'}</span></div>
                    <div class="meta-item"><span class="meta-label">Fecha Fin:</span><span class="meta-value">${p.fecha_fin ? new Date(p.fecha_fin).toLocaleDateString() : 'No definida'}</span></div>
                    <div class="meta-item"><span class="meta-label">Total Horas Hombre:</span><span class="meta-value">${p.total_horas_trabajadas} hrs</span></div>
                </div>

                <div class="section-title">Personal Asignado (Equipo)</div>
                ${operariosHTML}

                <div class="page-break"></div>

                <div class="section-title">Inventario en Obra</div>
                ${inventarioHTML}

                <div class="section-title">Control de Tareas</div>
                ${tareasHTML}

                <div class="page-break"></div>

                <div class="section-title">Historial de Avances y Novedades</div>
                ${reportesHTML}

                <script>
                    window.onload = function() {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `;
        
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    } catch (e) {
        console.error("Error al exportar PDF:", e);
        alert("Error de conexión al generar el reporte en PDF.");
    }
}

function renderProjectSubNavigation(activeTab) {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project_id") || params.get("id");
    if (!projectId || projectId === "all") return;

    const payload = getPayload();
    if (!payload) return;
    const isOperario = payload.role === 3;

    // Buscar el contenedor .content
    const contentSec = document.querySelector(".content");
    if (!contentSec) return;

    // Si ya existe la barra, no duplicar
    if (document.getElementById("projectSubNavRow")) return;

    // Crear la barra de navegación
    const nav = document.createElement("div");
    nav.id = "projectSubNavRow";
    nav.className = "chips-row project-sub-nav";

    const tabs = [];
    
    // Si no es operario, puede ver Detalles
    if (!isOperario) {
        tabs.push({ id: 'detalles', label: '🛈 Detalles', href: `detalles_proyecto.html?id=${projectId}` });
    }

    tabs.push({ id: 'tareas', label: '✍ Tareas', href: `tareas.html?project_id=${projectId}` });

    // Si no es operario, puede ver Equipo
    if (!isOperario) {
        tabs.push({ id: 'equipo', label: '👤 Equipo', href: `equipo.html?project_id=${projectId}` });
    }

    tabs.push({ id: 'inventario', label: '📦 Inventario', href: `materiales.html?project_id=${projectId}` });

    nav.innerHTML = tabs.map(t => `
        <a href="${t.href}" class="chip ${activeTab === t.id ? 'chip-active' : ''}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            ${t.label}
        </a>
    `).join('');

    // Insertar siempre en la parte superior de .content, antes del header/nombres
    contentSec.prepend(nav);
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
        
        // 1. Obtener operarios libres (sin proyecto activo)
        const resDisp = await fetch(`${API_URL}/usuarios/operarios-disponibles`, { headers: getAuthHeaders() });
        const disponibles = await resDisp.json();

        // 2. Obtener operarios ya asignados a este proyecto (si los hay)
        const resProjTeam = await fetch(`${API_URL}/proyectos/${projectId}/estado-equipo`, { headers: getAuthHeaders() });
        const team = await resProjTeam.json();

        // Combinar listas sin duplicados
        const listaCompleta = [...disponibles];
        team.forEach(a => {
            if (!listaCompleta.find(l => l.id_usuario === a.id_usuario)) {
                listaCompleta.push({
                    id_usuario: a.id_usuario,
                    nombre: a.nombre,
                    apellido: a.apellido,
                    correo: 'Asignado al proyecto'
                });
            }
        });

        container.innerHTML = listaCompleta.length ? "" : "<p style='font-size: 0.8rem; color: var(--muted); text-align: center;'>No hay operarios disponibles.</p>";
        listaCompleta.forEach(op => {
            container.innerHTML += `
                <div class="flex-row" style="padding: 8px 5px; gap: 10px; align-items: center; border-bottom: 1px solid var(--border); width: 100%;">
                    <input type="checkbox" value="${op.id_usuario}">
                    <div class="flex-column" style="font-size: 0.85rem; flex-grow: 1; text-align: left;">
                        <strong>${op.nombre} ${op.apellido}</strong>
                        <span style="font-size: 0.75rem; color: var(--muted);">${op.correo}</span>
                    </div>
                </div>`;
        });
    } catch (e) {
        console.error("Error al cargar operarios para reasignar:", e);
        container.innerHTML = "<p style='font-size: 0.8rem; color: var(--danger); text-align: center;'>Error al cargar operarios.</p>";
    }
}

