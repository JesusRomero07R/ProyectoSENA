import { getPayload, goToLogin, setupLogin, setupRecovery } from './auth.js';
import { loadComponent, setupUIByRole } from './ui.js';

// Import modules
import { setupProfilePage } from './modules/perfil.js';
import { setupEquipoPage } from './modules/equipo.js';
import { setupProjectPage } from './modules/proyectos.js';
import { setupTasksPage } from './modules/tareas.js';
import { setupProjectDetailPage } from './modules/detalles.js';
import { setupMaterialesPage } from './modules/materiales.js';
import { setupInventoryPage } from './modules/inventario.js';
import { setupUserPage } from './modules/usuarios.js';
import { setupReportsPage, setupAvancesPage } from './modules/reportes.js';

function applyTheme(dark) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
}

document.addEventListener("DOMContentLoaded", async () => {
    // Aplicar tema guardado antes de renderizar componentes
    const savedDark = localStorage.getItem('theme') === 'dark';
    document.documentElement.setAttribute('data-theme', savedDark ? 'dark' : 'light');

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
        document.body.classList.add('js-roles-ready');
        
        // Setup header info
        const userNameEl   = document.getElementById("user-full-name");
        const userRoleEl   = document.getElementById("user-role-label");
        const userAvatar   = document.getElementById("user-initials");
        const roleDisplay  = document.getElementById("role-display-name");
        const roleLabel    = payload.role === 1 ? 'Administrador' : (payload.role === 2 ? 'Líder de Proyecto' : 'Operario');

        const fullName = `${payload.nombre || ''} ${payload.apellido || ''}`.trim();
        if (userNameEl)  userNameEl.textContent  = fullName;
        if (userRoleEl)  userRoleEl.textContent  = roleLabel;
        if (userAvatar)  userAvatar.textContent  = payload.nombre ? payload.nombre[0].toUpperCase() : 'U';
        if (roleDisplay) roleDisplay.textContent = roleLabel;

        const roleHint = document.getElementById('role-hint');
        if (roleHint) roleHint.textContent = `${fullName} · ${roleLabel}`;

        // Sync theme icon after header loads
        applyTheme(localStorage.getItem('theme') === 'dark');

        const btnTheme = document.getElementById('btnToggleTheme');
        if (btnTheme) {
            btnTheme.addEventListener('click', () => {
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                localStorage.setItem('theme', isDark ? 'light' : 'dark');
                applyTheme(!isDark);
            });
        }
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
        if (payload) { window.location.href = 'dashboard.html'; return; }
        setupLogin("loginForm");
    } else if (path.includes('recuperar_contrasena.html')) {
        setupRecovery("recovery-form");
    } else if (path.includes('dashboard.html')) {
        // En los módulos, la función puede llamarse setupDashboard o similar.
        // Dado que se exportaron con los nombres originales de app.js, vamos a ajustarlos.
        // Aquí uso los nombres de las funciones que extrajimos de app.js:
        import('./modules/dashboard.js?v=' + Date.now()).then(m => m.cargarDashboardResumen && m.cargarDashboardResumen());
        import('./modules/dashboard.js?v=' + Date.now()).then(m => m.setupKPIShortcuts && m.setupKPIShortcuts());
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
