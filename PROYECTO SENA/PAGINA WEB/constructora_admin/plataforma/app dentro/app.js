// Configuración Global de la API
const API_URL = "http://localhost:8000";

// Ayudante para obtener headers con Token (Bearer)
const getAuthHeaders = () => {
    const token = localStorage.getItem("access_token");
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
};

// Función para configurar la UI dinámicamente según el rol
const setupUI = (roleId) => {
    console.log('Configurando UI para Rol:', roleId);
    
    // 1. Definir nombres de roles
    const roleMap = {
        1: { name: "Administrador", label: "Panel de Administración", hint: "Gestión global de la constructora." },
        2: { name: "Líder", label: "Panel del Líder", hint: "Gestión de proyectos y tareas asignadas." },
        3: { name: "Operario", label: "Panel de Operario", hint: "Reporte de avances y tareas diarias." }
    };

    const currentRole = roleMap[roleId] || { name: "Usuario", label: "Panel", hint: "" };

    // 2. Actualizar textos de cabecera y sidebar
    const roleDisplayName = document.getElementById('role-display-name');
    const userRoleLabel = document.getElementById('user-role-label');
    const roleHint = document.getElementById('role-hint');
    const welcomeTitle = document.getElementById('welcome-title');

    if (roleDisplayName) roleDisplayName.textContent = currentRole.label;
    if (userRoleLabel) userRoleLabel.textContent = currentRole.name;
    if (roleHint) roleHint.textContent = currentRole.hint;
    if (welcomeTitle) welcomeTitle.textContent = `Bienvenido, ${currentRole.name}`;

    // 3. Mostrar/Ocultar elementos según clases de rol
    const roleClasses = ['role-admin', 'role-lider', 'role-operario'];
    const currentClass = `role-${currentRole.name.toLowerCase().replace('í', 'i')}`;

    // Primero ocultamos todos los que tengan alguna clase de rol
    roleClasses.forEach(cls => {
        document.querySelectorAll(`.${cls}`).forEach(el => {
            el.style.display = 'none';
        });
    });

    // Luego mostramos los que correspondan al rol actual
    document.querySelectorAll(`.${currentClass}`).forEach(el => {
        // Restaurar display según tipo de elemento
        if (el.tagName === 'A') {
            el.style.display = 'flex'; // Los enlaces nav-link suelen ser flex
        } else if (el.classList.contains('card')) {
            el.style.display = 'block';
        } else {
            el.style.display = ''; // Valor por defecto del CSS
        }
    });
};

// Asegurar que el DOM esté listo antes de ejecutar cualquier lógica
window.onload = () => {
    console.log('Script app.js: DOM cargado correctamente');

    // --- DECODIFICAR TOKEN Y CONFIGURAR UI ---
    const token = localStorage.getItem("access_token");
    if (token && (document.getElementById('unified-nav') || document.querySelector('.role-section'))) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const payload = JSON.parse(window.atob(base64));
            setupUI(payload.role);
            
            // Actualizar nombre en el User Chip si existe en el payload
            const userFullName = document.getElementById('user-full-name');
            const userInitials = document.getElementById('user-initials');
            if (userFullName && payload.sub) {
                userFullName.textContent = payload.sub;
                userInitials.textContent = payload.sub.substring(0, 2).toUpperCase();
            }
        } catch (e) {
            console.error('Error al decodificar token en onload:', e);
        }
    }

    // ------------------------------------------------------------------
    // 0. LÓGICA DE INICIO DE SESIÓN (UNIFICADA)
    // ------------------------------------------------------------------
    const loginForm = document.querySelector('.auth-form') || document.getElementById('login-form');
    
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('username');
            const passwordInput = document.getElementById('password');
            if (!emailInput || !passwordInput) return;

            const formData = new URLSearchParams();
            formData.append('username', emailInput.value);
            formData.append('password', passwordInput.value);

            try {
                const response = await fetch(`${API_URL}/auth/login`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem("access_token", data.access_token);
                    alert('¡Acceso concedido! Redirigiendo al Dashboard Unificado...');
                    // REDIRECCIÓN UNIFICADA (Desde plataforma/index.html)
                    window.location.href = 'app dentro/dashboard.html';
                } else {
                    alert(`Error: ${data.detail || 'Credenciales inválidas'}`);
                }
            } catch (error) {
                alert('Error técnico: ' + error.message);
            }
        });
    }

    // ------------------------------------------------------------------
    // 2. LÓGICA DE UI Y LOGOUT
    // ------------------------------------------------------------------
    
    // Cierre de sesión unificado
    const logoutBtn = document.getElementById('logout-button-unified') || document.getElementById('logout-button-admin') || document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem("access_token");
            alert('Sesión cerrada.');
            window.location.href = '../index.html'; 
        });
    }

    // El resto de la lógica de carga de usuarios, etc., se mantiene para cuando el Admin acceda...
    const userListContainer = document.getElementById("userList");
    if (userListContainer) cargarUsuarios();
};
