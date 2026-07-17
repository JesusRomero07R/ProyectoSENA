import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { api } from '../services/api.js';

export async function setupEquipoPage(projectId = 'all') {
    if (projectId === 'all') {
        const params = new URLSearchParams(window.location.search);
        projectId = params.get("project_id") || "all";
    }

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
                const project = await api.get(`/proyectos/${projectId}`);
                isProjectActive = project.estado && project.estado.toLowerCase() !== "finalizado";
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
                await api.post('/proyectos/configurar-equipo', { id_proyecto: parseInt(projectId), id_usuarios: ids });
                toast("Equipo actualizado correctamente.", 'success');
                document.getElementById("teamModal").style.display = "none";
                cargarEquipoPagina('all', '', projectId);
            } catch (err) {
                console.error("Error al configurar equipo desde página de equipo:", err);
                toast("Error: " + (err.message || "No se pudo actualizar el equipo"), 'error');
            }
        };
    }

    if (projectId !== "all") {
        try {
            const project = await api.get(`/proyectos/${projectId}`);
            const subtitle = document.getElementById("teamSummary");
            if (subtitle) {
                subtitle.innerHTML = `Personal asignado al proyecto <strong>${project.nombre}</strong>.`;
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
    cargarEquipoPagina('all', '', projectId);
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
            members = await api.get('/usuarios?id_rol_fk=3');
        } else {
            const urlProj = projectId !== 'all' ? `/proyectos` : `/proyectos?estado=activo`;
            let projects = await api.get(urlProj);
            if (!Array.isArray(projects)) projects = [];
            if (projectId !== 'all') {
                projects = projects.filter(p => p.id_proyecto == projectId);
            }
            const memberMap = new Map();
            for (const p of projects) {
                try {
                    const tData = await api.get(`/proyectos/${p.id_proyecto}/estado-equipo`);
                    if (Array.isArray(tData)) tData.forEach(m => memberMap.set(m.id_usuario, m));
                } catch(e) { /* skip */ }
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

