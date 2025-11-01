// veeam-api-server/index.js
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
require('dotenv').config();

// --- NUEVO: Módulos para escribir .env ---
const fs = require('fs').promises;
const path = require('path');
// --- FIN NUEVO ---

const db = require('./database');
const reportService = require('./reportService');
const cacheService = require('./cacheService');

const app = express();
app.use(cors());
app.use(express.json());

// --- ENDPOINT /api/summary (Sin cambios) ---
app.get('/api/summary', async (req, res) => {
  console.log("Solicitando resumen... (Desde Caché DB)");
  try {
    const [
      serverInfo, vbrHistory, managedServers, backupObjects,
      reposWithUsage, proxies, oneHistory, lastRefresh
    ] = await Promise.all([
      db.getFromCache('cache_server_info'),
      db.getFromCache('cache_sessions'),
      db.getFromCache('cache_managed_servers'),
      db.getFromCache('cache_backup_objects'),
      db.getFromCache('cache_repositories'),
      db.getFromCache('cache_proxies'),
      db.getJobHistory(),
      db.getLastRefreshTime() // <-- Obtener última actualización
    ]);

    const combinedHistory = [...vbrHistory, ...oneHistory];
    console.log(`HISTORIAL (Caché): ${vbrHistory.length} de VBR, ${oneHistory.length} de VeeamONE. Total: ${combinedHistory.length}`);
    
    res.json({
      serverInfo: serverInfo || {},
      sessions: combinedHistory,
      repositories: reposWithUsage,
      proxies: proxies,
      managedServers: managedServers,
      backupObjects: backupObjects,
      lastCacheRefresh: lastRefresh // <-- Enviar al frontend
    });

  } catch (error) {
    console.error("Error en /api/summary (Caché):", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- LÓGICA DE REPORTE (Sin cambios) ---
const generateAndSendReport = async () => {
  const settings = await db.getSettings();
  if (!settings || !settings.smtp_host || !settings.to_email) {
    throw new Error("SMTP no está configurado. Guarde la configuración en la pestaña 'Configuración'.");
  }
  if (!process.env.NODE_ENV === 'production') {
    try {
      await fetch('http://localhost:3000');
    } catch (e) {
      throw new Error('El frontend de React no está corriendo.');
    }
  }

  console.log('Paso 1: Generando PDF...');
  const pdfBuffer = await reportService.generatePdfReport();
  console.log('Paso 1: PDF generado.');

  console.log('Paso 2: Enviando email...');
  await reportService.sendEmailWithAttachment(pdfBuffer, settings);
  console.log('Paso 2: Email enviado.');
};


// --- ENDPOINT PARA ENVIAR REPORTE MANUAL (Sin cambios) ---
app.post('/api/send-report', async (req, res) => {
  console.log('Solicitud recibida para generar y enviar reporte MANUAL...');
  try {
    await generateAndSendReport();
    res.json({ success: true, message: 'Reporte enviado exitosamente.' });
  } catch (error) {
    console.error("Error al procesar el reporte manual:", error.message);
    res.status(500).json({ error: error.message || 'Error desconocido.' });
  }
});

// --- ENDPOINT PARA PROBAR SMTP (Sin cambios) ---
app.post('/api/test-smtp', async (req, res) => {
  console.log("Solicitud recibida para probar SMTP...");
  try {
    const settings = req.body.settings;
    const result = await reportService.testSmtpConnection(settings);
    res.json(result);
  } catch (error) {
    console.error("Error en prueba SMTP:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// --- ENDPOINT PARA ACTUALIZAR CACHÉ (MODIFICADO) ---
app.post('/api/refresh-cache', async (req, res) => {
  console.log("Solicitud recibida para actualizar caché MANUALMENTE...");
  try {
    // --- MODIFICACIÓN: Esperar el resultado ---
    const result = await cacheService.updateAllCaches();
    
    if (!result.success) {
      // Si el caché falló (ej: sin conexión), notificar al frontend
      throw new Error(result.message);
    }
    
    res.json({ success: true, message: result.message });
    // --- FIN MODIFICACIÓN ---
  } catch (error) {
    console.error("Error al iniciar refresco manual:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// --- ENDPOINTS DE CONFIGURACIÓN (SMTP/Schedule) ---
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    const schedule = await db.getSchedule();
    res.json({ settings, schedule });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { settings, schedule } = req.body;
    await db.saveSettings(settings);
    await db.saveSchedule(schedule);
    res.json({ success: true, message: "Configuración guardada." });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- NUEVO: ENDPOINTS DE CONFIGURACIÓN DE VEEAM API (.env) ---

// GET: Envía la configuración actual cargada en process.env al frontend
app.get('/api/veeam-settings', (req, res) => {
  try {
    const settings = {
      VEEAM_USER: process.env.VEEAM_USER || "",
      VEEAM_PASS: process.env.VEEAM_PASS || "",
      VEEAM_SERVER: process.env.VEEAM_SERVER || "",
      VEEAM_PORT: process.env.VEEAM_PORT || "9419",
      VEEAM_API_VERSION: process.env.VEEAM_API_VERSION || "1.2-rev1",
      VEEAM_ONE_SERVER: process.env.VEEAM_ONE_SERVER || "",
      VEEAM_ONE_PORT: process.env.VEEAM_ONE_PORT || "1239",
      VEEAM_ONE_USER: process.env.VEEAM_ONE_USER || "",
      VEEAM_ONE_PASS: process.env.VEEAM_ONE_PASS || "",
    };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Escribe la configuración en el archivo .env
app.post('/api/veeam-settings', async (req, res) => {
  console.log("Guardando configuración de Veeam en .env...");
  const { settings } = req.body;
  
  // Leer la configuración de email actual para no sobrescribirla
  const emailSettings = await db.getSettings();
  
  // Construir el nuevo contenido del .env
  const envContent = `
# --- API de VBR (Puerto 9419) ---
VEEAM_USER="${settings.VEEAM_USER || ''}"
VEEAM_PASS="${settings.VEEAM_PASS || ''}"
VEEAM_SERVER="${settings.VEEAM_SERVER || ''}"
VEEAM_PORT="${settings.VEEAM_PORT || '9419'}"
VEEAM_API_VERSION="${settings.VEEAM_API_VERSION || '1.2-rev1'}"

# --- API de Veeam ONE (Puerto 1239) ---
VEEAM_ONE_SERVER="${settings.VEEAM_ONE_SERVER || ''}"
VEEAM_ONE_PORT="${settings.VEEAM_ONE_PORT || '1239'}"
VEEAM_ONE_USER="${settings.VEEAM_ONE_USER || ''}"
VEEAM_ONE_PASS="${settings.VEEAM_ONE_PASS || ''}"

# --- Configuración de Email (O365) ---
# (Estos se leen del .env original, pero la app usa la DB para SMTP)
EMAIL_USER="${process.env.EMAIL_USER || emailSettings.smtp_user || ''}"
EMAIL_PASS="${process.env.EMAIL_PASS || emailSettings.smtp_pass || ''}"
EMAIL_TO="${process.env.EMAIL_TO || emailSettings.to_email || ''}"
`;

  try {
    const envPath = path.join(__dirname, '.env');
    await fs.writeFile(envPath, envContent.trim());
    console.log("Archivo .env actualizado.");
    res.json({ 
      success: true, 
      message: "¡Guardado! Debes reiniciar el servidor (backend) para aplicar los cambios." 
    });
  } catch (error) {
    console.error("Error al escribir .env:", error);
    res.status(500).json({ error: "No se pudo escribir en el archivo .env. Verifica los permisos." });
  }
});

// --- FIN NUEVO ---


// --- SCHEDULER: Reporte Automático por Email (Sin cambios) ---
let isEmailTaskRunning = false;
cron.schedule('* * * * *', async () => {
  console.log(`[EmailScheduler] Verificando... ${new Date().toLocaleString()}`);
  if (isEmailTaskRunning) return;

  const schedule = await db.getSchedule();
  if (!schedule || !schedule.send_time || !schedule.send_days) return;
  
  const now = new Date();
  const dayOfWeek = now.getDay().toString();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const scheduledDays = schedule.send_days.split(',');
  
  if (scheduledDays.includes(dayOfWeek) && schedule.send_time === currentTime) {
    console.log(`[EmailScheduler] ¡Hora de enviar! (${currentTime}) Disparando reporte...`);
    isEmailTaskRunning = true;
    try {
      await generateAndSendReport();
    } catch (error) {
      console.error('[EmailScheduler] Error al enviar reporte automático:', error.message);
    } finally {
      isEmailTaskRunning = false;
    }
  }
});

// --- SCHEDULER: Actualización Automática de Caché (Sin cambios) ---
cron.schedule('* * * * *', async () => {
  console.log(`[CacheScheduler] Verificando... ${new Date().toLocaleString()}`);
  const settings = await db.getSettings();
  const interval = settings.refresh_interval_minutes || 5;
  const lastRefresh = new Date(settings.last_cache_refresh || 0);
  const now = new Date();

  const minutesSinceLastRefresh = (now - lastRefresh) / 60000;

  if (minutesSinceLastRefresh >= interval) {
    console.log(`[CacheScheduler] Intervalo (${interval} min) cumplido. Actualizando caché...`);
    await cacheService.updateAllCaches();
  }
});

// --- Iniciar servidor (MODIFICADO) ---
const startServer = async () => {
  try {
    // 1. ESPERAR a que la DB esté lista
    await db.initDb();

    // 2. Iniciar el listener
    const PORT = 3001;
    // --- MODIFICACIÓN: Escuchar en 0.0.0.0 para acceso en red ---
    const HOST = '0.0.0.0';
    
    app.listen(PORT, HOST, () => {
      console.log(`Backend escuchando en: http://${HOST}:${PORT}`);
      // 3. Iniciar el primer caché DESPUÉS de que la DB esté lista
      console.log("Iniciando primera actualización de caché al arrancar...");
      cacheService.updateAllCaches();
    });
  } catch (error) {
    console.error("Error fatal al iniciar el servidor:", error.message);
    process.exit(1);
  }
};

// --- Ejecutar el inicio ---
startServer();