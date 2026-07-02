import { API_URL, fetchJSON, getAuthHeaders } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';

export function setupProjectPage() {
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

            if (isNaN(payload.presupuesto)) { toast("Presupuesto no válido", 'warn'); return; }
            if (isNaN(payload.id_lider_fk)) { toast("Debe seleccionar un líder", 'warn'); return; }

            try {
                const res = await fetch(`${API_URL}/proyectos`, { 
                    method: 'POST', 
                    headers: getAuthHeaders(), 
                    body: JSON.stringify(payload) 
                });
                
                if (res.ok) {
                    toast("Proyecto creado exitosamente.", 'success');
                    document.getElementById("projectModal").style.display = "none";
                    form.reset();
                    cargarProyectos();
                } else {
                    const err = await res.json();
                    console.error("Error API Proyectos:", err);
                    toast("Error: " + (err.detail || "No se pudo crear el proyecto"), 'error');
                }
            } catch (err) {
                console.error("Error conexión:", err);
                toast("Error de conexión con el servidor", 'error');
            }
        };
    }
    document.querySelectorAll("#projectFilters .chip").forEach(chip => chip.onclick = () => {
        document.querySelectorAll("#projectFilters .chip").forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");
        cargarProyectos(chip.dataset.status, searchInput ? searchInput.value : '');
    });

    cargarProyectos('activo');

    // Event delegation
    const container = document.getElementById("projectList");
    if (container && !container.dataset.bound) {
        container.dataset.bound = "true";
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            const card = e.target.closest('.clickable-card');
            
            if (btn) {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                
                if (action === 'navigate') {
                    window.location.href = `${btn.dataset.target}.html?project_id=${id}`;
                } else if (action === 'estado') {
                    cambiarEstadoProyecto(id, btn.dataset.status);
                }
            } else if (card) {
                window.location.href = `detalles_proyecto.html?id=${card.dataset.id}`;
            }
        });
    }
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
                    <button class="btn-small btn-outline" data-action="navigate" data-target="tareas" data-id="${p.id_proyecto}" style="border-color: var(--primary); color: var(--primary);">Tareas</button>
                    <button class="btn-small btn-outline" data-action="navigate" data-target="equipo" data-id="${p.id_proyecto}" style="border-color: var(--primary); color: var(--primary);">Equipo</button>
                    <button class="btn-small btn-outline" data-action="navigate" data-target="materiales" data-id="${p.id_proyecto}" style="border-color: var(--primary); color: var(--primary);">Inventario</button>
                `;
            }
            
            container.innerHTML += `<div class="project-card clickable-card" data-id="${p.id_proyecto}"><div class="project-header"><div class="project-title"><strong>${p.nombre}</strong><span>${p.ciudad}</span></div><span class="status-tag ${isFin ? 'status-tag-finalizado':''}">${p.estado.toUpperCase()}</span></div><div class="progress-section"><div class="progress-header"><span>Avance General</span><span class="progress-percentage">${p.avance_general}%</span></div><div class="project-progress-bar"><div class="progress-fill" style="width:${p.avance_general}%"></div></div></div><div class="project-meta-grid"><div class="meta-item"><span class="label">Presupuesto</span><span class="value">$${p.presupuesto.toLocaleString()}</span></div><div class="meta-item"><span class="label">Líder</span><span class="value">${p.lider ? p.lider.nombre : 'S/A'}</span></div></div><div class="task-actions" style="margin-top:10px; display: flex; flex-wrap: wrap; gap: 8px;">${canManage && !isFin ? `<button class="btn-danger btn-small" data-action="estado" data-status="finalizado" data-id="${p.id_proyecto}">Finalizar</button>` : ''}${canManage && isFin ? `<button class="btn-success btn-small" data-action="estado" data-status="activo" data-id="${p.id_proyecto}">Reactivar</button>` : ''}${leaderProjectLinks}</div></div>`;
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
                toast(`Proyecto marcado como ${nuevo.toUpperCase()} exitosamente.`, 'success');
                cargarProyectos();
            } else {
                const err = await res.json();
                console.error("Error al cambiar estado:", err);
                toast("Error: " + (err.detail || "No se pudo cambiar el estado"), 'error');
            }
        } catch (err) {
            console.error("Error de conexión:", err);
            toast("Error de conexión con el servidor. Asegúrese de que el backend esté corriendo.", 'error');
        }
    }
}

