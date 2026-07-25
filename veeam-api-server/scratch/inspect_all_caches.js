const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

const tables = ['cache_server_info', 'cache_repositories', 'cache_proxies', 'cache_managed_servers', 'cache_backup_objects'];

tables.forEach(table => {
  db.get(`SELECT data FROM ${table} WHERE id = 1`, (err, row) => {
    if (err) {
      console.error(`Error reading ${table}:`, err);
      return;
    }
    if (row && row.data) {
      const parsed = JSON.parse(row.data);
      console.log(`\n=== Table: ${table} ===`);
      if (Array.isArray(parsed)) {
        console.log(`Count: ${parsed.length}`);
        console.log("Sample:", JSON.stringify(parsed[0], null, 2));
      } else {
        console.log("Data (Object):", JSON.stringify(parsed, null, 2));
      }
    } else {
      console.log(`\n=== Table: ${table} === is empty`);
    }
  });
});

setTimeout(() => db.close(), 2000);
