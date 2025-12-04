document.addEventListener("DOMContentLoaded", () => {
  // ----- TAREAS: filtros chips -----
  const tasksList = document.getElementById("tasksList");
  const chipAll = document.getElementById("chipAll");
  const chipInProgress = document.getElementById("chipInProgress");
  const chipPending = document.getElementById("chipPending");

  if (tasksList && chipAll && chipInProgress && chipPending) {
    const chips = [chipAll, chipInProgress, chipPending];

    function setActiveChip(activeChip) {
      chips.forEach((chip) => chip.classList.remove("chip-active"));
      activeChip.classList.add("chip-active");
    }

    chipAll.addEventListener("click", () => {
      setActiveChip(chipAll);
      Array.from(tasksList.children).forEach((task) => {
        task.style.display = "";
      });
    });

    chipInProgress.addEventListener("click", () => {
      setActiveChip(chipInProgress);
      Array.from(tasksList.children).forEach((task) => {
        const isInProgress = task.dataset.status === "en-curso";
        task.style.display = isInProgress ? "" : "none";
      });
    });

    chipPending.addEventListener("click", () => {
      setActiveChip(chipPending);
      Array.from(tasksList.children).forEach((task) => {
        task.style.display = "none";
      });
    });

    // Detalles de tarea
    document.querySelectorAll(".btn-ver-detalles").forEach((btn) => {
      btn.addEventListener("click", () => {
        const taskCard = btn.closest(".task-card");
        const details = taskCard.querySelector(".task-details");
        const visible = details.style.display === "block";

        details.style.display = visible ? "none" : "block";
        btn.querySelector("span").textContent = visible ? "Ver detalles" : "Ocultar detalles";
      });
    });
  }

  // ----- AVANCES: rango, contador, reportes -----
  const progresoRange = document.getElementById("progresoRange");
  const progresoLabel = document.getElementById("progresoLabel");
  const observaciones = document.getElementById("observaciones");
  const charCounter = document.getElementById("charCounter");
  const btnEnviarReporte = document.getElementById("btnEnviarReporte");
  const tareaSelect = document.getElementById("tareaSelect");
  const reportsList = document.getElementById("reportsList");

  if (progresoRange && progresoLabel) {
    progresoRange.addEventListener("input", () => {
      progresoLabel.textContent = progresoRange.value + "%";
    });
  }

  if (observaciones && charCounter) {
    observaciones.addEventListener("input", () => {
      charCounter.textContent = observaciones.value.length;
    });
  }

  if (btnEnviarReporte && tareaSelect && reportsList && progresoRange && progresoLabel && observaciones && charCounter) {
    btnEnviarReporte.addEventListener("click", () => {
      const tarea = tareaSelect.value;
      if (!tarea) {
        alert("Selecciona una tarea antes de enviar el reporte.");
        return;
      }

      const progreso = progresoRange.value;
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

      reportsList.prepend(reportItem);

      // reset
      observaciones.value = "";
      charCounter.textContent = "0";
      progresoRange.value = "0";
      progresoLabel.textContent = "0%";
      tareaSelect.value = "";
      alert("Reporte enviado correctamente.");
    });
  }

  // ----- MATERIALES: buscador -----
  const searchMateriales = document.getElementById("searchMateriales");
  const materialsList = document.getElementById("materialsList");

  if (searchMateriales && materialsList) {
    const materialItems = materialsList.querySelectorAll(".material-item");

    searchMateriales.addEventListener("input", () => {
      const term = searchMateriales.value.toLowerCase().trim();
      materialItems.forEach((item) => {
        const name = item.dataset.name;
        if (!term || name.includes(term)) {
          item.style.display = "";
        } else {
          item.style.display = "none";
        }
      });
    });
  }
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

// ===================================================================
    // 7. LÓGICA DE CIERRE DE SESIÓN
    // ===================================================================
    const logoutButton = document.getElementById('logout-button');

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            // 1. (Opcional) Limpiar cualquier dato de sesión o token de almacenamiento local/sesión
            // localStorage.removeItem('authToken'); 
            // sessionStorage.removeItem('user'); 

            // 2. Notificación y Redirección
            alert('Has cerrado tu sesión. Redirigiendo a la página de inicio de sesión.');
            
            // Redirige a login.html (asumiendo que está un nivel arriba de la carpeta actual)
            // Si el archivo HTML con el botón está en 'app dentro/index.html'
            // y login.html está fuera, usamos '../login.html' para subir un nivel.
            window.location.href = '../index.html'; 
        });
    }