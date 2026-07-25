// veeam-api-server/database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

// --- (parseDMYDate sin cambios) ---
const parseDMYDate = (dmyString) => {
  if (!dmyString) return null;
  const parts = dmyString.split(' ');
  const dateParts = parts[0].split('/');
  const timeParts = (parts[1] || '00:00:00').split(':');
  if (dateParts.length !== 3) {
    // Si ya parece una fecha ISO (contiene T o -), no avisar, solo devolver
    return dmyString;
  }
  const [day, month, year] = dateParts;
  const hour = (timeParts[0] || '00').padStart(2, '0');
  const minute = (timeParts[1] || '00').padStart(2, '0');
  const second = (timeParts[2] || '00').padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
};

// --- (initDb sin cambios) ---
const initDb = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS job_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_name TEXT NOT NULL,
        job_type TEXT,
        status TEXT,
        last_run_time TEXT NOT NULL,
        is_retry INTEGER DEFAULT 0,
        will_retry INTEGER DEFAULT 0,
        result_details TEXT,
        UNIQUE(job_name, last_run_time)
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        smtp_host TEXT,
        smtp_port INTEGER,
        smtp_user TEXT,
        smtp_pass TEXT,
        from_email TEXT,
        to_email TEXT,
        refresh_interval_minutes INTEGER DEFAULT 5,
        last_cache_refresh TEXT
      )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY DEFAULT 1,
        send_time TEXT,
        send_days TEXT
      )`);

      db.run(`CREATE TABLE IF NOT EXISTS cache_server_info (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_repositories (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_proxies (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_managed_servers (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_backup_objects (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_sessions (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);
      db.run(`CREATE TABLE IF NOT EXISTS cache_jobs (id INTEGER PRIMARY KEY DEFAULT 1, data TEXT)`);

      db.run("ALTER TABLE settings ADD COLUMN refresh_interval_minutes INTEGER DEFAULT 5", () => {});
      db.run("ALTER TABLE settings ADD COLUMN last_cache_refresh TEXT", () => {});

      // Nuevas columnas en la base de datos de historial de jobs
      db.run("ALTER TABLE job_history ADD COLUMN is_retry INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE job_history ADD COLUMN will_retry INTEGER DEFAULT 0", () => {});
      db.run("ALTER TABLE job_history ADD COLUMN result_details TEXT", () => {});

      db.run(`INSERT OR IGNORE INTO settings (id, smtp_host, smtp_port, smtp_user, smtp_pass, from_email, to_email, refresh_interval_minutes) 
              VALUES (1, '', 587, '', '', '', '', 5)`);
      db.run(`INSERT OR IGNORE INTO schedule (id, send_time, send_days) VALUES (1, '08:00', '')`);

      db.run("SELECT 1", (err) => {
        if (err) {
          console.error("Error inicializando DB:", err);
          return reject(err);
        }
        console.log("Base de datos SQLite 'veeam_history.db' inicializada y migrada.");
        resolve();
      });
    });
  });
};

const insertJobRun = (job) => {
  const { name, sessionType, result, creationTime, isRetry, willRetry } = job;
  if (!name || !creationTime) return; 

  const status = typeof result === 'object' && result !== null ? result.result : (result || 'Unknown');
  const details = typeof result === 'object' && result !== null ? result.resultDetails : '';
  const isRetryVal = isRetry ? 1 : 0;
  const willRetryVal = willRetry ? 1 : 0;

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO job_history 
    (job_name, job_type, status, last_run_time, is_retry, will_retry, result_details) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(name, sessionType, status, creationTime, isRetryVal, willRetryVal, details, (err) => {
    if (err) {
      // Fallback por compatibilidad
      const fallbackStmt = db.prepare("INSERT OR REPLACE INTO job_history (job_name, job_type, status, last_run_time) VALUES (?, ?, ?, ?)");
      fallbackStmt.run(name, sessionType, status, creationTime);
      fallbackStmt.finalize();
    }
  });
  stmt.finalize();
};

