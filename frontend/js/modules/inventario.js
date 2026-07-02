import { API_URL, fetchJSON, getAuthHeaders } from '../api.js';
import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';

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

export async function setupInventoryPage() {
    cargarInventarioGlobal('all', '');
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
                    toast("Material creado correctamente.", 'success');
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
                    toast("Error: " + msg, 'error');
                }
            } catch (err) {
                toast("Error de conexión al crear el material", 'error');
            }
        };
    }

    // Lógica del Modal de Ajuste de Stock
    const adjustModal = document.getElementById("adjustStockModal");
    const closeAdjustModal = document.getElementById("closeAdjustModal");
    const adjustForm = document.getElementById("adjustStockForm");

    if(closeAdjustModal && adjustModal) closeAdjustModal.onclick = () => adjustModal.style.display = "none";

    if(adjustForm) {
        adjustForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = adjustForm.dataset.idMaterial;
            const actual = parseInt(adjustForm.dataset.stockActual);
            const operacion = adjustForm.dataset.operacion;
            const cantidad = parseInt(document.getElementById("adj_cantidad").value);

            if (isNaN(cantidad) || cantidad <= 0) {
                toast("Ingrese una cantidad válida mayor a cero.", 'warn');
                return;
            }

            let nuevoStock = actual;
            if (operacion === 'subir') nuevoStock = actual + cantidad;
            else {
                if (cantidad > actual) {
                    toast(`No puede restar ${cantidad}, solo hay ${actual}.`, 'warn');
                    return;
                }
                nuevoStock = actual - cantidad;
            }

            const btn = adjustForm.querySelector("button[type='submit']");
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Guardando...";

            try {
                const res = await fetch(`${API_URL}/materiales/${id}/stock?nueva_cantidad=${nuevoStock}`, {
                    method: 'PUT',
                    headers: getAuthHeaders()
                });
                if (res.ok) {
                    toast("Stock actualizado", 'success');
                    adjustModal.style.display = "none";
                    cargarInventarioGlobal();
                } else {
                    toast("Error al actualizar", 'error');
                }
            } catch (err) {
                toast("Error de conexión", 'error');
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        };
    }
}

async function modificarStock(id, actual, operacion, nombre) {
    const verboAccion = operacion === 'subir' ? 'Agregar a' : 'Restar de';
    
    const modal = document.getElementById("adjustStockModal");
    if(!modal) return;
    
    modal.querySelector("h2").textContent = `${verboAccion} Inventario`;
    document.getElementById("adj_material_nombre").value = `${nombre} (Actual: ${actual})`;
    modal.querySelector("label[for='adj_cantidad']").textContent = `Cantidad a ${operacion === 'subir' ? 'agregar' : 'restar'}`;
    
    const form = document.getElementById("adjustStockForm");
    form.dataset.idMaterial = id;
    form.dataset.stockActual = actual;
    form.dataset.operacion = operacion;
    document.getElementById("adj_cantidad").value = "";
    
    modal.style.display = "block";
}
window.modificarStock = modificarStock;

