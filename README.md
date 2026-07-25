# 📊 Veeam Dashboard (Edición WinRM / PowerShell)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://reactjs.org/)
[![WinRM](https://img.shields.io/badge/WinRM-HTTPS%205986-red.svg)](https://learn.microsoft.com/en-us/windows/winrm/)

**Veeam Dashboard (WinRM Edition)** es un sistema de monitoreo en tiempo real y visualización para **Veeam Backup & Replication (VBR)**. 

A diferencia de la versión API REST, esta edición se conecta directamente al servidor Veeam mediante **WinRM (Windows Remote Management - HTTPS)** para ejecutar comandos PowerShell nativos (`Veeam.Backup.PowerShell`), almacenando la información en una base de datos local **SQLite** para maximizar la velocidad de respuesta, permitir consulta offline y generar reportes y diagramas históricos.

---

## 🏛️ Arquitectura del Sistema

```
┌─────────────────────────┐          HTTP          ┌───────────────────────────┐
│                         │  <-------------------> │                           │
│  Frontend (React.js)    │   API REST (Port 3001) │   Backend (Node.js)       │
│  http://localhost:3000  │                        │   veeam-api-server        │
└─────────────────────────┘                        └─────────────┬─────────────┘
                                                                 │ WinRM (HTTPS 5986)
                                                                 │ PowerShell Cmdlets
                                                                 ▼
                                                   ┌───────────────────────────┐
                                                   │ Servidor Veeam B&R        │
                                                   │ (Veeam PowerShell Module) │
                                                   └───────────────────────────┘
```

---

## 🖼️ Capturas de Pantalla (Preview)

### 📊 Dashboard Principal y Estado de Jobs
![Dashboard - Resumen de Jobs y Repositorios](./images/ej2.png)

### 📋 Historial de Sesiones y Exportación
![Historial de Jobs](./images/ej1.png)

### 🗺️ Topología y Esquema de Conexiones de Backup
![Diagrama de Topologia de Backup](./images/ej3.png)

### 📜 Visor de Logs y Trazas WinRM/PowerShell
![Visor de Logs de Jobs](./images/ej4.png)

---

## 📁 Estructura del Proyecto

```
veeam-dash/
├── Setup-WinRM.ps1           # Script PowerShell para habilitar WinRM en Servidor Veeam
├── README.md                 # Documentación del proyecto
├── .gitignore                # Reglas de exclusión para Git
├── veeam-api-server/         # Backend (Node.js + Express + SQLite + WinRM)
│   ├── .env.example          # Plantilla de variables de entorno
│   ├── database.js           # Gestión y esquema de base de datos SQLite
│   ├── winrmService.js       # Servicio de comunicación WinRM
│   ├── index.js              # Servidor API Express
│   └── package.json
└── veeam-dashboard/          # Frontend (React.js)
    ├── src/
    │   ├── App.js            # Componente principal y rutas
    │   ├── DashboardPage.js  # Vista principal de estados de backups
    │   ├── ConfigPage.js     # Configuración de conexiones
    │   ├── LogsPage.js       # Vista detallada de logs
    │   └── DiagramsPage.js   # Gráficos y diagramas de arquitectura
    └── package.json
```

---

## 📋 Requisitos Previos

1. **Servidor Veeam Backup & Replication (VBR)**:
   - Sistema Operativo Windows Server.
   - Módulo `Veeam.Backup.PowerShell` instalado (incluido con Veeam B&R).
   - Servicio WinRM activo en puerto HTTPS 5986.

2. **Servidor Backend / Cliente**:
   - **Node.js** (v18.x o superior)
   - **npm** (v9.x o superior)

---

## ⚙️ 1. Configuración del Servidor Veeam (WinRM)

En el Servidor de Veeam Backup & Replication, ejecuta PowerShell como **Administrador** y utiliza el script incluido `Setup-WinRM.ps1` para abrir y asegurar la conexión WinRM:

```powershell
# 1. Abre PowerShell como Administrador en el Servidor Veeam
# 2. Revisa y ajusta las variables $IpVeeam y $AllowedIPs en Setup-WinRM.ps1
.\Setup-WinRM.ps1
```

> 💡 **Nota**: El script genera un certificado SSL autofirmado, crea un Listener en el puerto `5986` y habilita la regla en el Windows Firewall únicamente para las IPs autorizadas de tu backend.

---

## 🛠️ 2. Instalación y Configuración del Proyecto

### Clonar el repositorio:
```bash
git clone https://github.com/jh4n3r/veeam-dash.git
cd veeam-dash
```

### Configuración del Backend (`veeam-api-server`):
```bash
cd veeam-api-server
npm install
```

Crea un archivo `.env` basado en la plantilla `.env.example`:
```bash
cp .env.example .env
```

Edita `veeam-api-server/.env` con tus credenciales WinRM:
```env
# --- Conexión WinRM a Servidor Veeam ---
VEEAM_USER="DOMINIO\usuario"
VEEAM_PASS="TuPasswordWinRM"
VEEAM_SERVER="192.168.X.X"
VEEAM_WINRM_PORT="5986"

# --- Configuración del Servidor API ---
PORT=3001
FRONTEND_URL="http://localhost:3000"

# --- Notificaciones Email SMTP (Opcional) ---
EMAIL_USER="notificaciones@dominio.com"
EMAIL_PASS="TuPasswordEmail"
EMAIL_TO="admin@dominio.com"
```

### Configuración del Frontend (`veeam-dashboard`):
```bash
cd ../veeam-dashboard
npm install
```

---

## 🚀 Cómo Ejecutar

### Iniciar Backend (API Node.js):
```bash
cd veeam-api-server
node index.js
```
El servidor backend se iniciará en `http://localhost:3001`.

### Iniciar Frontend (React UI):
```bash
cd veeam-dashboard
npm start
```
La aplicación React se abrirá en `http://localhost:3000`.

---

## 🔒 Seguridad y Buenas Prácticas de Git

Para evitar subir información sensible a GitHub, asegúrate de mantener actualizados los patrones de exclusión en `.gitignore`:

- **NUNCA subas archivos `.env`** que contengan nombres de usuario, contraseñas o nombres de dominio.
- **NUNCA subas la base de datos `veeam_history.db`** producida en entornos reales.
- **NUNCA subas llaves o certificados SSL** (`*.cer`, `*.pem`, `*.key`).

---

## 🧑‍💻 Autor y Contacto

- **Autor**: jh4n3r
- **Email**: [jh4n3r@outlook.com](mailto:jh4n3r@outlook.com)
- **Repositorio GitHub**: [https://github.com/jh4n3r/veeam-dash](https://github.com/jh4n3r/veeam-dash)

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
