// veeam-api-server/winrmService.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const executeWinRM = () => {
  return new Promise((resolve, reject) => {
    // Configuración desde .env
    const SERVER = process.env.VEEAM_SERVER || process.env.VEEAM_ONE_SERVER;
    const USER = process.env.VEEAM_USER;
    const PASS = process.env.VEEAM_PASS;
    const PORT = process.env.VEEAM_WINRM_PORT || '5986';

    if (!SERVER || !USER || !PASS) {
      return reject(new Error('Faltan credenciales de Veeam en el archivo .env'));
    }

    const scriptPath = path.join(__dirname, 'veeam_query.ps1');
        // Script de PowerShell optimizado que se ejecuta vía WinRM
    const psScript = `
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$server = "${SERVER}"
$user = "${USER}"
$pass = "${PASS}"
$port = ${PORT}
$securePass = ConvertTo-SecureString $pass -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential ($user, $securePass)

$remoteScript = {
    $pwshCode = {
        $ErrorActionPreference = 'Stop'
        $WarningPreference = 'SilentlyContinue'
        $ProgressPreference = 'SilentlyContinue'
        $InformationPreference = 'SilentlyContinue'
        $VerbosePreference = 'SilentlyContinue'
        $DebugPreference = 'SilentlyContinue'
        
        try {
            try { Add-PSSnapin -Name VeeamPSSnapIn -ErrorAction SilentlyContinue } catch {}
            try { Import-Module Veeam.Backup.PowerShell -ErrorAction SilentlyContinue } catch {}
            
            # Recolectar Proxies
            $proxies = @(Get-VBRViProxy | ForEach-Object {
                [PSCustomObject]@{
                    id = "$($_.Id)"
                    name = "$($_.Name)"
                    type = "$($_.Type)"
                    description = "$($_.Description)"
                    transportMode = "$($_.TransportMode)"
                    maxTaskCount = if ($_.MaxTasksCount -ne $null) { [int]$_.MaxTasksCount } else { 0 }
                }
            })
            
            # Recolectar Repositorios
            $repos = @(Get-VBRBackupRepository | ForEach-Object {
                $cap = 0; $free = 0
                try {
                    $container = $_.GetContainer()
                    if ($container -ne $null) {
                        if ($container.CachedTotalSpace -ne $null) {
                            $cap = [long]$container.CachedTotalSpace.InBytes
                        }
                        if ($container.CachedFreeSpace -ne $null) {
                            $free = [long]$container.CachedFreeSpace.InBytes
                        }
                    }
                } catch { }
                
                $capGB = [math]::Round($cap / 1GB, 2)
                $freeGB = [math]::Round($free / 1GB, 2)
                $usedGB = [math]::Max(0, $capGB - $freeGB)
                $pct = if ($capGB -gt 0) { ($usedGB / $capGB) * 100 } else { 0 }

                [PSCustomObject]@{
                    id = "$($_.Id)"
                    name = "$($_.Name)"
                    type = "$($_.Type)"
                    capacity = $capGB
                    free = $freeGB
                    used = $usedGB
                    percent = [math]::Round($pct, 2)
                }
            })

            # Recolectar Sesiones (últimos 30 días)
            $since = (Get-Date).AddDays(-30)
            $allSessions = @()
            
            # Get-VBRBackupSession: incluye Backup, Replica, SimpleBackupCopyWorker (Backup Copy), etc.
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

            $sessions = $allSessions | ForEach-Object {
                $sess = $_
                $status = if ($sess.Result -ne $null) { "$($sess.Result)" } else { "None" }
                $state = if ($sess.State -ne $null) { "$($sess.State)" } else { "Stopped" }
                if ($state -eq "Working" -or $state -eq "Starting" -or $state -eq "Resuming") { $status = "Running" }

                $jType = if ($sess.ForcedJobType) { $sess.ForcedJobType } else { "Unknown" }
                
                # Intentar obtener logs detallados (Timeline)
                $logLines = @()
                try {
                    $ts = $null
                    if ($null -ne $sess) {
                        try { $ts = Get-VBRTaskSession -Session $sess -ErrorAction SilentlyContinue } catch {}
                    }
                    if ($ts) {
                        foreach ($t in ($ts | Sort-Object CreationTime)) {
                            $tTime = ""
                            try {
                                if ($t -ne $null -and $t.CreationTime -ne $null) {
                                    $tTime = $t.CreationTime.ToString('HH:mm:ss')
                                }
                            } catch {}
                            
                            $tStatus = ""
                            try { if ($t.Status -ne $null) { $tStatus = $t.Status } } catch {}
                            
                            $tName = ""
                            try { if ($t.Name -ne $null) { $tName = $t.Name } } catch {}
                            
                            $tDesc = ""
                            try { if ($t.Description -ne $null) { $tDesc = $t.Description } } catch {}
                            
                            $logLines += "[$($tTime)] ($($tStatus)) $($tName) - $($tDesc)"
                            try {
                                if ($t -ne $null -and $t.Logger -ne $null) {
                                    $logObj = $t.Logger.GetLog()
                                    if ($logObj -ne $null) {
                                        $records = $logObj.UpdatedRecords
                                        if ($records -ne $null) {
                                            foreach ($r in $records) {
                                                $rTime = ""
                                                try {
                                                    if ($r -ne $null -and $r.StartTime -ne $null) {
                                                        $rTime = $r.StartTime.ToString('HH:mm:ss')
                                                    }
                                                } catch {}
                                                
                                                $rStatus = ""
                                                try { if ($r.Status -ne $null) { $rStatus = $r.Status } } catch {}
                                                
                                                $rTitle = ""
                                                try { if ($r.Title -ne $null) { $rTitle = $r.Title } } catch {}
                                                
                                                $logLines += "   - [$($rTime)] ($($rStatus)) $($rTitle)"
                                            }
                                        }
                                    }
                                }
                            } catch {}
                        }
                    }
                } catch {
                    $logLines += "Error al obtener tasks: $($_.Exception.Message)"
                }

                $sessionDetails = "$($sess.ResultDetails)"
                $finalDetails = ""
                if ($sessionDetails -and $sessionDetails -ne "Success" -and $sessionDetails -ne "Failed") {
                    $finalDetails += "Session Details: $sessionDetails\`n"
                }
                if ($logLines.Count -gt 0) {
                    $finalDetails += "Timeline:\`n" + ($logLines -join "\`n")
                }
                
                # Fallback a descripcion de progreso si sigue vacio o es generico
                if ($finalDetails -eq "") {
                    try { if ($sess.Progress.Description) { $finalDetails = $sess.Progress.Description } } catch {}
                }
                
                # Si aun asi no hay nada, no dejarlo vacio
                if ($finalDetails -eq "") { $finalDetails = "Sin detalles (Status: $status)" }

                $isRetry = $false
                $willRetry = $false
                try { if ($sess.IsRetryMode -ne $null) { $isRetry = [bool]$sess.IsRetryMode } } catch {}
                try { if ($sess.WillBeRetried -ne $null) { $willRetry = [bool]$sess.WillBeRetried } } catch {}

                $sessCreationTime = $null
                try { if ($sess.CreationTime -ne $null) { $sessCreationTime = $sess.CreationTime.ToString("yyyy-MM-ddTHH:mm:ss") } } catch {}

                $sessEndTime = $null
                try {
                    if ($sess.EndTime -ne $null -and $sess.EndTime -ne "") {
                        if ($sess.EndTime.Year -gt 1900) {
                            $sessEndTime = $sess.EndTime.ToString("yyyy-MM-ddTHH:mm:ss")
                        }
                    }
                } catch {}

                [PSCustomObject]@{
                    id = "$($sess.Id)"
                    name = "$($sess.Name)"
                    sessionType = $jType
                    creationTime = $sessCreationTime
                    endTime = $sessEndTime
                    result = @{ result = $status; resultDetails = $finalDetails }
                    progress = if ($sess.Progress) { [int]$sess.Progress.Percent } else { 0 }
                    statistics = @{ processedSize = if ($sess.Progress) { [long]$sess.Progress.ProcessedSize } else { 0 } }
                    isRetry = $isRetry
                    willRetry = $willRetry
                }
            }

            # Recolectar Servidores Gestionados
            $managedServers = @(Get-VBRServer | ForEach-Object {
                [PSCustomObject]@{
                    id = "$($_.Id)"
                    name = "$($_.Name)"
                    type = "$($_.Type)"
                    description = "$($_.Description)"
                }
            })

            # Puntos de Restauración por Job
            $allBackups = Get-VBRBackup
            $backupObjects = @(Get-VBRRestorePoint | Group-Object BackupId | ForEach-Object {
                $bid = $_.Name
                $b = $allBackups | Where-Object { $_.Id -eq $bid }
                $jobName = if ($b -ne $null) { $b.Name } else { "Job Desconocido" }
                [PSCustomObject]@{
                    id = "$($bid)"
                    name = "$($jobName)"
                    restorePointsCount = [int]$_.Count
                }
            } | Sort-Object restorePointsCount -Descending | Select-Object -First 200)

            # Recolectar Jobs y sus Relaciones
            $backupsLookup = @{}
            try {
                if ($allBackups -ne $null) {
                    $allBackups | ForEach-Object {
                        if ($_.Name) {
                            $backupsLookup[$_.Name] = $_
                        }
                    }
                }
            } catch {}

            # Crear tabla de búsqueda de restorePointsCount usando los datos ya agrupados en backupObjects
            $rpLookup = @{}
            try {
                if ($backupObjects -ne $null) {
                    foreach ($bo in $backupObjects) {
                        if ($bo.name -and $bo.name -ne "Job Desconocido") {
                            $rpLookup[$bo.name] = $bo.restorePointsCount
                        }
                    }
                }
            } catch {}

            $jobs = @()
            try {
                $rawJobs = @()
                try { $rawJobs += Get-VBRJob } catch {}
                try { if (Get-Command Get-VBRComputerBackupJob -ErrorAction SilentlyContinue) { $rawJobs += Get-VBRComputerBackupJob } } catch {}
                try { if (Get-Command Get-VBRAgentJob -ErrorAction SilentlyContinue) { $rawJobs += Get-VBRAgentJob } } catch {}
                try { if (Get-Command Get-VBRTapeJob -ErrorAction SilentlyContinue) { $rawJobs += Get-VBRTapeJob } } catch {}
                try { if (Get-Command Get-VBRNASBackupJob -ErrorAction SilentlyContinue) { $rawJobs += Get-VBRNASBackupJob } } catch {}
                try { if (Get-Command Get-VBRSureBackupJob -ErrorAction SilentlyContinue) { $rawJobs += Get-VBRSureBackupJob } } catch {}

                $allVbrJobs = $rawJobs | Sort-Object Id -Unique
                $jobLookup = @{}
                if ($allVbrJobs -ne $null) {
                    $allVbrJobs | ForEach-Object { if ($_.Id -and $_.Name) { $jobLookup["$($_.Id)"] = $_.Name } }
                }

                $jobs = $allVbrJobs | ForEach-Object {
                    $j = $_
                    $targetRepoName = "N/A"
                    $targetRepoId = ""
                    $targetRepoType = ""
                    
                    $parentJobId = ""
                    $parentJobName = ""
                    try {
                        if ($j.ScheduleOptions) {
                            if ($j.ScheduleOptions.OptionsAfterJob -and $j.ScheduleOptions.OptionsAfterJob.Enabled) {
                                if ($j.ScheduleOptions.OptionsAfterJob.ParentJobName) {
                                    $parentJobName = "$($j.ScheduleOptions.OptionsAfterJob.ParentJobName)"
                                }
                                if ($j.ScheduleOptions.OptionsAfterJob.ParentJobId -and $j.ScheduleOptions.OptionsAfterJob.ParentJobId -ne [Guid]::Empty) {
                                    $parentJobId = "$($j.ScheduleOptions.OptionsAfterJob.ParentJobId)"
                                }
                            }
                            if ($parentJobId -eq "" -and $j.ScheduleOptions.ParentJobId -and $j.ScheduleOptions.ParentJobId -ne "00000000-0000-0000-0000-000000000000" -and $j.ScheduleOptions.ParentJobId -ne [Guid]::Empty) {
                                $parentJobId = "$($j.ScheduleOptions.ParentJobId)"
                                if ($jobLookup.ContainsKey($parentJobId)) {
                                    $parentJobName = $jobLookup[$parentJobId]
                                }
                            }
                        }
                    } catch {}

                    $targetVMs = @()
                    try {
                        if ($j.GetObjects) {
                            $targetVMs = @($j.GetObjects() | ForEach-Object { "$($_.Name)" })
                        } elseif ($j.Objects) {
                            $targetVMs = @($j.Objects | ForEach-Object { "$($_.Name)" })
                        }
                    } catch {}

                    $sourceJobIds = @()
                    $sourceJobNames = @()
                    try {
                        if ($j.SourceJobs) {
                            foreach ($sj in $j.SourceJobs) {
                                $sId = "$($sj.Id)"
                                $sourceJobIds += $sId
                                if ($jobLookup.ContainsKey($sId)) {
                                    $sourceJobNames += $jobLookup[$sId]
                                } elseif ($sj.Name) {
                                    $sourceJobNames += "$($sj.Name)"
                                }
                            }
                        }
                    } catch {}

                    $jobTypeString = "Backup"
                    try {
                        if ($j.JobType -ne $null) {
                            $jobTypeString = "$($j.JobType)"
                        } elseif ($j.TypeString -ne $null) {
                            $jobTypeString = "$($j.TypeString)"
                        }
                    } catch {}

                    try {
                        if ($jobTypeString -eq "Backup" -or $jobTypeString -eq "BackupCopy" -or $jobTypeString -like "*Copy*") {
                            $repo = $j.GetTargetRepository()
                            if ($repo -ne $null) {
                                $targetRepoName = $repo.Name
                                $targetRepoId = "$($repo.Id)"
                                $targetRepoType = "$($repo.Type)"
                            }
                        }
                    } catch {}

                    $totalSize = 0
                    $rpCount = 0
                    try {
                        if ($rpLookup.ContainsKey($j.Name)) {
                            $rpCount = $rpLookup[$j.Name]
                        }
                        $backup = $backupsLookup[$j.Name]
                        if ($backup -and $backup.ResultingSize) {
                            $totalSize = [long]$backup.ResultingSize
                        }
                    } catch {}

                    $isScheduleEnabled = $false
                    try { if ($j.IsScheduleEnabled -ne $null) { $isScheduleEnabled = [bool]$j.IsScheduleEnabled } } catch {}

                    $nextRunStr = ""
                    try {
                        if ($j.NextRunTime -and $j.NextRunTime.Year -gt 1900) {
                            $nextRunStr = $j.NextRunTime.ToString("yyyy-MM-ddTHH:mm:ss")
                        } elseif ($j.NextRun -and $j.NextRun.Year -gt 1900) {
                            $nextRunStr = $j.NextRun.ToString("yyyy-MM-ddTHH:mm:ss")
                        }
                    } catch {}

                    $lastRunStr = ""
                    try {
                        if ($j.LatestRunTime -and $j.LatestRunTime.Year -gt 1900) {
                            $lastRunStr = $j.LatestRunTime.ToString("yyyy-MM-ddTHH:mm:ss")
                        } elseif ($j.LastTime -and $j.LastTime.Year -gt 1900) {
                            $lastRunStr = $j.LastTime.ToString("yyyy-MM-ddTHH:mm:ss")
                        }
                    } catch {}

                    $scheduleDesc = "Manual"
                    try {
                        if ($parentJobName -ne "") {
                            $scheduleDesc = "Ejecutar tras '$parentJobName'"
                        } elseif ($j.ScheduleOptions) {
                            if ($j.ScheduleOptions.OptionsDaily -and $j.ScheduleOptions.OptionsDaily.Enabled) {
                                $scheduleDesc = "Diario"
                            } elseif ($j.ScheduleOptions.OptionsPeriodically -and $j.ScheduleOptions.OptionsPeriodically.Enabled) {
                                $scheduleDesc = "Periódico"
                            } elseif ($j.ScheduleOptions.OptionsMonthly -and $j.ScheduleOptions.OptionsMonthly.Enabled) {
                                $scheduleDesc = "Mensual"
                            } elseif ($isScheduleEnabled) {
                                $scheduleDesc = "Programado"
                            }
                        }
                    } catch {}

                    [PSCustomObject]@{
                        id = "$($j.Id)"
                        name = "$($j.Name)"
                        type = $jobTypeString
                        repositoryId = $targetRepoId
                        repositoryName = $targetRepoName
                        repositoryType = $targetRepoType
                        parentJobId = $parentJobId
                        parentJobName = $parentJobName
                        sourceJobIds = $sourceJobIds
                        sourceJobNames = $sourceJobNames
                        restorePointsCount = $rpCount
                        sizeInBytes = $totalSize
                        isScheduleEnabled = $isScheduleEnabled
                        nextRun = $nextRunStr
                        lastRun = $lastRunStr
                        scheduleDescription = $scheduleDesc
                        targetVMs = $targetVMs
                    }
                }
            } catch {}

            # Construir objeto resultante
            $result = @{
                proxies = $proxies
                repositories = $repos
                sessions = $sessions
                managedServers = $managedServers
                backupObjects = $backupObjects
                jobs = $jobs
                serverInfo = @{ name = "$($env:COMPUTERNAME)"; version = "WinRM Extractor (pwsh)" }
            }

            $result | ConvertTo-Json -Depth 3 -Compress
        } catch {
            $fallback = @{ proxies = @(); repositories = @(); sessions = @(); managedServers = @(); backupObjects = @(); jobs = @(); serverInfo = @{ name = "WinRM Error"; version = $_.Exception.Message } }
            $fallback | ConvertTo-Json -Depth 3 -Compress
        }
    }

    # Guardar el código en un archivo temporal remoto para evitar límites de longitud en la línea de comandos
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

# Ejecutar el bloque de script de forma remota vía WinRM
$sessionOption = New-PSSessionOption -SkipCACheck -SkipCNCheck
try {
    Invoke-Command -ComputerName $server -Port $port -Credential $cred -UseSSL -SessionOption $sessionOption -ScriptBlock $remoteScript -ErrorAction Stop
} catch {
    $fallback = @{ proxies = @(); repositories = @(); sessions = @(); managedServers = @(); backupObjects = @(); serverInfo = @{ name = "Connection Error"; version = $_.Exception.Message } }
    $fallback | ConvertTo-Json -Depth 3 -Compress
}
`;

    // Escribir el script temporalmente
    fs.writeFileSync(scriptPath, psScript, { encoding: 'utf8' });

    // Ejecutar el script
    exec(`powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      // Limpiar archivo por seguridad
      try { fs.unlinkSync(scriptPath); } catch (e) {}

      if (error) {
        console.error('Error al ejecutar WinRM:', stderr || error.message);
        return reject(error);
      }

      try {
        // Buscar el inicio del JSON por si PowerShell emitió warnings antes
        const jsonStart = stdout.indexOf('{');
        const cleanStdout = jsonStart >= 0 ? stdout.substring(jsonStart) : stdout;
        
        const data = JSON.parse(cleanStdout);
        resolve(data);
      } catch (parseError) {
        console.error('Error parseando JSON devuelto por WinRM:', parseError.message);
        reject(parseError);
      }
    });
  });
};

module.exports = {
  executeWinRM
};
