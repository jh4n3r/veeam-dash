<#
================================================================================
  Script: Setup-WinRM.ps1
  Descripción: Configuración automatizada de WinRM HTTPS (Puerto 5986) para Veeam Dash
  Autor: jh4n3r <jh4n3r@outlook.com>
================================================================================

  INSTRUCCIONES Y PARÁMETROS DE CONFIGURACIÓN:
  ------------------------------------------------------------------------------
  1. Ejecutar este script con privilegios de ADMINISTRADOR en el servidor Veeam B&R.
  2. Ajustar las siguientes variables de configuración antes de ejecutar:

  * $IpVeeam:
    - IP o FQDN del Servidor Veeam Backup & Replication.
    - Por defecto utiliza $env:COMPUTERNAME (Nombre de equipo local).
    - Puedes especificar la IP manualmente, ej: "192.168.1.100"

  * $AllowedIPs:
    - Lista de direcciones IP del servidor Backend (Node.js) autorizadas a conectarse.
    - Ej: @("192.168.1.50") o múltiples IPs @("192.168.1.50", "192.168.1.51")
    - Para permitir cualquier IP (solo entornos de prueba), asigna: @("Any")
================================================================================
#>

# --- CONFIGURACIÓN DE VARIABLES ---
# IP o Hostname para la generación del certificado SSL autofirmado
$IpVeeam = $env:COMPUTERNAME  # O especifica manualmente: "192.168.X.X"

# Lista de IPs autorizadas en el Firewall para conectarse a WinRM (Servidor Backend Node.js)
$AllowedIPs = @("192.168.1.50") # <-- Reemplaza con la IP real de tu servidor Node.js

# ==============================================================================
# INICIO DEL SCRIPT DE CONFIGURACIÓN
# ==============================================================================

# Verificación de Privilegios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "[ERROR] Este script debe ejecutarse como ADMINISTRADOR en PowerShell." -ForegroundColor Red
    exit 1
}

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " Iniciando configuración de WinRM HTTPS (Puerto 5986)..." -ForegroundColor Cyan
Write-Host " Autor: jh4n3r <jh4n3r@outlook.com>" -ForegroundColor DarkGray
Write-Host "=====================================================================" -ForegroundColor Cyan

# 1. Habilitar PSRemoting básico
Write-Host "[1/6] Habilitando PSRemoting básico..." -ForegroundColor Yellow
Enable-PSRemoting -Force -SkipNetworkProfileCheck | Out-Null

# 2. Crear Certificado Autofirmado
Write-Host "[2/6] Generando certificado SSL autofirmado para: $IpVeeam" -ForegroundColor Yellow
$Cert = New-SelfSignedCertificate -CertStoreLocation Cert:\LocalMachine\My -DnsName $IpVeeam
$Thumbprint = $Cert.Thumbprint
Write-Host "      Certificado creado exitosamente. Thumbprint: $Thumbprint" -ForegroundColor Green

# 3. Limpiar Listeners HTTPS previos
Write-Host "[3/6] Limpiando Listeners HTTPS previos (si existen)..." -ForegroundColor Yellow
Remove-Item -Path WSMan:\LocalHost\Listener\Listener* -Recurse -Force -ErrorAction SilentlyContinue

# 4. Crear el Listener HTTPS en el puerto 5986
Write-Host "[4/6] Creando Listener HTTPS en el puerto 5986..." -ForegroundColor Yellow
New-Item -Path WSMan:\LocalHost\Listener -Transport HTTPS -Address * -CertificateThumbPrint $Thumbprint -Force | Out-Null

# 5. Configurar Regla de Firewall
Write-Host "[5/6] Configurando regla de Firewall para WinRM HTTPS (5986)..." -ForegroundColor Yellow
Write-Host "      IPs autorizadas: $($AllowedIPs -join ', ')" -ForegroundColor Gray
Remove-NetFirewallRule -DisplayName "WinRM HTTPS (5986)" -ErrorAction SilentlyContinue

if ($AllowedIPs -contains "Any") {
    New-NetFirewallRule -DisplayName "WinRM HTTPS (5986)" -Profile Any -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5986 | Out-Null
} else {
    New-NetFirewallRule -DisplayName "WinRM HTTPS (5986)" -Profile Any -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5986 -RemoteAddress $AllowedIPs | Out-Null
}

# 6. Reiniciar el servicio WinRM
Write-Host "[6/6] Reiniciando servicio WinRM..." -ForegroundColor Yellow
Restart-Service WinRM

Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host " ¡Configuración de WinRM completada con éxito!" -ForegroundColor Green
Write-Host " El servidor Node.js ahora puede conectarse vía WinRM HTTPS al puerto 5986."
Write-Host "=====================================================================" -ForegroundColor Cyan
