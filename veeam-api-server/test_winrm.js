const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SERVER = process.env.VEEAM_SERVER;
const USER = process.env.VEEAM_USER;
const PASS = process.env.VEEAM_PASS;
const PORT = process.env.VEEAM_WINRM_PORT || '5986';

const scriptPath = path.join(__dirname, 'test_query.ps1');

const psScript = `
$ErrorActionPreference = "Stop"
$securePass = ConvertTo-SecureString "${PASS}" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ("${USER}", $securePass)

$remoteScript = {
    Add-PSSnapin -Name VeeamPSSnapIn -ErrorAction SilentlyContinue
    Import-Module Veeam.Backup.PowerShell -ErrorAction SilentlyContinue
    
    # List session-related cmdlets
    $cmdlets = Get-Command -Module Veeam* -Name *Session* | Select-Object -ExpandProperty Name
    $ver = (Get-VBRLocalhost).Version
    return @{ cmdlets = $cmdlets; version = $ver } | ConvertTo-Json
}

$sessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck
try {
    Invoke-Command -ComputerName "${SERVER}" -Port ${PORT} -Credential $cred -UseSSL -SessionOption $sessionOption -ScriptBlock $remoteScript -ErrorAction Stop
} catch {
    return @{ error = $_.Exception.Message } | ConvertTo-Json
}
`;

fs.writeFileSync(scriptPath, psScript, { encoding: 'utf8' });

exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
  try { fs.unlinkSync(scriptPath); } catch (e) {}
  console.log("STDOUT:\n", stdout);
  if (error) console.error("ERROR:\n", error, stderr);
});
