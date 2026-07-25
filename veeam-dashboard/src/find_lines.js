const fs = require('fs');
const path = require('path');

const srcDir = 'c:/Users/gea/Desktop/Desk/Proyectos/veeam-dash/veeam-dashboard/src';

function findLines(file, char) {
  const filePath = path.join(srcDir, file);
  if (!fs.existsSync(filePath)) {
    console.log("File does not exist:", filePath);
    return;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  lines.forEach((line, index) => {
    if (line.includes(char)) {
      console.log(`${file}:${index + 1}: ${line.trim()}`);
    }
  });
}

findLines('DashboardPage.js', '🔍');
findLines('LogsPage.js', '⚠');