const cleanupOldJobs = (daysOld = 30) => {
  const dateStr = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
  db.run("DELETE FROM job_history WHERE last_run_time < ?", [dateStr], (err) => {
    if (err) console.error("Error al limpiar trabajos antiguos:", err);
  });
};

const getJobHistory = () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM job_history", (err, rows) => {
      if (err) return reject(err);
      const formattedRows = rows.map(row => ({
        name: row.job_name,
        sessionType: row.job_type,
        creationTime: parseDMYDate(row.last_run_time),
        endTime: parseDMYDate(row.last_run_time), 
        result: { 
          result: row.status, 
          resultDetails: row.result_details || row.status || 'Sin detalles' 
        },
        isRetry: row.is_retry === 1,
        willRetry: row.will_retry === 1,
        isFromOneDb: true
      }));
      resolve(formattedRows);
    });
  });
};

// --- (getSettings, saveSettings... SIN CAMBIOS) ---
const getSettings = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM settings WHERE id = 1", (err, row) => {
      if (err) return reject(err);
      resolve(row || { refresh_interval_minutes: 5 }); 
    });
  });
};
const saveSettings = (settings) => {
  const { smtp_host, smtp_port, smtp_user, smtp_pass, from_email, to_email, refresh_interval_minutes } = settings;
  return new Promise((resolve, reject) => {
    db.run(`UPDATE settings SET 
      smtp_host = ?, smtp_port = ?, smtp_user = ?, smtp_pass = ?, 
      from_email = ?, to_email = ?, refresh_interval_minutes = ?
      WHERE id = 1`,
      [smtp_host, smtp_port, smtp_user, smtp_pass, from_email, to_email, refresh_interval_minutes],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
};
const updateLastRefreshTime = () => {
  db.run(`UPDATE settings SET last_cache_refresh = ? WHERE id = 1`, [new Date().toISOString()]);
};

// --- NUEVO: Obtener solo la fecha del último refresco ---
const getLastRefreshTime = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT last_cache_refresh FROM settings WHERE id = 1", (err, row) => {
      if (err) return reject(err);
      resolve(row ? row.last_cache_refresh : null);
    });
  });
};
// --- FIN NUEVO ---

const getSchedule = () => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM schedule WHERE id = 1", (err, row) => {
      if (err) return reject(err);
      resolve(row || { send_time: '08:00', send_days: '' });
    });
  });
};
const saveSchedule = (schedule) => {
  const { send_time, send_days } = schedule;
  return new Promise((resolve, reject) => {
    db.run(`UPDATE schedule SET send_time = ?, send_days = ? WHERE id = 1`,
      [send_time, send_days], (err) => (err ? reject(err) : resolve())
    );
  });
};
const updateCache = (tableName, data) => {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data);
    db.run(`INSERT OR REPLACE INTO ${tableName} (id, data) VALUES (1, ?)`, [jsonData], (err) => {
      if (err) {
        console.error(`Error actualizando caché ${tableName}:`, err.message);
        return reject(err);
      }
      resolve();
    });
  });
};

// --- (getFromCache MODIFICADO) ---
const getFromCache = (tableName) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT data FROM ${tableName} WHERE id = 1`, (err, row) => {
      if (err) return reject(err);
      if (!row || !row.data) {
        // --- CORRECCIÓN ---
        // Si es server_info, devuelve objeto, si no, array
        const emptyValue = (tableName === 'cache_server_info') ? {} : [];
        return resolve(emptyValue);
        // --- FIN CORRECCIÓN ---
      }
      resolve(JSON.parse(row.data));
    });
  });
};

module.exports = { 
  initDb, 
  insertJobRun, 
  cleanupOldJobs,
  getJobHistory,
  getSettings,
  saveSettings,
  updateLastRefreshTime,
  getLastRefreshTime,
  getSchedule,
  saveSchedule,
  updateCache,
  getFromCache
};