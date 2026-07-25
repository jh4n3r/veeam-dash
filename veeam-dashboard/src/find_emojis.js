const fs = require('fs');
const path = require('path');

const srcDir = 'c:\\Users\\gea\\Desktop\\Desk\\Proyectos\\veeam-dash\\veeam-dashboard\\src';
const files = ['DashboardPage.js', 'LogsPage.js', 'ConfigPage.js', 'App.js'];

const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E6}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]/gu;

files.forEach(file => {
  const filePath = path.join(srcDir, file);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const matches = content.match(emojiRegex);
  if (matches) {
    console.log(`File: ${file}`);
    console.log('Unique emojis found:', Array.from(new Set(matches)));
  }
});
