import re

with open('frontend/app.js', 'r') as f:
    content = f.read()

# 1. cargarInventarioGlobal
if 'cargarInventarioGlobal' not in content or 'function cargarInventarioGlobal' not in content:
    func_inv = """
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
                    <span class="stock-value" style="color:${low ? '#ef4444' : 'var(--primary)'}">${i.stock_actual}</span>
                    <span class="stock-unit">${i.unidad_medida}</span>
                </div>
                <div style="grid-column: 1 / 3; display:flex; gap:10px; margin-top:10px;">
                    <button class="btn-outline btn-small-muted role-admin-only" onclick="ajustarStock(${i.id_material_fk}, ${i.stock_actual})">Ajustar</button>
                </div>
            </div>`;
        });
    } catch(e) { console.error("Inventario:", e); }
}
"""
    # Insert before USUARIOS CRUD
    content = content.replace('// --- USUARIOS CRUD ---', func_inv + '\n// --- USUARIOS CRUD ---')

# 2. setupInventoryPage
if 'setupInventoryPage' not in content or 'function setupInventoryPage' not in content:
    func_setup = """
async function setupInventoryPage() {
    const filters = document.querySelectorAll("#inventoryFilters .chip");
    filters.forEach(chip => chip.onclick = () => {
        document.querySelectorAll("#inventoryFilters .chip").forEach(c => c.classList.remove("chip-active"));
        chip.classList.add("chip-active");
        cargarInventarioGlobal(chip.dataset.filter, document.getElementById("inventoryInputSearch").value);
    });
    const search = document.getElementById("inventoryInputSearch");
    if(search) search.oninput = (e) => cargarInventarioGlobal(document.querySelector("#inventoryFilters .chip-active").dataset.filter, e.target.value);
}
"""
    content = content.replace('// --- USUARIOS CRUD ---', func_setup + '\n// --- USUARIOS CRUD ---')

# 3. setupUserPage
if 'setupUserPage' not in content or 'function setupUserPage' not in content:
    func_user = """
async function setupUserPage() {
    const roleFilter = document.getElementById("roleFilterSelect");
    if(roleFilter) roleFilter.onchange = () => cargarUsuarios(roleFilter.value, document.getElementById("userInputSearch").value);
    const search = document.getElementById("userInputSearch");
    if(search) search.oninput = (e) => cargarUsuarios(roleFilter ? roleFilter.value : 'all', e.target.value);
}
"""
    content = content.replace('// --- USUARIOS CRUD ---', func_user + '\n// --- USUARIOS CRUD ---')

with open('frontend/app.js', 'w') as f:
    f.write(content)
print("Fix applied")
