const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

db.get("SELECT last_cache_refresh FROM settings WHERE id = 1", (err, row) => {
  console.log("Settings last_cache_refresh:", row);
});

db.get("SELECT COUNT(*) as count FROM job_history", (err, row) => {
  console.log("job_history count:", row);
});

db.get("SELECT data FROM cache_sessions WHERE id = 1", (err, row) => {
  if (row && row.data) {
    const sessions = JSON.parse(row.data);
    console.log("cache_sessions count:", sessions.length);
    if (sessions.length > 0) {
      console.log("Sample session name:", sessions[0].name);
    }
  } else {
    console.log("cache_sessions is empty or null");
  }
  db.close();
});
