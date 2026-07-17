import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { api } from '../services/api.js';
import { projectCard } from '../components/cards.js';

export function setupProjectPage() {
    if (document.getElementById("btnNewProject")) {
        document.getElementById("btnNewProject").onclick = async () => {
            document.getElementById("projectModal").style.display = "block";
            const leaders = await api.get('/usuarios?id_rol_fk=2');
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
                await api.post('/proyectos', payload);
                toast("Proyecto creado exitosamente.", 'success');
                document.getElementById("projectModal").style.display = "none";
                form.reset();
                cargarProyectos();
            } catch (err) {
                console.error("Error creando proyecto:", err);
                toast("Error: " + (err.message || "No se pudo crear el proyecto"), 'error');
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
        let projects = await api.get('/proyectos');
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
        const userPayload = getPayload();
        const canManage = userPayload && (userPayload.role === 1 || userPayload.role === 2);
        const isLider   = userPayload && userPayload.role === 2;

        projects.forEach(p => {
            let leaderProjectLinks = '';
            if (isLider) {
                leaderProjectLinks = `
                    <button class="btn-small btn-outline" data-action="navigate" data-target="tareas" data-id="${p.id_proyecto}" style="border-color:var(--primary); color:var(--primary);">Tareas</button>
                    <button class="btn-small btn-outline" data-action="navigate" data-target="equipo" data-id="${p.id_proyecto}" style="border-color:var(--primary); color:var(--primary);">Equipo</button>
                    <button class="btn-small btn-outline" data-action="navigate" data-target="materiales" data-id="${p.id_proyecto}" style="border-color:var(--primary); color:var(--primary);">Inventario</button>
                `;
            }
            container.innerHTML += projectCard(p, { canManage, leaderProjectLinks });
        });
    } catch (e) { console.error("Error cargando proyectos:", e); }
}

async function cambiarEstadoProyecto(id, nuevo) {
    if (confirm(`¿Cambiar estado a ${nuevo.toUpperCase()}?`)) {
        try {
            // Finalizar usa endpoint especializado POST; reactivar usa PUT con body
            if (nuevo === 'finalizado') {
                await api.post(`/proyectos/${id}/finalizar`, null);
            } else {
                await api.put(`/proyectos/${id}`, { estado: nuevo });
            }
            toast(`Proyecto marcado como ${nuevo.toUpperCase()} exitosamente.`, 'success');
            cargarProyectos();
        } catch (err) {
            console.error("Error al cambiar estado:", err);
            toast("Error: " + (err.message || "No se pudo cambiar el estado"), 'error');
        }
    }
}

