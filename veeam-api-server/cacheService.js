// veeam-api-server/cacheService.js
const veeamService = require('./veeamService');
const db = require('./database');

let isCacheUpdateRunning = false;

// --- NUEVO: Helper para Promise.allSettled ---
/**
 * Revisa un resultado de Promise.allSettled.
 * Si falló, loguea el error y devuelve un valor por defecto.
 * Si tuvo éxito, devuelve el valor.
 */
const getSettledValue = (result, apiName, defaultValue = { data: [] }) => {
  if (result.status === 'rejected') {
    console.error(`[CacheService] Fallo en API ${apiName}: ${result.reason.message}`);
    return defaultValue; // Devuelve un objeto vacío o array para no romper el resto
  }
  return result.value;
};
// --- FIN NUEVO ---


/**
 * Llama a todas las APIs de Veeam y guarda los resultados en el caché de la DB.
 */
const updateAllCaches = async () => {
  if (isCacheUpdateRunning) {
    console.log('[CacheService] La actualización de caché ya está en progreso. Omitiendo.');
    return { success: false, message: 'Actualización ya en progreso.' };
  }
  
  console.log('[CacheService] Iniciando actualización de caché de Veeam...');
  isCacheUpdateRunning = true; // <-- Poner el bloqueo

  let oneApiFailed = false;
  let vbrApiFailed = false;

  try {
    // --- 1. Obtener datos de Veeam ONE (Infraestructura y Jobs de ONE) ---
    // --- MODIFICADO: Usar Promise.allSettled ---
    const oneApiResults = await Promise.allSettled([
      veeamService.getRepositories(),
      veeamService.getProxies(),
      veeamService.getBackupToTapeJobs(),
      veeamService.getBackupCopyJobs(),
      veeamService.getAgentBackupJobs()
    ]);

    const reposResponse = getSettledValue(oneApiResults[0], 'ONE:Repositories');
    const proxiesResponse = getSettledValue(oneApiResults[1], 'ONE:Proxies');
    const tapeJobsResponse = getSettledValue(oneApiResults[2], 'ONE:TapeJobs');
    const copyJobsResponse = getSettledValue(oneApiResults[3], 'ONE:CopyJobs');
    const agentJobsResponse = getSettledValue(oneApiResults[4], 'ONE:AgentJobs');
    
    // Si todos los resultados de ONE fallaron, marcarlo
    if (oneApiResults.every(r => r.status === 'rejected')) {
      oneApiFailed = true;
      console.warn('[CacheService] Todas las llamadas a Veeam ONE fallaron. Omitiendo actualización de ONE.');
    }
    // --- FIN MODIFICACIÓN ---

    // --- 2. Procesar y guardar Infraestructura (Solo si ONE no falló) ---
    let proxies = [];
    let reposWithUsage = [];
    if (!oneApiFailed) {
      proxies = (proxiesResponse.data || []).map(p => ({
        id: p.proxyUidInVbr, name: p.name, type: p.type,
        description: p.description || '—',
        transportMode: p.transportMode || 'N/A',
        maxTaskCount: p.maxConcurrentTasks || 0
      }));
      
      reposWithUsage = (reposResponse.data || []).map(repo => {
        const capacity = (repo.capacityBytes || 0) / (1024**3);
        const free = (repo.freeSpaceBytes || 0) / (1024**3);
        const used = capacity > 0 ? capacity - free : 0;
        const percent = capacity > 0 ? (used / capacity) * 100 : 0;
        return { 
          id: repo.repositoryUidInVbr, name: repo.name, ...repo, 
          used: used, capacity: capacity, percent: percent 
        };
      });
    }

    // --- 3. Normalizar y guardar Jobs de Veeam ONE (Solo si ONE no falló) ---
    if (!oneApiFailed) {
      const tapeJobs = (tapeJobsResponse.data || []).map(j => ({
        name: j.name, sessionType: j.type || 'BackupToTape', 
        creationTime: j.lastRun, result: { result: j.status || 'Unknown' }
      }));
      const copyJobs = (copyJobsResponse.data || []).map(j => ({
        name: j.name, sessionType: j.type || 'BackupCopy',
        creationTime: j.lastRun, result: { result: j.status || 'Unknown' }
      }));
      const agentJobs = (agentJobsResponse.data || []).map(j => ({
        name: j.name, sessionType: j.platform || 'Agent',
        creationTime: j.lastRun, result: { result: j.status || 'Unknown' }
      }));

      const normalizedJobs = [...tapeJobs, ...copyJobs, ...agentJobs];
      normalizedJobs.forEach(db.insertJobRun);
      console.log(`[CacheService] Guardados/Ignorados ${normalizedJobs.length} jobs de Veeam ONE en SQLite.`);
    }

    // --- 4. Obtener datos de VBR (los que tardan más) ---
    // --- MODIFICADO: Usar Promise.allSettled ---
    const vbrApiResults = await Promise.allSettled([
      veeamService.getServerInfo(),
      veeamService.getSessions(), // <-- Aquí vienen los 1978 jobs
      veeamService.getManagedServers(),
      veeamService.getBackupObjects()
    ]);
    
    const serverInfo = getSettledValue(vbrApiResults[0], 'VBR:ServerInfo', {});
    const sessionsResponse = getSettledValue(vbrApiResults[1], 'VBR:Sessions');
    const managedServers = getSettledValue(vbrApiResults[2], 'VBR:ManagedServers');
    const backupObjects = getSettledValue(vbrApiResults[3], 'VBR:BackupObjects');

    if (vbrApiResults.every(r => r.status === 'rejected')) {
      vbrApiFailed = true;
      console.warn('[CacheService] Todas las llamadas a VBR fallaron. Omitiendo actualización de VBR.');
    }
    // --- FIN MODIFICACIÓN ---

    // --- 5. Procesar Puntos de restauración (Solo si VBR no falló) ---
    let backupObjectsWithPoints = [];
    if (!vbrApiFailed) {
      backupObjectsWithPoints = (backupObjects.data || []).map(obj => ({
        id: obj.id,
        name: obj.name,
        restorePointsCount: obj.restorePointsCount || 0
      }));
    }

    // --- 6. Guardar todo en las tablas de caché ---
    // (Guardará datos vacíos si la API falló, pero no se romperá)
    const cachePromises = [];
    
    // Solo actualizar caché de VBR si no falló
    if (!vbrApiFailed) {
      cachePromises.push(db.updateCache('cache_server_info', serverInfo || {}));
      cachePromises.push(db.updateCache('cache_managed_servers', managedServers.data || []));
      cachePromises.push(db.updateCache('cache_backup_objects', backupObjectsWithPoints));
      cachePromises.push(db.updateCache('cache_sessions', sessionsResponse.data || []));
    }
    
    // Solo actualizar caché de ONE si no falló
    if (!oneApiFailed) {
      cachePromises.push(db.updateCache('cache_repositories', reposWithUsage));
      cachePromises.push(db.updateCache('cache_proxies', proxies));
    }

    // Si ambas fallaron, no hay nada que guardar, pero debemos liberar el bloqueo
    if (vbrApiFailed && oneApiFailed) {
      console.error('[CacheService] Error fatal: Ambas APIs (VBR y ONE) son inaccesibles.');
      throw new Error('Error: No se pudo conectar ni a VBR ni a Veeam ONE.');
    }

    await Promise.all(cachePromises);
    
    // 7. Actualizar la marca de tiempo
    db.updateLastRefreshTime();
    
    let message = 'Actualización completada.';
    if (oneApiFailed) message = 'Caché actualizado (Solo VBR). Veeam ONE inaccesible.';
    if (vbrApiFailed) message = 'Caché actualizado (Solo ONE). VBR inaccesible.';

    console.log(`[CacheService] ${message}`);
    return { success: true, message: message };

  } catch (error) {
    console.error('[CacheService] Error fatal durante la actualización del caché:', error.message);
    // Retornar el mensaje de error específico (ej: "Ambas APIs... inaccesibles")
    return { success: false, message: error.message };
  } finally {
    isCacheUpdateRunning = false; // <-- Liberar el bloqueo
  }
};

module.exports = { updateAllCaches };