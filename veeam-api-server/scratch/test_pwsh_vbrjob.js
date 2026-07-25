const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SERVER = process.env.VEEAM_SERVER;
const USER = process.env.VEEAM_USER;
const PASS = process.env.VEEAM_PASS;
const PORT = process.env.VEEAM_WINRM_PORT || '5986';

const scriptPath = path.join(__dirname, 'test_pwsh_vbrjob.ps1');

const psScript = `
$ErrorActionPreference = "Stop"
$securePass = ConvertTo-SecureString "${PASS}" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ("${USER}", $securePass)

$remoteScript = {
    $pwshCode = {
        Import-Module Veeam.Backup.PowerShell -ErrorAction SilentlyContinue
        try {
            $jobs = Get-VBRJob | ForEach-Object {
                @{ name = $_.Name; type = $_.JobType.ToString() }
            }
            return $jobs | ConvertTo-Json
        } catch {
            return @{ error = $_.Exception.Message } | ConvertTo-Json
        }
    }
    
    $tempFile = [System.IO.Path]::GetTempFileName() + ".ps1"
    $pwshCode.ToString() | Out-File -FilePath $tempFile -Encoding utf8
    
    $pwshPath = "pwsh"
    if (-not (Get-Command pwsh -ErrorAction SilentlyContinue)) {
        $pwshPath = "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
    }

    try {
        $jsonResult = & $pwshPath -NoProfile -ExecutionPolicy Bypass -File $tempFile
    } finally {
        Remove-Item -Path $tempFile -Force -ErrorAction SilentlyContinue
    }
    return $jsonResult
}

$sessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck
try {
    Invoke-Command -ComputerName "${SERVER}" -Port ${PORT} -Credential $cred -UseSSL -SessionOption $sessionOption -ScriptBlock $remoteScript -ErrorAction Stop
} catch {
    return @{ error = $_.Exception.Message } | ConvertTo-Json
}
`;

fs.writeFileSync(scriptPath, psScript, { encoding: 'utf8' });

console.log("Running remote pwsh Get-VBRJob test...");
exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
  try { fs.unlinkSync(scriptPath); } catch (e) {}
  console.log("STDOUT:\n", stdout);
  if (error) console.error("ERROR:\n", error, stderr);
});
