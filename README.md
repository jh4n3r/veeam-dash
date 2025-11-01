# Veeam Dashboard (React + Node.js)

Este proyecto es un dashboard web para monitorear **Veeam Backup & Replication (VBR)** y **Veeam ONE**, construido con **React** en el frontend y **Node.js/Express** en el backend.  
Utiliza **SQLite** como caché local para visualización offline y generación de reportes automáticos.

---

## 📁 Estructura del proyecto

```
/
├── veeam-api-server/ (Backend - Node.js)
│   ├── .env (¡IMPORTANTE! Se crea/edita desde la UI o manualmente)
│   ├── veeam_history.db (Base de datos de caché)
│   ├── database.js
│   ├── index.js
│   ├── package.json
│   └── ... (otros servicios)
└── veeam-dashboard/ (Frontend - React)
    ├── public/
    │   └── index.html (Aquí se cambia el título de la app)
    ├── src/
    │   ├── App.js
    │   ├── DashboardPage.js
    │   ├── ConfigPage.js
    │   └── ... (otros componentes)
    └── package.json
```

---

## ⚙️ Archivo de configuración `.env`

Ejemplo: `veeam-api-server/.env`

```bash
# --- API de Veeam Backup & Replication (Puerto 9419) ---
VEEAM_USER="user"
VEEAM_PASS="Pass"
VEEAM_SERVER="192.168.1.x"
VEEAM_PORT="9419"
VEEAM_API_VERSION="1.2-rev1"

# --- API de Veeam ONE (Puerto 1239) ---
VEEAM_ONE_SERVER="192.168.1.x"
VEEAM_ONE_PORT="1239"
VEEAM_ONE_USER="VEEAM-SERVER\\user"
VEEAM_ONE_PASS="Pass"

# --- Configuración de Email (O365) ---
EMAIL_USER=""
EMAIL_PASS=""
EMAIL_TO=""
```

---

## 🧩 Requisitos

- Node.js v18 o superior
- npm

---

## 🛠️ Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/jh4n3r/veeam-dash.git
cd veeam-dash
```

2. Instalar dependencias del backend:
```bash
cd veeam-api-server
npm install
```

3. Instalar dependencias del frontend:
```bash
cd ../veeam-dashboard
npm install
```

---

## 🚀 Cómo ejecutar

### Backend (API)
```bash
cd veeam-api-server
node index.js
```
Servidor: `http://localhost:3001`

### Frontend (React)
```bash
cd veeam-dashboard
npm start
```
App: `http://localhost:3000`

---

## ⚙️ Configuración inicial en la UI

1. Abre `http://localhost:3000`.  
2. Ve a la pestaña **Configuración**.  
3. Rellena los campos de conexión a **Veeam API** y **Veeam ONE**.  
4. Configura los correos (opcional).  
5. Haz clic en **Guardar configuración**.  
6. Reinicia el backend para aplicar cambios.

---

## 🌐 Acceso en red

- Frontend: `http://<IP_DEL_SERVIDOR>:3000`  
- Backend: `http://<IP_DEL_SERVIDOR>:3001`

Asegúrate de permitir los puertos `3000` y `3001` (TCP) en el firewall para acceso LAN.

---

## 🧑‍💻 Autor

**[@jh4n3r](https://github.com/jh4n3r)**

Licencia: **MIT**
