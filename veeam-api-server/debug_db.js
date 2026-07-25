const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./veeam_history.db');

db.all("SELECT * FROM job_history ORDER BY id DESC LIMIT 20", (err, rows) => {
    if (err) {
        console.error(err);
        return;
    }
    console.log("--- LAST 20 ENTRIES IN JOB_HISTORY ---");
    console.log(JSON.stringify(rows, null, 2));
});
