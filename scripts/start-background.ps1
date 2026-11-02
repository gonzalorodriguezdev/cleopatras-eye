param([switch]$OpenBrowser, [switch]$BackendOnly)
$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $project
$address = 'http://127.0.0.1:4312'
$mutex = New-Object System.Threading.Mutex($false, 'Local\ForeverAuctionIntelligenceStartup')
if (!$mutex.WaitOne(0)) {
    if ($OpenBrowser) { Start-Process $address }
    exit
}
try {
    $logs = Join-Path $project 'logs'
    New-Item -ItemType Directory -Force $logs | Out-Null
    $docker = 'C:\Program Files\Docker\Docker\resources\bin\docker.exe'
    if (!(Get-Process 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe' -ArgumentList '-Minimized' -WindowStyle Hidden
    }
    $ready = $false
    for ($attempt=0; $attempt -lt 120; $attempt++) {
        $probe = Start-Process $docker -ArgumentList 'info --format {{.ServerVersion}}' -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logs 'docker-info.log') -RedirectStandardError (Join-Path $logs 'docker-info-error.log')
        if ($probe.ExitCode -eq 0) { $ready=$true; break }
        Start-Sleep -Seconds 5
    }
    if (!$ready) { throw 'Docker did not become ready within 10 minutes.' }
    $database = Start-Process $docker -ArgumentList 'compose up -d db' -WorkingDirectory $project -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $logs 'database-start.log') -RedirectStandardError (Join-Path $logs 'database-start-error.log')
    if ($database.ExitCode -ne 0) { throw 'Database startup failed; see database-start-error.log.' }
    $env:PORT='4312'
    $env:NODE_ENV='production'
    $node='C:\Program Files\nodejs\node.exe'
    $running=$false
    try { $running=(Invoke-WebRequest "$address/api/status" -UseBasicParsing -TimeoutSec 3).StatusCode -eq 200 } catch {}
    if (!$running) {
        Start-Process $node -ArgumentList '--import tsx server/index.ts' -WorkingDirectory $project -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logs 'app.log') -RedirectStandardError (Join-Path $logs 'app-error.log') | Out-Null
    }
    for ($attempt=0; $attempt -lt 60; $attempt++) {
        try {
            $status=Invoke-RestMethod "$address/api/status" -TimeoutSec 3
            if ($status.database -eq 'connected') {
                if ($OpenBrowser) { Start-Process $address }
                if (!$BackendOnly -and !$OpenBrowser) {
                    $desktop = Join-Path $project '.desktop/ForeverAuctionIntelligence.exe'
                    if (Test-Path -LiteralPath $desktop) {
                        Start-Process $desktop -ArgumentList '--background' -WorkingDirectory $project -WindowStyle Hidden | Out-Null
                    }
                }
                exit 0
            }
        } catch {}
        Start-Sleep -Seconds 2
    }
    throw 'App did not become ready. See logs/app-error.log.'
} catch {
    Add-Content (Join-Path $project 'logs/startup-error.log') "$(Get-Date -Format o) $($_.Exception.Message)"
    if ($OpenBrowser) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('The app could not start. Check the logs folder in the project.', 'Forever Auction Intelligence') | Out-Null
    }
    exit 1
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
