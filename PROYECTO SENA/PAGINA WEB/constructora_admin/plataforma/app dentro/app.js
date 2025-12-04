document.addEventListener("DOMContentLoaded", () => {
  // ------------------------------------------------------------------
  // 1. LÓGICA GENERAL (APLICA A OPERARIO Y ADMINISTRADOR)
  // ------------------------------------------------------------------

  // --- TAREAS: Mostrar/Ocultar detalles (APLICA A OPERARIO) ---
  document.querySelectorAll(".btn-ver-detalles").forEach((btn) => {
    btn.addEventListener("click", () => {
      const taskCard = btn.closest(".task-card");
      const details = taskCard.querySelector(".task-details");
      const label = btn.querySelector("span:first-child");

      details.style.display = details.style.display === "block" ? "none" : "block";
      label.textContent = details.style.display === "block" ? "Ocultar detalles" : "Ver detalles";
    });
  });

  // --- TAREAS: Filtros chips (APLICA A OPERARIO) ---
  const tasksList = document.getElementById("tasksList");
  const chipAll = document.getElementById("chipAll");
  const chipInProgress = document.getElementById("chipInProgress");
  const chipPending = document.getElementById("chipPending");

  if (tasksList && chipAll && chipInProgress && chipPending) {
    const chips = [chipAll, chipInProgress, chipPending];
    const taskItems = Array.from(tasksList.children);

    function setActiveChip(activeChip) {
      chips.forEach((chip) => chip.classList.remove("chip-active"));
      activeChip.classList.add("chip-active");
    }

    // Mostrar todas por defecto (o al hacer clic en 'Todas')
    const filterTasks = (status) => {
      setActiveChip(status === 'all' ? chipAll : (status === 'en-curso' ? chipInProgress : chipPending));
      
      taskItems.forEach((task) => {
        const taskStatus = task.dataset.status;
        let shouldDisplay = true;

        if (status === 'en-curso') {
          shouldDisplay = taskStatus === 'en-curso';
        } else if (status === 'pendiente') {
          shouldDisplay = taskStatus === 'pendiente'; // No hay tareas pendientes visibles en el HTML de ejemplo, pero el filtro está preparado.
        } else if (status === 'all') {
          shouldDisplay = true;
        }

        task.style.display = shouldDisplay ? "" : "none";
      });
    };

    chipAll.addEventListener("click", () => filterTasks('all'));
    chipInProgress.addEventListener("click", () => filterTasks('en-curso'));
    chipPending.addEventListener("click", () => filterTasks('pendiente'));

    // Inicializar el filtro en "Todas"
    filterTasks('all'); 
  }

  // --- AVANCES: Contador de caracteres y rango de progreso (APLICA A OPERARIO) ---
  const observaciones = document.getElementById("observaciones");
  const charCounter = document.getElementById("charCounter");
  const progresoRange = document.getElementById("progreso");
  const progresoLabel = document.getElementById("progresoLabel");
  const formAvances = document.getElementById("formAvances");
  const reportsList = document.getElementById("reportsList");

  if (observaciones && charCounter) {
    observaciones.addEventListener("input", () => {
      charCounter.textContent = observaciones.value.length;
    });
  }

  if (progresoRange && progresoLabel) {
    progresoRange.addEventListener("input", () => {
      progresoLabel.textContent = `${progresoRange.value}%`;
    });
  }

  // --- AVANCES: Manejo del envío del formulario (simulación) (APLICA A OPERARIO) ---
  if (formAvances && reportsList) {
    formAvances.addEventListener("submit", (e) => {
      e.preventDefault();

      const tareaSelect = document.getElementById("tarea");
      const tarea = tareaSelect.options[tareaSelect.selectedIndex].text;
      const progreso = progresoRange.value;

      // Creación del nuevo reporte
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const timeLabel = `${hours}:${minutes} · Hoy`;

      const reportItem = document.createElement("div");
      reportItem.className = "report-item";
      reportItem.innerHTML = `
        <div class="report-main">
          <span class="report-title">${tarea}</span>
          <span class="report-meta">${timeLabel}</span>
        </div>
        <span class="report-progress">${progreso}%</span>
      `;

      // Añadir al inicio de la lista
      reportsList.prepend(reportItem);

      // Limpiar formulario y mostrar alerta
      observaciones.value = "";
      charCounter.textContent = "0";
      progresoRange.value = "0";
      progresoLabel.textContent = "0%";
      tareaSelect.value = "";
      alert("Reporte de avance enviado correctamente.");
    });
  }

  // ----- MATERIALES: Buscador (APLICA A OPERARIO y ADMINISTRADOR) -----
  const searchMateriales = document.getElementById("searchMateriales");
  const materialsList = document.getElementById("materialsList"); 
  const materialsListAdmin = document.getElementById("materialsListAdmin"); 

  const handleSearch = (list) => {
    if (!list) return;

    const input = list.previousElementSibling.querySelector('.search-input, .input-search'); 
    if (!input) return;

    const materialItems = list.querySelectorAll(".material-item, .material-item-admin");

    input.addEventListener("input", () => {
      const term = input.value.toLowerCase().trim();
      materialItems.forEach((item) => {
        // Se asume que el nombre está en el dataset 'data-name' para los de Operario
        // o en el texto del elemento con clase .material-name para los de Admin
        let name = item.dataset.name || item.querySelector('.material-name')?.textContent || '';
        name = name.toLowerCase();

        if (!term || name.includes(term)) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  };

  // Inicializar buscador en la lista de operario (si existe)
  if (materialsList) {
    handleSearch(materialsList);
  }
  // Inicializar buscador en la lista de administrador (si existe)
  if (materialsListAdmin) {
    handleSearch(materialsListAdmin);
  }

  // ------------------------------------------------------------------
  // 2. LÓGICA ESPECÍFICA DE ADMINISTRADOR (admin_proyectos.html)
  // ------------------------------------------------------------------

  // --- PROYECTOS: Manejo de la barra de progreso ---
  const projectList = document.getElementById("projectList");

  if (projectList) {
    // Función para simular el progreso
    const updateProgressBars = () => {
      document.querySelectorAll('.project-main-card').forEach(card => {
        // Obtener el porcentaje (simulado)
        const progressFill = card.querySelector('.progress-fill');
        const metaInfo = card.querySelector('.project-meta-info');

        // Asumiendo que el progreso está en un atributo data-progress
        let progress = parseInt(card.dataset.progress) || 0; 
        
        // Si no tiene data-progress, usar un valor por defecto o leer de un elemento
        if (progress === 0) {
             const progressText = metaInfo ? metaInfo.querySelector('span:first-child')?.textContent : '0%';
             progress = parseInt(progressText.replace('%', '').trim()) || 0;
        }

        progressFill.style.width = `${progress}%`;
        progressFill.textContent = `${progress}%`; // opcional, si la barra fuera ancha
      });
    };

    updateProgressBars();
  }


  // ------------------------------------------------------------------
  // 3. LÓGICA ESPECÍFICA DE ADMINISTRADOR (admin_inventario.html)
  // ------------------------------------------------------------------

  // --- INVENTARIO: Botones de Entrada/Salida (Simulación de Modales) ---
  document.querySelectorAll('.btn-entrada, .btn-salida').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const action = button.classList.contains('btn-entrada') ? 'Entrada (Reposición)' : 'Salida (Consumo)';
      const materialName = button.closest('.material-item-admin').querySelector('.material-name').textContent;
      
      // Simulación de un modal
      alert(`Simulación de ${action} para:\n\nMaterial: ${materialName}\n\nAquí se abriría un modal para ingresar la cantidad.`);
    });
  });

  document.querySelectorAll('.btn-actualizar').forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const materialName = button.closest('.material-item-admin').querySelector('.material-name').textContent;
      alert(`Abriendo formulario de edición para ${materialName}.`);
    });
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

        
        if (username === 'paujity' && password === 'leader') { 
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

// Asegúrate de que este código se ejecute cuando el DOM esté cargado.
document.addEventListener("DOMContentLoaded", () => {
    
    // ... (Tu código de inicio de sesión existente) ...

    // ===================================================================
    // 7. LÓGICA DE CIERRE DE SESIÓN (Admin/Líder)
    // ===================================================================
    const logoutButtonAdmin = document.getElementById('logout-button-admin');

    if (logoutButtonAdmin) {
        logoutButtonAdmin.addEventListener('click', () => {
            // Opcional: limpiar cualquier token de sesión/almacenamiento aquí.
            
            alert('Has cerrado tu sesión. Redirigiendo a la página de inicio de sesión.');
            
            // Redirige a login.html (un nivel arriba de /app dentro/)
            window.location.href = '../index.html'; 
        });
    }

    // ... (El resto de tu código JS) ...

}); // Cierre de DOMContentLoaded