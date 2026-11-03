param([string]$AddonDirectory='C:\Program Files (x86)\World of Warcraft\_forever_\Interface\AddOns')
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
if (!(Test-Path -LiteralPath (Join-Path $AddonDirectory 'Auctionator/Auctionator.toc'))) { throw 'Auctionator is not installed in this directory.' }
$destination=Join-Path $AddonDirectory 'CleopatrasEyeBridge'
if (Test-Path -LiteralPath $destination) {
 $backup=Join-Path $project ('data/addon-backups/bridge-'+(Get-Date -Format yyyyMMdd-HHmmss))
 New-Item -ItemType Directory -Path $backup -Force | Out-Null
 Get-ChildItem -LiteralPath $destination -File | Copy-Item -Destination $backup
}
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'addon/CleopatrasEyeBridge/Bridge.lua') -Destination (Join-Path $destination 'Bridge.lua')
Copy-Item -LiteralPath (Join-Path $project 'addon/CleopatrasEyeBridge/CleopatrasEyeBridge.toc') -Destination (Join-Path $destination 'CleopatrasEyeBridge.toc')
Write-Output 'Cleopatra bridge installed. Restart the game client to discover the new addon. Auctionator was not modified.'
