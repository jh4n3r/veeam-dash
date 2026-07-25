# 🖥️ Veeam Dashboard (Frontend React UI)

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Author](https://img.shields.io/badge/Author-jh4n3r-green.svg)](https://github.com/jh4n3r)

Este directorio contiene la interfaz web de usuario (**Frontend**) de **Veeam Dashboard**, construida con **React.js** y diseñada para ofrecer un centro de control visual e interactivo para el monitoreo de infraestructura **Veeam Backup & Replication**.

---

## 🚀 Características Principales

- **📊 Dashboard en Tiempo Real**: Tarjetas KPI, resumen de estado de trabajos (Success, Warning, Failed, Running), velocidad de procesamiento y volúmenes transferidos.
- **📜 Visor de Logs Avanzado**: Filtrado multinivel de registros por gravedad, fecha o nombre de trabajo, con inspector detallado de errores WinRM/PowerShell.
- **🗺️ Diagramas de Arquitectura**: Representación gráfica e interactiva de la topología de backups (Servidor VBR $\rightarrow$ Proxies $\rightarrow$ Repositorios $\rightarrow$ Nube/Cintas).
- **⚙️ Centro de Configuración**: Gestión remota de parámetros WinRM, credenciales, servidor SMTP de alertas y ejecución de sincronizaciones manuales.
- **💾 Exportación de Reportes**: Descarga de reportes en formato CSV y vista apta para impresión.
- **🔄 Auto-Refresco Configurable**: Actualización automática de datos con intervalos seleccionables (30s, 1m, 5m).

---

## 📁 Estructura del Proyecto Frontend

```
veeam-dashboard/
├── public/
│   ├── favicon.ico
│   └── index.html             # HTML base del frontend
├── src/
│   ├── App.js                 # Enrutador principal y barra de navegación fija
│   ├── App.css                # Estilos globales y utilidades
│   ├── index.css              # Reset de CSS y estilos base
│   ├── DashboardPage.js       # Vista principal de estados y métricas KPI
│   ├── LogsPage.js            # Visor e inspector de logs
│   ├── DiagramsPage.js        # Diagramas de infraestructura y flujos
│   └── ConfigPage.js          # Formulario de configuración .env y tests
├── README.md                  # Documentación de la aplicación React
└── MANUAL_USO.md              # 📖 Manual de usuario completo con todas las funciones
```

---

## 🛠️ Comandos Disponibles

En este directorio puedes ejecutar los siguientes comandos de `npm`:

### `npm start`
Ejecuta la aplicación en modo de desarrollo.\
Abre [http://localhost:3000](http://localhost:3000) para verla en el navegador. La página se recargará automáticamente si realizas cambios en el código.

### `npm run build`
Compila la aplicación para producción en la carpeta `build`.\
Optimiza la construcción de React para obtener el mejor rendimiento y minifica los archivos JS/CSS.

---

## 📖 Manual de Usuario y Guía de Funcionalidades

Para consultar la guía paso a paso de uso de la interfaz, el detalle de cada vista, los filtros y la resolución de problemas, consulta el archivo:

👉 **[MANUAL_USO.md](./MANUAL_USO.md)**

---

## 🧑‍💻 Autor

- **Autor**: jh4n3r
- **Contacto**: [jh4n3r@outlook.com](mailto:jh4n3r@outlook.com)
- **Repositorio**: [https://github.com/jh4n3r/veeam-dash](https://github.com/jh4n3r/veeam-dash)
