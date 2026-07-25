// veeam-api-server/cacheService.js
const winrmService = require('./winrmService');
const db = require('./database');

let isCacheUpdateRunning = false;

/**
 * Llama a Veeam usando WinRM y guarda los resultados en el caché de la DB.
 */
const updateAllCaches = async () => {
  if (isCacheUpdateRunning) {
    console.log('[CacheService] La actualización de caché ya está en progreso. Omitiendo.');
    return { success: false, message: 'Actualización ya en progreso.' };
  }

  console.log('[CacheService] Iniciando recolección de métricas vía WinRM...');
  isCacheUpdateRunning = true; 

  try {
    const data = await winrmService.executeWinRM();
    console.log('[CacheService] Datos recolectados exitosamente vía WinRM.');

    // Extraer datos
    const proxies = data.proxies || [];
    const repositories = data.repositories || [];
    const sessions = data.sessions || [];
    const managedServers = data.managedServers || [];
    const backupObjects = data.backupObjects || []; // <--- CORREGIDO
    const jobs = data.jobs || [];
    const serverInfo = data.serverInfo || {};

    // Guardar en la base de datos
    const cachePromises = [];
    cachePromises.push(db.updateCache('cache_server_info', serverInfo));
    cachePromises.push(db.updateCache('cache_managed_servers', managedServers));
    cachePromises.push(db.updateCache('cache_backup_objects', backupObjects)); // <--- CORREGIDO
    cachePromises.push(db.updateCache('cache_sessions', sessions));
    cachePromises.push(db.updateCache('cache_repositories', repositories));
    cachePromises.push(db.updateCache('cache_proxies', proxies));
    cachePromises.push(db.updateCache('cache_jobs', jobs));

    await Promise.all(cachePromises);

    // Guardar historial de jobs (sessions) para el PDF
    sessions.forEach(db.insertJobRun);
    
    // Limpiar jobs muy antiguos (optimizacion)
    db.cleanupOldJobs(30); // Limpia jobs más viejos que 30 días

    // Actualizar la marca de tiempo
    db.updateLastRefreshTime();

    const message = 'Actualización completada vía WinRM.';
    console.log(`[CacheService] ${message}`);
    return { success: true, message: message };

  } catch (error) {
    console.error('[CacheService] Error fatal durante la actualización del caché:', error.message);
    return { success: false, message: 'Fallo al recolectar datos vía WinRM: ' + error.message };
  } finally {
    isCacheUpdateRunning = false;
  }
};

module.exports = { updateAllCaches };