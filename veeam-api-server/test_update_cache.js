require('dotenv').config();
const cacheService = require('./cacheService');
const db = require('./database');

async function test() {
  await db.initDb();
  console.log("Starting cache update test...");
  const result = await cacheService.updateAllCaches();
  console.log("Result:", result);
}
test();
