# Constructora GG - Plataforma de Gestión de Proyectos

![Estado del Proyecto](https://img.shields.io/badge/Estado-Estable-green)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)
![SQLite](https://img.shields.io/badge/DB-SQLite-003B57?logo=sqlite&logoColor=white)

Constructora GG es una solución integral diseñada para optimizar la gestión de proyectos de construcción. La plataforma permite la coordinación eficiente entre administradores, líderes de proyecto y operarios, centralizando el control de inventarios, tareas, avances y seguridad.

---

## 🚀 Características Principales

### 🏗️ Gestión de Proyectos y Tareas
- Creación y seguimiento detallado de proyectos de construcción.
- Asignación de tareas con prioridades, fechas límite y seguimiento de tiempo real.
- Control de avance acumulado y **historial de reportes no editable** para trazabilidad.

### 📦 Control de Inventario Inteligente
- **Inventario Global vs Proyecto:** Asignación específica de materiales a frentes de obra.
- **Reporte de Uso:** Los operarios pueden reportar múltiples materiales utilizados directamente desde la tarea.
- **Alertas de Stock:** Notificaciones automáticas al administrador cuando un pedido supera las existencias globales.

### 👥 Gestión de Usuarios y Roles (Optimizada)
- **Administrador:** Control total, reset de contraseñas, auditoría de alertas y gestión global.
- **Líder de Proyecto:** Supervisión de equipos, gestión de tareas y solicitudes de materiales.
- **Operario:** Interfaz simplificada y eficiente para reporte de avances y materiales.

### 🔐 Seguridad y Accesibilidad
- **Shorthand Login:** Inicio de sesión rápido usando solo el nombre de usuario (sin necesidad de escribir @constructora-gg.com).
- **Recuperación Asistida:** Solicitud de cambio de contraseña directa al administrador mediante alertas internas.

---

## 🛠️ Stack Tecnológico

- **Backend:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.10+) con SQLAlchemy ORM.
- **Base de Datos:** SQLite (Embebida, no requiere instalación de motor externo).
- **Seguridad:** Autenticación JWT (JSON Web Tokens) y Hashing Bcrypt.
- **Frontend:** HTML5 moderno, CSS3 (Variables y Grid) y JavaScript ES6+ (Vanilla JS).

---

## ⚙️ Instalación y Configuración Paso a Paso

### 1. Requisitos Previos
- **Python 3.10** o superior.
- **Git** instalado.

---

### 2. Preparar el Entorno

Abre una terminal en la carpeta raíz del proyecto (`constructora/`) y ejecuta:

#### 🐧 En Linux / macOS
```bash
# 1. Crear entorno virtual
python3 -m venv venv

# 2. ACTIVAR entorno virtual (Debes ver '(venv)' en tu terminal)
source venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt
```

#### 🪟 En Windows (PowerShell)
```powershell
# 1. Crear entorno virtual
python -m venv venv

# 2. ACTIVAR entorno virtual
.\venv\Scripts\Activate.ps1

# 3. Instalar dependencias
pip install -r requirements.txt
```

---

### 3. Configuración de Variables (.env) ⚠️ IMPORTANTE
Asegúrate de seguir en la raíz del proyecto. Copia y pega este comando para crear el archivo de configuración en la carpeta correcta:

**Linux / macOS / PowerShell:**
```bash
echo "SECRET_KEY=super_secret_key_constructora_gg_2026
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60" > backend/.env
```

---

### 4. Inicializar Base de Datos
Desde la raíz del proyecto, entra a la carpeta `backend` y ejecuta el script de inicialización.

**Linux / macOS / Windows (Con venv activado):**
```bash
cd backend
python seed.py
```
*Si esto funciona, verás mensajes de "Tablas verificadas" y "Administrador creado".*

---

## 🏃 Cómo ejecutar el proyecto

Para que el sistema funcione, **DEBES tener dos terminales abiertas** al mismo tiempo:

### Terminal 1: Servidor Backend (API)
1. Abre una terminal en `constructora/`.
2. Activa el entorno virtual: `source venv/bin/activate` (o `.\venv\Scripts\Activate.ps1` en Windows).
3. Entra a la carpeta backend: `cd backend`.
4. Ejecuta el servidor:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: Servidor Frontend (Interfaz)
1. Abre otra terminal en `constructora/`.
2. Entra a la carpeta frontend: `cd frontend`.
3. Ejecuta el servidor de archivos:
```bash
python3 -m http.server 8080
```
*(Si `python3` no funciona en Windows, usa `python`)*


---

## 🔗 Acceso al Sistema
Una vez ambos servidores estén corriendo, abre tu navegador en:

👉 **http://localhost:8080**

---

## 🔐 Credenciales de Prueba

| Rol | Usuario | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` |
| **Líder de Proyecto** | `david.lider` | `lider123` |
| **Operario** | `pedro.operario` | `operario123` |

---

## 🛠️ Solución de Problemas (FAQ)

### ❓ Error: "Address already in use" (Puerto ocupado)
Si ves este error, significa que el puerto 8000 o 8080 está bloqueado por otro proceso.
- **Solución rápida (Linux):** Ejecuta `fuser -k 8000/tcp` y `fuser -k 8080/tcp`.
- **Solución general:** Reinicia tu terminal o cierra cualquier otro servidor que tengas abierto.

### ❓ Error: "ModuleNotFoundError"
Asegúrate de haber activado el entorno virtual (`source venv/bin/activate`) antes de instalar las dependencias con `pip`.

### ❓ No carga la base de datos
Verifica que el archivo `database/constructora_gg.db` exista. Si no existe, vuelve a ejecutar el **Paso 4** (seed.py).

---
Desarrollado como proyecto formativo SENA ADSO - 2025/2026.
