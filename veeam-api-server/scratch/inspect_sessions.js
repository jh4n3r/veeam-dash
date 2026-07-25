const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

db.get("SELECT data FROM cache_sessions WHERE id = 1", (err, row) => {
  if (row && row.data) {
    const sessions = JSON.parse(row.data);
    console.log("Total sessions in cache:", sessions.length);
    console.log("Sample session 1:", JSON.stringify(sessions[0], null, 2));
    console.log("Sample session 2:", JSON.stringify(sessions[1], null, 2));
  } else {
    console.log("No cache_sessions data");
  }
  db.close();
});
