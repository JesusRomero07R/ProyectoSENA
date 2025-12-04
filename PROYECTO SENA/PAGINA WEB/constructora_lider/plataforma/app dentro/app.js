document.addEventListener("DOMContentLoaded", () => {
    
    // ==================================================================
    // 0. FUNCIÓN PARA INYECTAR CSS DEL BUSCADOR
    // ==================================================================
    const injectSearchStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* --- ESTILOS INYECTADOS PARA LA BÚSQUEDA Y CARGA --- */
            .search-container-wrapper {
                position: relative;
                min-height: 200px;
            }
            .loading-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.85); 
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10;
                border-radius: var(--radius-md);
                transition: opacity 0.3s ease-in-out;
            }
            .spinner {
                border: 4px solid var(--border);
                border-top: 4px solid var(--primary);
                border-radius: 50%;
                width: 35px;
                height: 35px;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .hidden {
                display: none !important;
                opacity: 0;
            }
            .input-text-dynamic {
                /* Clase para los inputs creados o detectados por JS */
                width: 100%;
                padding: 10px 15px;
                border: 1px solid var(--border);
                border-radius: var(--radius-md);
                font-size: 1rem;
                margin-bottom: 15px;
            }
        `;
        document.head.appendChild(style);
    };

    // ==================================================================
    // 1. LÓGICA GENERAL DE DETALLES Y PROGRESO (Mantenida y Correcta)
    // ==================================================================

    // --- TAREAS: Mostrar/Ocultar detalles ---
    document.querySelectorAll(".btn-ver-detalles").forEach((btn) => {
        btn.addEventListener("click", () => {
            const taskCard = btn.closest(".task-card");
            const details = taskCard.querySelector(".task-details-content"); 
            const label = btn.querySelector("span:first-child");

            if (details.style.display === "block") {
                details.style.display = "none";
                label.textContent = "Ver detalles";
            } else {
                details.style.display = "block";
                label.textContent = "Ocultar detalles";
            }
        });
    });

    // --- BARRAS DE PROGRESO ---
    const updateProgressBars = () => {
        document.querySelectorAll('.progress-section').forEach(section => {
            const progressFill = section.querySelector('.progress-fill');
            const progressTextElement = section.querySelector('span'); 
            let progress = 0;

            if (progressFill && progressTextElement) {
                const progressText = progressTextElement.textContent || '0%';
                const match = progressText.match(/(\d+)%/);
                progress = match ? parseInt(match[1]) : 0;
            }

            if (progressFill) {
                progressFill.style.width = `${progress}%`;
            }

            const projectCard = section.closest('.project-lider-card') || section.closest('.project-main-card');
            const statusTag = projectCard ? projectCard.querySelector('.status-tag-finalizado') : null;

            if (statusTag && progressFill) {
                progressFill.style.backgroundColor = '#059669'; // Verde
            } else if (progressFill) {
                progressFill.style.backgroundColor = 'var(--primary)';
            }
        });
    };

    updateProgressBars();


    // ==================================================================
    // 3. LÓGICA DE BÚSQUEDA Y CREACIÓN DINÁMICA (FIX CRÍTICO AQUÍ)
    // ==================================================================

    injectSearchStyles(); 

    const listSelectors = [
        '.user-list', '.project-list-lider', '.material-list-lider', 
        '.tasks-list', '.material-list-admin', '.project-list', 
        '.user-list-lider', '.project-card-list', '.tasks-recent-list'
    ];
    
    const listContainers = document.querySelectorAll(listSelectors.join(', '));

    listContainers.forEach(contentList => {
        if (!contentList) return;

        let searchInput = null;
        
        // 1. INTENTAR ENCONTRAR INPUT EXISTENTE (FIX CRÍTICO)
        const previousElement = contentList.previousElementSibling;

        // Caso 1: El input es un hermano directo (e.g., <input> <div class="list">)
        if (previousElement && previousElement.tagName === 'INPUT' && previousElement.type === 'text') {
            searchInput = previousElement;
        } 
        
        // Caso 2: El input está dentro de un contenedor hermano (e.g., <div class="action-bar"><input></div> <div class="list">). ESTE FUE EL ERROR
        else if (previousElement && previousElement.querySelector('input[type="text"]')) {
            searchInput = previousElement.querySelector('input[type="text"]');
        }

        // 2. CREAR INPUT SI NO EXISTE (SOLO PARA INICIO/DASHBOARD)
        if (!searchInput) {
            // Solo creamos el input si es una lista del Dashboard (Inicio)
            if (contentList.classList.contains('project-card-list') || contentList.classList.contains('tasks-recent-list')) {
                searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.placeholder = 'Buscar en lista...';
                searchInput.className = 'input-text-dynamic'; 
                
                contentList.parentNode.insertBefore(searchInput, contentList);
            } else {
                return;
            }
        }
        
        // 3. CREAR WRAPPER Y OVERLAY DE CARGA
        const listWrapper = document.createElement('div');
        listWrapper.className = 'search-container-wrapper';

        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loadingOverlay_' + Math.random().toString(36).substring(2, 9);
        loadingOverlay.className = 'loading-overlay hidden';
        loadingOverlay.innerHTML = '<div class="spinner"></div>';

        // Envolvemos la lista
        contentList.parentNode.insertBefore(listWrapper, contentList);
        listWrapper.appendChild(contentList);
        
        // Insertamos el overlay
        listWrapper.appendChild(loadingOverlay);

        
        // 4. LÓGICA DE FILTRADO 
        const itemSelectors = [
            '.user-card', '.project-lider-card', '.material-item-lider',
            '.task-card', '.material-item-admin', '.user-card-lider',
            '.project-main-card', '.project-item', '.task-recent-item'
        ];
        const items = Array.from(contentList.querySelectorAll(itemSelectors.join(', ')));

        const filterContent = (searchTerm) => {
            searchTerm = searchTerm.toLowerCase().trim();
            
            items.forEach(item => {
                const itemText = item.textContent.toLowerCase();

                if (itemText.includes(searchTerm)) {
                    item.style.display = ''; 
                } else {
                    item.style.display = 'none'; 
                }
            });
        };

        // 5. EVENTO DE BÚSQUEDA
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            
            loadingOverlay.classList.remove('hidden');

            setTimeout(() => {
                filterContent(query);
                loadingOverlay.classList.add('hidden');
            }, 100); 
        });
    });


    // ==================================================================
    // 4. LÓGICA ESPECÍFICA DE ADMINISTRADOR Y LÍDER (Mantenida)
    // ==================================================================

    const handleMaterialAction = (e) => {
        e.preventDefault();
        const button = e.currentTarget;
        const materialItem = button.closest('.material-item-admin') || button.closest('.material-item-lider');
        const materialName = materialItem ? materialItem.querySelector('.material-name').textContent : 'Material Desconocido';
        let action = '';

        if (button.classList.contains('btn-entrada')) {
            action = 'Entrada (Reposición)';
        } else if (button.classList.contains('btn-salida')) {
            action = 'Salida (Consumo)';
        } else if (button.classList.contains('btn-actualizar')) {
            action = 'Actualización de Stock';
        } else if (button.textContent.includes('Solicitar')) {
             action = 'Solicitud de Material';
        } else if (button.textContent.includes('Ver Uso')) {
             action = 'Visualización de Uso';
        }

        alert(`Simulación de ${action} para:\n\nMaterial: ${materialName}\n\nAquí se abriría el modal o formulario correspondiente.`);
    };

    document.querySelectorAll('.btn-entrada, .btn-salida, .btn-actualizar, .material-item-lider button').forEach(button => {
        button.addEventListener('click', handleMaterialAction);
    });

});

// ===================================================================
    // 5. LÓGICA DE TOGGLE PARA PREGUNTAS FRECUENTES (FAQ)
    // ===================================================================

    const handleFaqToggle = (e) => {
        const question = e.currentTarget;
        const faqItem = question.closest('.faq-item');
        
        // Cierra todos los demás FAQ's abiertos (comportamiento de Acordeón)
        document.querySelectorAll('.faq-item.open').forEach(item => {
            if (item !== faqItem) {
                item.classList.remove('open');
            }
        });
        
        // Abre o cierra el FAQ clickeado
        faqItem.classList.toggle('open');
    };

    // Asignar el evento click a todas las preguntas
    document.querySelectorAll('.faq-question').forEach(question => {
        question.addEventListener('click', handleFaqToggle);
    });

   // ===================================================================
// 6. LÓGICA DE INICIO DE SESIÓN Y RECUPERACIÓN (LOGIN)
// ===================================================================

// Manejar el formulario de Login
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        // Simulación de credenciales de Líder
        if (username === 'paujity' && password === 'leader') { // Usamos 'leader' como en el boceto
            // Notificación de éxito
            alert('¡Acceso concedido! Bienvenido Líder de Proyecto.'); 
            // 👇 RUTA DE REDIRECCIÓN ACTUALIZADA 👇
            window.location.href = 'app dentro/index.html'; 
        } else {
            // Notificación de error (ajustada para mantener la referencia a 'leader/leader')
            alert('Error: Usuario o contraseña incorrectos. Intenta con leader / leader.');
        }
    });
}

// Manejar el formulario de Recuperación de Contraseña
const recoveryForm = document.getElementById('recovery-form');
if (recoveryForm) {
    recoveryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        
        // Simulación de envío de correo
        alert(`Instrucciones de recuperación enviadas a:\n\n${email}\n\nRevisa tu bandeja de entrada y spam.`);
        
        // Opcional: Redirigir de vuelta al login después de la alerta
        // window.location.href = 'login.html'; 
    });
}

document.addEventListener("DOMContentLoaded", () => {
    
    // ... (Tu código JavaScript existente) ...

    // ===================================================================
    // LÓGICA DE CIERRE DE SESIÓN CORREGIDA
    // ===================================================================
    const logoutButton = document.getElementById('logout-button');

    if (logoutButton) {
        // Se añade el evento 'e' y se usa preventDefault() para evitar interferencias
        logoutButton.addEventListener('click', (e) => { 
            e.preventDefault(); // <-- CORRECCIÓN CLAVE: Detiene la acción predeterminada.

            // SIMULACIÓN: Puedes usar una alerta o un modal antes de redirigir
            alert('Has cerrado tu sesión. Redirigiendo a la página de inicio de sesión.');
            
            // REDIRECCIÓN: Redirige a 'login.html' (o la ruta correcta)
            window.location.href = '../index.html'; 
        });
    }

});