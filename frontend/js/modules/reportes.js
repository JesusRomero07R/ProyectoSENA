import { API_URL, fetchJSON, getAuthHeaders } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { exportarProyectoPDF } from './pdf.js';

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

export async function setupReportsPage() {
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
                toast("Por favor seleccione un proyecto.", 'warn');
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
        if(cont) cont.innerHTML = reports.map(r => `
            <div class="latest-report-item" style="background:var(--bg); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom:12px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:var(--text); font-size:1.1rem;">${r.nombre_proyecto}</strong>
                    <span style="color:var(--primary); font-weight:bold; font-size:1.1rem;">${r.porcentaje}%</span>
                </div>
                <div style="color:var(--muted); font-size:0.95rem;">${r.titulo_tarea}</div>
                <div style="color:var(--muted); font-size:0.85rem; display:flex; align-items:center; gap:6px;">
                    <span style="color:var(--primary);">👤</span> ${r.nombre_operario}
                </div>
            </div>`).join('');
    } catch(e) {}
}

export async function setupAvancesPage() {
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
            if (!select.value) return toast("Primero selecciona una tarea.", 'warn');
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
                <button type="button" class="btn-remove-icon" data-action="remove-mat">✕</button>
            `;
            
            // Mostrar unidad de medida al seleccionar material
            const rowSelect = div.querySelector(".mat-id");
            rowSelect.onchange = (e) => {
                const opt = e.target.options[e.target.selectedIndex];
                div.querySelector(".mat-unit").textContent = opt.dataset.unit || "--";
            };

            materialsList.appendChild(div);
        };
        
        if (!materialsList.dataset.bound) {
            materialsList.dataset.bound = "true";
            materialsList.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="remove-mat"]');
                if (btn) btn.parentElement.remove();
            });
        }
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
            if(!tId) return toast("Selecciona una tarea para reportar.", 'warn');
            
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
                    toast("Reporte enviado con éxito.", 'success');
                    window.location.href = '../dashboard.html';
                } else {
                    const err = await res.json();
                    toast("Error: " + (err.detail || "No se pudo enviar el reporte."), 'error');
                    btnEnviar.disabled = false;
                    btnEnviar.textContent = "Enviar reporte";
                }
            } catch (e) {
                toast("Error de conexión al enviar el reporte.", 'error');
                btnEnviar.disabled = false;
                btnEnviar.textContent = "Enviar reporte";
            }
        };
    }
}

