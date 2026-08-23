import { getPayload } from '../auth.js';
import { loadComponent, renderProjectSubNavigation, setupUIByRole } from '../ui.js';
import { toast } from '../toast.js';
import { api } from '../services/api.js';
import { stockBadge } from '../components/badges.js';
import { exportToCSV } from '../services/export.js';

let inventarioDataCache = [];

async function cargarInventarioGlobal(filter = 'all', term = '') {
    const container = document.getElementById("inventoryList");
    if(!container) return;
    try {
        let items = await api.get('/inventario');
        inventarioDataCache = items;
        if (filter === 'low') items = items.filter(i => i.stock_actual <= i.stock_minimo);
        if (term) { const t = term.toLowerCase(); items = items.filter(i => i.nombre_material.toLowerCase().includes(t) || i.categoria_nombre.toLowerCase().includes(t)); }
        container.innerHTML = "";
        items.forEach(i => {
            const low = i.stock_actual <= i.stock_minimo;
            container.innerHTML += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:16px; border-radius:var(--radius-md); border:1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom:12px; flex-wrap:wrap; gap:10px;">
                <div style="flex:1; min-width: 200px;">
                    <strong style="color:var(--text); font-size:1.1rem; display:block; margin-bottom:6px;">${i.nombre_material}</strong>
                    <div style="color:var(--muted); font-size:0.9rem; display:flex; align-items:center; gap:8px;">
                        ${stockBadge(i.stock_actual, low)}
                        <span>${i.unidad_medida}</span>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-success btn-small role-admin-only" style="padding:6px 12px;" onclick="modificarStock(${i.id_material_fk}, ${i.stock_actual}, 'subir', '${i.nombre_material.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">+ Agregar</button>
                    <button class="btn-danger btn-small role-admin-only" style="padding:6px 12px;" onclick="modificarStock(${i.id_material_fk}, ${i.stock_actual}, 'bajar', '${i.nombre_material.replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">- Restar</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error("Inventario:", e); }
}

export async function setupInventoryPage() {
    cargarInventarioGlobal('all', '');
    const btnExp = document.getElementById("btnExportInventoryCSV");
    if (btnExp) {
        btnExp.onclick = () => {
            if (!inventarioDataCache.length) return toast("No hay datos para exportar", "warn");
            const dataToExport = inventarioDataCache.map(i => ({
                Material: i.nombre_material,
                Categoria: i.categoria_nombre,
                Stock_Actual: i.stock_actual,
                Unidad: i.unidad_medida,
                Estado: i.stock_actual <= i.stock_minimo ? 'Bajo Stock' : 'Suficiente'
            }));
            exportToCSV("Inventario_Constructora_GG", dataToExport);
            toast("Inventario exportado a CSV", "success");
        };
    }
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
                await api.post('/materiales', formData);
                toast("Material creado correctamente.", 'success');
                modalCreate.style.display = "none";
                materialForm.reset();
                cargarInventarioGlobal();
            } catch (err) {
                toast("Error: " + (err.message || "No se pudo crear el material"), 'error');
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
                await api.put(`/materiales/${id}/stock?nueva_cantidad=${nuevoStock}`, null);
                toast("Stock actualizado", 'success');
                adjustModal.style.display = "none";
                cargarInventarioGlobal();
            } catch (err) {
                toast("Error al actualizar o de conexión", 'error');
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

