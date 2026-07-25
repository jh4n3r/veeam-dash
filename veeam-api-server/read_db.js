const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

const tables = ['cache_server_info', 'cache_repositories', 'cache_proxies', 'cache_managed_servers', 'cache_backup_objects', 'cache_sessions', 'settings'];

function printTable(table) {
  return new Promise((resolve) => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, row) => {
      if (err) {
        console.log(`Table ${table} error:`, err.message);
        resolve();
      } else {
        console.log(`Table ${table} row count:`, row.count);
        if (row.count > 0) {
          db.all(`SELECT * FROM ${table} LIMIT 1`, (err, rows) => {
            console.log(`Sample from ${table}:`, JSON.stringify(rows).substring(0, 300));
            resolve();
          });
        } else {
          resolve();
        }
      }
    });
  });
}

async function run() {
  for (const table of tables) {
    await printTable(table);
  }
  db.close();
}

run();
