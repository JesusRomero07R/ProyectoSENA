import { API_URL, fetchJSON, getAuthHeaders } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';

export async function setupEquipoPage(projectId = 'all') {
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
                    toast("Equipo actualizado correctamente.", 'success'); 
                    document.getElementById("teamModal").style.display = "none"; 
                    cargarEquipoPagina('all', '', projectId);
                } else {
                    const err = await res.json();
                    toast("Error: " + (err.detail || "No se pudo actualizar el equipo"), 'error');
                }
            } catch (err) {
                console.error("Error al configurar equipo desde página de equipo:", err);
                toast("Error de conexión", 'error');
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

