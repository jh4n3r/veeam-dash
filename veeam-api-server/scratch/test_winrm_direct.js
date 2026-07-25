require('dotenv').config();
const winrmService = require('../winrmService');

console.log("Calling executeWinRM...");
winrmService.executeWinRM()
  .then(data => {
    console.log("Success! Data keys:", Object.keys(data));
    console.log("Sample jobs count:", data.jobs ? data.jobs.length : 0);
  })
  .catch(err => {
    console.error("Caught error in promise:", err);
  });
