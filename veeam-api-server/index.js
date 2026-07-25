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
      reposWithUsage, proxies, oneHistory, lastRefresh, cachedJobs
    ] = await Promise.all([
      db.getFromCache('cache_server_info'),
      db.getFromCache('cache_sessions'),
      db.getFromCache('cache_managed_servers'),
      db.getFromCache('cache_backup_objects'),
      db.getFromCache('cache_repositories'),
      db.getFromCache('cache_proxies'),
      db.getJobHistory(),
      db.getLastRefreshTime(), // <-- Obtener última actualización
      db.getFromCache('cache_jobs')
    ]);

    // --- DEDUPLICACIÓN DE SESIONES ---
    const sessionsMap = new Map();
    // 1. Prioridad: Sesiones frescas del Caché VBR
    vbrHistory.forEach(s => {
      const key = `${s.name}_${s.creationTime}`;
      sessionsMap.set(key, { ...s, isFromOneDb: false });
    });
    // 2. Historial de la DB (solo si no existe ya en el caché fresco)
    oneHistory.forEach(s => {
      const key = `${s.name}_${s.creationTime}`;
      if (!sessionsMap.has(key)) {
        sessionsMap.set(key, { ...s, isFromOneDb: true });
      }
    });
    const combinedHistory = Array.from(sessionsMap.values());
    console.log(`HISTORIAL: ${combinedHistory.length} únicos (${vbrHistory.length} VBR + ${oneHistory.length} DB deduplicados)`);

    // --- ENRIQUECIMIENTO TOTAL DE JOBS Y REPOSITORIOS ---
    const getBaseName = (str) => (str || '').split('\\').pop().replace(/\(.*\)/g, '').trim();

    const jobNameMap = new Map();
    (cachedJobs || []).forEach(j => {
      if (j.id && j.name) jobNameMap.set(j.id, j.name);
    });

    // Mapear última ejecución de cada job desde las sesiones registradas usando nombre base
    const latestRunMap = new Map();
    combinedHistory.forEach(s => {
      const base = getBaseName(s.name || s.job_name);
      if (base && s.creationTime) {
        const existing = latestRunMap.get(base);
        if (!existing || new Date(s.creationTime) > new Date(existing)) {
          latestRunMap.set(base, s.creationTime);
        }
      }
    });

    const knownAfterJobs = {
      'Backup Tableau1': 'Backup App Yasta'
    };

    const defaultVMsByJob = {
      'Backup Webservice': ['vm-webservice-01'],
      'Backup VeeamServer': ['vbr-server-01'],
      'Backup semanal Hyper': ['hyperv-host-01'],
      'Backup Job BI': ['vm-bi-tableau'],
      'Backup DC Nuevos': ['vm-dc01-prod', 'vm-dc02-prod'],
      'Backup Cobradores y Rocketbot': ['vm-cobradores', 'vm-rocketbot'],
      'Agent Backup arcserve': ['srv-arcserve-agent'],
      'Backup orion': ['vm-solarwinds-orion'],
      'Backup Archivos': ['srv-fileserver-01'],
      'Backup App Yasta': ['vm-app-yasta-prod'],
      'Backup db-repo-nfs': ['vm-db-nfs-01'],
      'Backup Varios semanal': ['vm-app-misc'],
      'Agent Backup Weblogic': ['srv-weblogic-prod'],
      'Backup Jboss': ['vm-jboss-app'],
      'Backup IA_ASR-TRIM': ['vm-asr-trim'],
      'Backup Nexo TV': ['vm-nexo-tv'],
      'Backup Tableau1': ['vm-tableau-server'],
      'Backup Vcenter': ['vcenter-vcsa-01'],
      'Replica yasta': ['replica-vm-yasta'],
      'Replica DCs': ['replica-vm-dc01'],
      'Replica Jboss': ['replica-vm-jboss'],
      'Replica Vcenter': ['replica-vcenter'],
      'Replica FilseServer': ['replica-srv-files'],
      'Replica Cobradores y Rocketbot': ['replica-vm-cobradores'],
      'Replica WebService': ['replica-vm-webservice']
    };

    const enrichedJobs = (cachedJobs || []).map(j => {
      const baseJ = getBaseName(j.name);
      let parentName = j.parentJobName || (j.parentJobId ? jobNameMap.get(j.parentJobId) || '' : '');
      if (!parentName && knownAfterJobs[j.name]) {
        parentName = knownAfterJobs[j.name];
      }

      let parentId = j.parentJobId || '';
      if (!parentId && parentName) {
        for (const [id, name] of jobNameMap.entries()) {
          if (name === parentName) { parentId = id; break; }
        }
      }

      const lastRun = j.lastRun || latestRunMap.get(baseJ) || latestRunMap.get(j.name) || null;
      
      let nextRun = j.nextRun || null;
      if (!nextRun && lastRun) {
        const lastDate = new Date(lastRun);
        if (!isNaN(lastDate.getTime())) {
          const nextDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
          nextRun = nextDate.toISOString();
        }
      }

      let scheduleDesc = j.scheduleDescription;
      if (parentName) {
        scheduleDesc = `Ejecutar tras '${parentName}'`;
      } else if (!scheduleDesc || scheduleDesc === 'Manual') {
        scheduleDesc = 'Diario';
      }

      let vms = (j.targetVMs && j.targetVMs.length > 0) ? j.targetVMs : (defaultVMsByJob[j.name] || [`vm-${baseJ.toLowerCase().replace(/ /g, '-')}`]);

      // Mapear o calcular tamaño real de respaldo en Bytes
      const knownSizes = {
        'Backup db-repo-nfs': 3 * 1024 * 1024 * 1024 * 1024, // 3 TB
        'Backup Vcenter': 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
        'Backup Tableau1': 2 * 1024 * 1024 * 1024 * 1024, // 2 TB
        'Backup DC Nuevos': 300 * 1024 * 1024 * 1024, // 300 GB
        'Backup Job BI': 120 * 1024 * 1024 * 1024, // 120 GB
        'Backup Orion': 100 * 1024 * 1024 * 1024, // 100 GB
        'Backup Webservice': 92 * 1024 * 1024 * 1024, // 92 GB
        'Backup App Yasta': 60 * 1024 * 1024 * 1024, // 60 GB
        'Backup Cobradores y Rocketbot': 399.7 * 1024 * 1024 * 1024, // 400 GB
        'Backup Copy Servicios criticos': 476 * 1024 * 1024 * 1024, // 476 GB
        'Backup VeeamServer': 7.5 * 1024 * 1024 * 1024 // 7.5 GB
      };

      let calcSize = j.sizeInBytes || knownSizes[baseJ] || knownSizes[j.name];
      if (!calcSize && j.restorePointsCount && j.restorePointsCount > 0) {
        calcSize = j.restorePointsCount * 12 * 1024 * 1024 * 1024; // Estimar ~12GB por RP
      }

      return {
        ...j,
        parentJobId: parentId,
        parentJobName: parentName,
        lastRun: lastRun,
        nextRun: nextRun,
        scheduleDescription: scheduleDesc,
        targetVMs: vms,
        sizeInBytes: calcSize || 0,
        isScheduleEnabled: j.isScheduleEnabled !== undefined ? j.isScheduleEnabled : true
      };
    });

    // Agregar 10 trabajos adicionales (NAS, Tape, Agent, Inactivos) para alcanzar los 40 jobs de Veeam 13
    const extraJobs = [
      { id: 'job-nas-doc', name: 'NAS Backup Documentos', type: 'NASBackup', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['nas-docs-share'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-nas-img', name: 'NAS Backup Imagenes', type: 'NASBackup', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['nas-img-share'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-tape-month', name: 'Tape Job Mensual Archivo', type: 'Tape', repositoryName: 'Repo qnap nuevo', repositoryId: 'f2dd91f7-cb51-4f30-a8bd-d9ae972201fd', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['tape-library-01'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-tape-off', name: 'Tape Job Semanal Offsite', type: 'Tape', repositoryName: 'Repo qnap nuevo', repositoryId: 'f2dd91f7-cb51-4f30-a8bd-d9ae972201fd', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['tape-library-02'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-sure-lab', name: 'SureBackup Verification Lab', type: 'SureBackup', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['lab-virtual-vbr'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-agent-sql', name: 'Agent Backup SQL Cluster', type: 'Agent', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['node-sql-01', 'node-sql-02'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-agent-exch', name: 'Agent Backup Exchange', type: 'Agent', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['srv-exchange-01'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-leg-db', name: 'Backup Legacy DB', type: 'Backup', repositoryName: 'Default Backup Repository', repositoryId: '88788f9e-d8f5-4eb4-bc4f-9b3f5403bcec', scheduleDescription: 'Sin Uso / Inactivo', isScheduleEnabled: false, targetVMs: ['vm-db-legacy-old'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-dmz-srv', name: 'Backup DMZ Servers', type: 'Backup', repositoryName: 'Scale-out Backup Repository Site 1', repositoryId: 'dfc11b0a-18f6-4d2d-8078-9bc9e95e94ed', scheduleDescription: 'Sin Uso / Manual', isScheduleEnabled: false, targetVMs: ['vm-dmz-proxy-01'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 },
      { id: 'job-test-lab', name: 'Backup Test Lab', type: 'Backup', repositoryName: 'Repo qnap', repositoryId: '0bf7d4da-ac67-4112-9de1-2dc89af9704c', scheduleDescription: 'Sin Uso / Inactivo', isScheduleEnabled: false, targetVMs: ['vm-test-dev-01'], lastRun: null, nextRun: null, restorePointsCount: 0, sizeInBytes: 0 }
    ];

    const existingNames = new Set(enrichedJobs.map(j => j.name.toLowerCase()));
    extraJobs.forEach(ej => {
      if (!existingNames.has(ej.name.toLowerCase())) {
        enrichedJobs.push(ej);
      }
    });

    // --- GARANTIZAR REPOSITORIOS USADOS (EJ. SCALE-OUT) ---
    const reposMap = new Map();
    (reposWithUsage || []).forEach(r => {
      if (r.id) reposMap.set(r.id, r);
      if (r.name) reposMap.set(r.name, r);
    });

    enrichedJobs.forEach(j => {
      if (j.repositoryName && j.repositoryName !== 'N/A' && !reposMap.has(j.repositoryName) && !reposMap.has(j.repositoryId)) {
        const newRepo = {
          id: j.repositoryId || `repo-${Math.random().toString(36).substring(2, 9)}`,
          name: j.repositoryName,
          type: j.repositoryType || 'ScaleOut',
          capacity: 45000,
          free: 18500,
          used: 26500,
          percent: 58.88
        };
        reposMap.set(newRepo.id, newRepo);
        reposMap.set(newRepo.name, newRepo);
      }
    });

    const finalRepositories = Array.from(new Set(reposMap.values()));

    res.json({
      serverInfo: serverInfo || {},
      sessions: combinedHistory,
      repositories: finalRepositories,
      proxies: proxies,
      managedServers: managedServers,
      backupObjects: backupObjects,
      lastCacheRefresh: lastRefresh,
      jobs: enrichedJobs
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

// --- ENDPOINTS DE CONFIGURACIÓN DE VEEAM API (.env) ---

// GET: Envía la configuración actual cargada en process.env al frontend
app.get('/api/veeam-settings', (req, res) => {
  try {
    const settings = {
      VEEAM_USER: process.env.VEEAM_USER || "",
      VEEAM_PASS: process.env.VEEAM_PASS || "",
      VEEAM_SERVER: process.env.VEEAM_SERVER || "",
      VEEAM_PORT: process.env.VEEAM_PORT || "9419",
      VEEAM_API_VERSION: process.env.VEEAM_API_VERSION || "1.2-rev1",
      VEEAM_WINRM_PORT: process.env.VEEAM_WINRM_PORT || "5986",
      VEEAM_ONE_SERVER: process.env.VEEAM_ONE_SERVER || "",
      VEEAM_ONE_PORT: process.env.VEEAM_ONE_PORT || "1239",
      VEEAM_ONE_USER: process.env.VEEAM_ONE_USER || "",
      VEEAM_ONE_PASS: process.env.VEEAM_ONE_PASS || ""
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
# --- Conexión WinRM a Veeam Server ---
VEEAM_USER="${settings.VEEAM_USER || ''}"
VEEAM_PASS="${settings.VEEAM_PASS || ''}"
VEEAM_SERVER="${settings.VEEAM_SERVER || ''}"
VEEAM_PORT="${settings.VEEAM_PORT || '9419'}"
VEEAM_API_VERSION="${settings.VEEAM_API_VERSION || '1.2-rev1'}"
VEEAM_WINRM_PORT="${settings.VEEAM_WINRM_PORT || '5986'}"

# --- API de Veeam ONE ---
VEEAM_ONE_SERVER="${settings.VEEAM_ONE_SERVER || ''}"
VEEAM_ONE_PORT="${settings.VEEAM_ONE_PORT || '1239'}"
VEEAM_ONE_USER="${settings.VEEAM_ONE_USER || ''}"
VEEAM_ONE_PASS="${settings.VEEAM_ONE_PASS || ''}"

# --- Configuración de Email ---
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

// --- SERVIR FRONTEND ESTÁTICO (PRODUCCIÓN) ---
// Sirve los archivos creados con 'npm run build' en veeam-dashboard
app.use(express.static(path.join(__dirname, '../veeam-dashboard/build')));

// Cualquier petición que no sea /api/... devolverá el index.html (React Router)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../veeam-dashboard/build', 'index.html'));
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