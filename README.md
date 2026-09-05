# Constructora GG - Plataforma de Gestión de Proyectos

![Estado del Proyecto](https://img.shields.io/badge/Estado-Estable-green)
![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?logo=fastapi&logoColor=white)
![Vanilla JS](https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E?logo=javascript&logoColor=black)
![SQLite](https://img.shields.io/badge/DB-SQLite-003B57?logo=sqlite&logoColor=white)

Constructora GG es una solución integral diseñada para optimizar la gestión de proyectos de construcción. La plataforma permite la coordinación eficiente entre administradores, líderes de proyecto y operarios, centralizando el control de inventarios, tareas, avances y seguridad. https://constructora.paujity.com

---

## Características Principales

### Gestión de Proyectos y Tareas
- Creación y seguimiento detallado de proyectos de construcción.
- Asignación de tareas con prioridades, fechas límite y seguimiento en tiempo real.
- Control de avance acumulado e historial de reportes no editable para trazabilidad.

### Control de Inventario Inteligente
- **Inventario Global vs Proyecto:** Asignación específica de materiales a frentes de obra.
- **Reporte de Uso:** Los operarios reportan múltiples materiales utilizados directamente desde la tarea.
- **Alertas de Stock:** Notificaciones automáticas al administrador cuando un pedido supera las existencias globales.

### Gestión de Usuarios y Roles
- **Administrador:** Control total, reset de contraseñas, auditoría de alertas y gestión global.
- **Líder de Proyecto:** Supervisión de equipos, gestión de tareas y solicitudes de materiales.
- **Operario:** Interfaz simplificada para reporte de avances y materiales.

### Seguridad
- **Shorthand Login:** Inicio de sesión rápido usando solo el nombre de usuario (sin escribir `@constructora-gg.com`).
- **Recuperación Asistida:** Solicitud de cambio de contraseña directa al administrador mediante alertas internas.

---

## Stack Tecnológico

- **Backend:** FastAPI (Python 3.11) con SQLAlchemy ORM
- **Base de Datos:** SQLite (embebida, no requiere motor externo)
- **Seguridad:** JWT + Bcrypt
- **Frontend:** HTML5, CSS3 (variables + grid), JavaScript ES6+ vanilla

---

## Requisitos Previos

Solo necesitas tener instalado en tu máquina:

| Herramienta | Versión mínima | Instalación |
| :--- | :--- | :--- |
| **Docker** | 24.x | https://docs.docker.com/get-docker/ |
| **Docker Compose** | v2 (incluido en Docker Desktop) | Incluido con Docker Desktop |

> No se requiere Python, Node.js, ni ninguna otra dependencia en el host.

Verifica que estén disponibles:
```bash
docker --version
docker compose version
```

---

## Instalación y Puesta en Marcha

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd Cris
```

### 2. Iniciar el proyecto
```bash
./start.sh
```

Esto hace automáticamente:
- Crea `backend/.env` con valores por defecto si no existe
- Construye las imágenes Docker (solo la primera vez o tras cambios en dependencias)
- Levanta los contenedores en segundo plano
- El backend ejecuta `seed.py` al arrancar (crea tablas y datos iniciales)

### 3. Abrir en el navegador
```
http://localhost:8080
```

---

## Detener el Proyecto

```bash
./stop.sh
```

Detiene y elimina los contenedores. Los datos de la base de datos persisten en `database/`.

---

## Desarrollo: Cambios en Caliente

No es necesario reconstruir las imágenes para cambios de código:

- **Frontend** (`frontend/`): los cambios se reflejan inmediatamente al recargar el navegador.
- **Backend** (`backend/`): uvicorn detecta los cambios en archivos `.py` y reinicia el servidor automáticamente en segundos.

Solo se necesita reconstruir (`./start.sh` vuelve a hacer `--build`) cuando cambien las dependencias en `requirements.txt` o los `Dockerfile`.

---

## Credenciales de Prueba

| Rol | Usuario | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `admin` | `admin123` |
| **Líder de Proyecto** | `david.lider` | `lider123` |
| **Operario** | `pedro.operario` | `operario123` |

---

## Solución de Problemas

### Puerto 8000 u 8080 ya en uso
```bash
# Ver qué proceso usa el puerto
sudo lsof -i :8000
sudo lsof -i :8080

# Liberar puerto (Linux)
fuser -k 8000/tcp
fuser -k 8080/tcp
```

### Reinicio limpio (eliminar imágenes y reconstruir todo)
```bash
./stop.sh
docker compose down --volumes --rmi all
./start.sh
```

### Ver logs de los contenedores
```bash
docker compose logs -f backend
docker compose logs -f frontend
```

---

Desarrollado como proyecto formativo SENA ADSO - 2025/2026.
