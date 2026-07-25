const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(__dirname, 'veeam_history.db');
const stats = fs.statSync(dbPath);
console.log("DB Path:", dbPath);
console.log("DB Size:", stats.size);
console.log("DB Modified Time:", stats.mtime);
