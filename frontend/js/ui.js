import { getPayload } from './auth.js';

export function setupUIByRole(roleId) {
    const adminOnly    = document.querySelectorAll('.role-admin-only');
    const liderOnly    = document.querySelectorAll('.role-lider-only');
    const operarioOnly = document.querySelectorAll('.role-operario-only');
    const noOperario   = document.querySelectorAll('.role-no-operario');
    const liderYAdmin  = document.querySelectorAll('.role-lider-admin');
    const noAdmin      = document.querySelectorAll('.role-no-admin');

    [...adminOnly, ...liderOnly, ...operarioOnly, ...noOperario, ...liderYAdmin, ...noAdmin]
        .forEach(el => { el.style.display = 'none'; });

    const roleClass = roleId === 1 ? 'role-admin' : (roleId === 2 ? 'role-lider' : 'role-operario');
    document.querySelectorAll(`.role-section.${roleClass}`).forEach(el => el.style.display = 'block');

    if (roleId === 1) {
        adminOnly.forEach(el => el.style.display = '');
        noOperario.forEach(el => el.style.display = '');
        liderYAdmin.forEach(el => el.style.display = '');
    } else if (roleId === 2) {
        liderOnly.forEach(el => el.style.display = '');
        noOperario.forEach(el => el.style.display = '');
        liderYAdmin.forEach(el => el.style.display = '');
        noAdmin.forEach(el => el.style.display = '');
    } else if (roleId === 3) {
        operarioOnly.forEach(el => el.style.display = '');
        noAdmin.forEach(el => el.style.display = '');
    }
}

function setActiveNav() {
    const current = window.location.pathname.split('/').pop() || 'dashboard.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href')?.split('/').pop() || '';
        link.classList.toggle('nav-active', href === current);
    });
}

export async function loadComponent(selector, url) {
    const el = document.querySelector(selector);
    if (!el) return;
    try {
        const res = await fetch(url);
        if (res.ok) {
            let html = await res.text();
            // Si estamos en un subdirectorio (pages/ o shared/), arreglamos los links
            const isSubDir = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/shared/');
            if (isSubDir) {
                // dashboard.html -> ../dashboard.html
                html = html.replace(/href="dashboard\.html"/g, 'href="../dashboard.html"');
                // pages/algo.html -> algo.html (if we are in pages/)
                if (window.location.pathname.includes('/pages/')) {
                    html = html.replace(/href="pages\/([^"]+)"/g, 'href="$1"');
                    html = html.replace(/href="shared\/([^"]+)"/g, 'href="../shared/$1"');
                } else {
                    html = html.replace(/href="pages\/([^"]+)"/g, 'href="../pages/$1"');
                    html = html.replace(/href="shared\/([^"]+)"/g, 'href="$1"');
                }
            }
            el.innerHTML = html;
            if (selector === '#app-sidebar') setActiveNav();
        } else {
            console.error(`Failed to load component from ${url}`);
        }
    } catch (e) {
        console.error(`Error loading component ${url}:`, e);
    }
}

export function renderProjectSubNavigation(activeTab) {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get("project_id") || params.get("id");
    if (!projectId || projectId === "all") return;

    const payload = getPayload();
    if (!payload) return;
    const isOperario = payload.role === 3;

    const contentSec = document.querySelector(".content");
    if (!contentSec) return;

    if (document.getElementById("projectSubNavRow")) return;

    const nav = document.createElement("div");
    nav.id = "projectSubNavRow";
    nav.className = "chips-row project-sub-nav";

    const tabs = [];
    
    if (!isOperario) {
        tabs.push({ id: 'detalles', label: '🛈 Detalles', href: `detalles_proyecto.html?id=${projectId}` });
    }
    tabs.push({ id: 'tareas', label: '✍ Tareas', href: `tareas.html?project_id=${projectId}` });
    if (!isOperario) {
        tabs.push({ id: 'equipo', label: '👤 Equipo', href: `equipo.html?project_id=${projectId}` });
    }
    tabs.push({ id: 'inventario', label: '📦 Inventario', href: `materiales.html?project_id=${projectId}` });

    nav.innerHTML = tabs.map(t => `
        <a href="${t.href}" class="chip ${activeTab === t.id ? 'chip-active' : ''}" style="text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            ${t.label}
        </a>
    `).join('');

    // Envolver en un contenedor centrado para no estirar el fondo gris
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.width = "100%";
    wrapper.style.justifyContent = "center";
    wrapper.style.marginBottom = "20px";
    wrapper.id = "projectSubNavWrapper";
    
    wrapper.appendChild(nav);

    const header = document.querySelector(".content-header");
    const projectHeader = document.querySelector(".project-header-detail");
    
    if (header) {
        header.insertAdjacentElement('beforebegin', wrapper);
    } else if (projectHeader) {
        projectHeader.insertAdjacentElement('beforebegin', wrapper);
    } else {
        contentSec.prepend(wrapper);
    }
}
