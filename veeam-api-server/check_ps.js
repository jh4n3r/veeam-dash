const fs = require('fs');
const winrmService = require('./winrmService');

// Let's modify winrmService.js temporarily to expose psScript or just print the script by running a node command.
// Actually, let's write a small script to read winrmService.js and extract the psScript string to print it.
const content = fs.readFileSync('./winrmService.js', 'utf8');
const start = content.indexOf('const psScript = `');
const end = content.indexOf('`;', start);
if (start >= 0 && end >= 0) {
  const psScript = content.substring(start, end + 2);
  fs.writeFileSync('generated_query.ps1', psScript, 'utf8');
  console.log("Script written to generated_query.ps1");
} else {
  console.log("Could not find psScript in winrmService.js");
}
