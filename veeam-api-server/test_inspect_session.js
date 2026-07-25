const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SERVER = process.env.VEEAM_SERVER;
const USER = process.env.VEEAM_USER;
const PASS = process.env.VEEAM_PASS;
const PORT = process.env.VEEAM_WINRM_PORT || '5986';

const scriptPath = path.join(__dirname, 'test_run.ps1');

const psScript = `
$ErrorActionPreference = "Stop"
$securePass = ConvertTo-SecureString "${PASS}" -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ("${USER}", $securePass)

$remoteScript = {
    $pwshCode = {
        $ErrorActionPreference = 'Stop'
        try {
            Add-PSSnapin -Name VeeamPSSnapIn -ErrorAction SilentlyContinue
            Import-Module Veeam.Backup.PowerShell -ErrorAction SilentlyContinue
            
            $since = (Get-Date).AddDays(-30)
            $allSessions = @()
            try {
                Get-VBRBackupSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object {
                    $forcedType = "Backup"
                    if ($_.JobType -eq "SimpleBackupCopyWorker" -or $_.JobTypeString -eq "Backup Copy" -or $_.JobType -eq "BackupCopy" -or $_.JobTypeString -eq "BackupCopy") {
                        $forcedType = "Backup Copy"
                    } elseif ($_.JobType -eq "Replica" -or $_.JobTypeString -eq "Replica") {
                        $forcedType = "Replica"
                    } elseif ($_.JobType -eq "Restore" -or $_.JobTypeString -eq "Restore") {
                        $forcedType = "Restore"
                    }
                    $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", $forcedType)))
                    $allSessions += $_
                }
            } catch {}

            try { if (Get-Command Get-VBRTapeSession -ErrorAction SilentlyContinue) { Get-VBRTapeSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "Tape"))); $allSessions += $_ } } } catch {}
            try { if (Get-Command Get-VBRComputerBackupJobSession -ErrorAction SilentlyContinue) { Get-VBRComputerBackupJobSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "Agent Backup"))); $allSessions += $_ } } } catch {}
            try { if (Get-Command Get-VBRReplicaSession -ErrorAction SilentlyContinue) { Get-VBRReplicaSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "Replica"))); $allSessions += $_ } } } catch {}
            try { if (Get-Command Get-VBRCopySession -ErrorAction SilentlyContinue) { Get-VBRCopySession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "Backup Copy"))); $allSessions += $_ } } } catch {}
            try { if (Get-Command Get-VBRNASBackupSession -ErrorAction SilentlyContinue) { Get-VBRNASBackupSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "NAS Backup"))); $allSessions += $_ } } } catch {}
            try { if (Get-Command Get-VBRSureBackupSession -ErrorAction SilentlyContinue) { Get-VBRSureBackupSession | Where-Object { $_.CreationTime -ge $since } | ForEach-Object { $_.PSObject.Properties.Add((New-Object PSNoteProperty("ForcedJobType", "SureBackup"))); $allSessions += $_ } } } catch {}

            return "SUCCESS: " + $allSessions.Count + " sessions found"
        } catch {
            return "ERROR: " + $_.Exception.Message
        }
    }

    $tempFile = [System.IO.Path]::GetTempFileName() + ".ps1"
    $pwshCode.ToString() | Out-File -FilePath $tempFile -Encoding utf8
    
    $pwshPath = "pwsh"
    if (-not (Get-Command pwsh -ErrorAction SilentlyContinue)) {
        $pwshPath = "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
    }

    try {
        $result = & $pwshPath -NoProfile -ExecutionPolicy Bypass -File $tempFile 2>&1
        return $result
    } catch {
        return "OUTER ERROR: " + $_.Exception.Message
    } finally {
        Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    }
}

$sessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck
try {
    $res = Invoke-Command -ComputerName "${SERVER}" -Port ${PORT} -Credential $cred -UseSSL -SessionOption $sessionOption -ScriptBlock $remoteScript -ErrorAction Stop
    Write-Output "RESULT: $res"
} catch {
    Write-Output "INVOKE ERROR: $($_.Exception.Message)"
}
`;

fs.writeFileSync(scriptPath, psScript, { encoding: 'utf8' });

exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
  try { fs.unlinkSync(scriptPath); } catch (e) {}
  console.log("STDOUT:", stdout);
  console.log("STDERR:", stderr);
});
