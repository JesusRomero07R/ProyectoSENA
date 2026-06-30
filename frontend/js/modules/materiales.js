import { API_URL, fetchJSON } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';

export async function setupMaterialesPage() {
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

