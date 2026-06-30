import { getPayload, goToLogin, setupLogin, setupRecovery } from './auth.js';
import { loadComponent, setupUIByRole } from './ui.js';

// Import modules
import { setupDashboard } from './modules/dashboard.js';
import { setupProfilePage } from './modules/perfil.js';
import { setupEquipoPage } from './modules/equipo.js';
import { setupProjectPage } from './modules/proyectos.js';
import { setupTasksPage } from './modules/tareas.js';
import { setupProjectDetailPage } from './modules/detalles.js';
import { setupMaterialesPage } from './modules/materiales.js';
import { setupInventoryPage } from './modules/inventario.js';
import { setupUserPage } from './modules/usuarios.js';
import { setupReportsPage, setupAvancesPage } from './modules/reportes.js';

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Cargar fragmentos compartidos si existen
    const isPages = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/shared/');
    const basePath = isPages ? '../' : './';
    
    await loadComponent('#app-header', `${basePath}components/header.html`);
    await loadComponent('#app-sidebar', `${basePath}components/sidebar.html`);
    await loadComponent('#app-footer', `${basePath}components/footer.html`);

    // 2. Setup auth/logout global
    const payload = getPayload();
    
    // Si no es página de auth y no hay payload, redirigir
    const isAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/' || window.location.pathname.includes('recuperar_contrasena.html');
    if (!isAuthPage && !payload) {
        goToLogin();
        return;
    }

    if (payload) {
        setupUIByRole(payload.role);
        
        // Setup header info
        const userNameEl = document.getElementById("headerUserName");
        const userRoleEl = document.getElementById("headerUserRole");
        const userAvatar = document.querySelector(".user-avatar");
        
        if (userNameEl) userNameEl.textContent = `${payload.nombre || ''} ${payload.apellido || ''}`;
        if (userRoleEl) userRoleEl.textContent = payload.role === 1 ? 'Administrador' : (payload.role === 2 ? 'Líder de Proyecto' : 'Operario');
        if (userAvatar) userAvatar.textContent = payload.nombre ? payload.nombre[0].toUpperCase() : 'U';
    }

    // Bind logout a cualquier botón logout (incluso los inyectados en header)
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('#btnLogout') || e.target.closest('.logout-btn')) {
            goToLogin();
        }
    });

    // 3. Router por página
    const path = window.location.pathname;
    
    if (path.endsWith('index.html') || path === '/') {
        setupLogin("loginForm");
    } else if (path.includes('recuperar_contrasena.html')) {
        setupRecovery("recoveryForm");
    } else if (path.includes('dashboard.html')) {
        // En los módulos, la función puede llamarse setupDashboard o similar.
        // Dado que se exportaron con los nombres originales de app.js, vamos a ajustarlos.
        // Aquí uso los nombres de las funciones que extrajimos de app.js:
        import('./modules/dashboard.js').then(m => m.cargarDashboardResumen && m.cargarDashboardResumen());
        import('./modules/dashboard.js').then(m => m.setupKPIShortcuts && m.setupKPIShortcuts());
    } else if (path.includes('perfil.html')) {
        setupProfilePage();
    } else if (path.includes('equipo.html')) {
        setupEquipoPage();
    } else if (path.includes('proyectos.html')) {
        setupProjectPage();
    } else if (path.includes('tareas.html')) {
        setupTasksPage();
    } else if (path.includes('detalles_proyecto.html')) {
        setupProjectDetailPage();
    } else if (path.includes('materiales.html')) {
        setupMaterialesPage();
    } else if (path.includes('inventario.html')) {
        setupInventoryPage();
    } else if (path.includes('usuarios.html')) {
        setupUserPage();
    } else if (path.includes('reportes.html')) {
        setupReportsPage();
    } else if (path.includes('reporte_inventario.html')) {
        import('./modules/reportes.js').then(m => m.generarReporteInventario && m.generarReporteInventario());
    } else if (path.includes('avances.html')) { // Si hay una página de avances
        setupAvancesPage();
    }
});
