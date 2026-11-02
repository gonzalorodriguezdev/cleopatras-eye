param([string]$RestoreCopy)
$ErrorActionPreference='Stop'
$project=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $project
$docker='C:\Program Files\Docker\Docker\resources\bin\docker.exe'
$backupDir=Join-Path $project 'backups'
New-Item -ItemType Directory -Force $backupDir | Out-Null
function DockerCommand([string[]]$Arguments) {
    $oldPreference=$ErrorActionPreference
    $ErrorActionPreference='Continue'
    & $docker @Arguments
    $result=$LASTEXITCODE
    $ErrorActionPreference=$oldPreference
    if($result -ne 0){throw "Docker command failed ($result)."}
}
if($RestoreCopy){
    $resolved=(Resolve-Path -LiteralPath $RestoreCopy).Path
    $target='fai_restore_'+(Get-Date -Format 'yyyyMMddHHmmss')
    DockerCommand @('compose','cp',$resolved,'db:/tmp/fai-restore.dump')
    DockerCommand @('compose','exec','-T','db','createdb','-U','fai',$target)
    DockerCommand @('compose','exec','-T','db','pg_restore','-U','fai','--exit-on-error','-d',$target,'/tmp/fai-restore.dump')
    Write-Output "Restored to separate database: $target. The active database was not changed."
}else{
    $name='fai-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.dump'
    DockerCommand @('compose','exec','-T','db','pg_dump','-U','fai','-d','fai','-Fc','-f','/tmp/fai-backup.dump')
    DockerCommand @('compose','cp','db:/tmp/fai-backup.dump',(Join-Path $backupDir $name))
    Write-Output "Backup saved: $name"
}
