import { API_URL } from './api.js';

export function getPayload() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("Error decodificando el token:", e);
        return null;
    }
}

export function goToLogin() {
    localStorage.removeItem("token");
    const isPage = window.location.pathname.includes('/pages/') || window.location.pathname.includes('/shared/');
    window.location.href = isPage ? '../index.html' : 'index.html';
}

export function setupLogin(formId) {
    const loginForm = document.getElementById(formId);
    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        let correo = document.getElementById("username").value.trim();
        if (correo && !correo.includes("@")) {
            correo += "@constructora-gg.com";
        }
        const pwd = document.getElementById("password").value;
        const msgBox = document.getElementById("loginMsg");
        const submitBtn = loginForm.querySelector("button[type='submit']");
        
        if (msgBox) {
            msgBox.textContent = "";
            msgBox.className = "";
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Iniciando sesión...";
        }

        try {
            const fd = new URLSearchParams();
            fd.append("username", correo);
            fd.append("password", pwd);
            
            const res = await fetch(`${API_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: fd
            });
            
            if (res.ok) {
                const data = await res.json();
                localStorage.setItem("token", data.access_token);
                if (msgBox) {
                    msgBox.className = "success";
                    msgBox.textContent = "Acceso concedido. Redirigiendo...";
                }
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 800);
            } else {
                let errText = "Credenciales incorrectas.";
                try {
                    const err = await res.json();
                    if(err.detail) errText = typeof err.detail === 'string' ? err.detail : "Error en credenciales.";
                } catch(e) {}
                if (msgBox) {
                    msgBox.className = "error shake";
                    msgBox.textContent = errText;
                }
                setTimeout(() => { if (msgBox) msgBox.classList.remove('shake'); }, 500);
            }
        } catch (error) {
            console.error("Error de conexión:", error);
            if (msgBox) {
                msgBox.className = "error";
                msgBox.textContent = "Error de conexión. Intente más tarde.";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Ingresar";
            }
        }
    });
}

export function setupRecovery(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("username").value.trim();
        let msgBox = document.getElementById("recoveryMsg");
        
        if (!msgBox) {
            msgBox = document.createElement("div");
            msgBox.id = "recoveryMsg";
            form.insertBefore(msgBox, form.firstChild);
        }
        
        const submitBtn = form.querySelector("button[type='submit']");
        
        if (msgBox) msgBox.style.display = "none";
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Enviando...";
        }

        try {
            const res = await fetch(`${API_URL}/auth/solicitar-recuperacion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: email })
            });

            if (msgBox) msgBox.style.display = "block";
            
            if (res.ok) {
                if (msgBox) {
                    msgBox.className = "alert alert-success";
                    msgBox.textContent = "Si el correo existe en nuestro sistema, te enviaremos las instrucciones.";
                }
                form.reset();
            } else {
                if (msgBox) {
                    msgBox.className = "alert alert-error";
                    msgBox.textContent = "Ocurrió un error al procesar tu solicitud.";
                }
            }
        } catch (error) {
            if (msgBox) {
                msgBox.style.display = "block";
                msgBox.className = "alert alert-error";
                msgBox.textContent = "Error de conexión. Intente más tarde.";
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = "Recuperar Contraseña";
            }
        }
    });
}
