require('dotenv').config();
const cacheService = require('./cacheService');
const db = require('./database');

async function test() {
  await db.initDb();
  console.log("Starting cache update...");
  const result = await cacheService.updateAllCaches();
  console.log("Cache update result:", result);
  
  const refreshTime = await db.getLastRefreshTime();
  console.log("Refreshed time in DB:", refreshTime);
  
  const history = await db.getJobHistory();
  console.log("Job runs in DB:", history.length);
}
test();
