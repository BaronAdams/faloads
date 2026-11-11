param(
  [string]$Bundle = 'build/windows/x64/runner/Release',
  [string]$Archive = 'structcalc-windows.zip'
)
$ErrorActionPreference = 'Stop'
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vs = & $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
if (-not $vs) { throw 'Visual C++ redistributable directory not found.' }
# Use the redistributables from the actual MSVC toolset used by the runner.
$redist = Get-ChildItem "$vs/VC/Redist/MSVC" -Directory |
  Where-Object { $_.Name -match '^\d+\.\d+\.\d+$' } |
  Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
$crt = Get-ChildItem "$($redist.FullName)/x64" -Directory -Filter 'Microsoft.VC*.CRT' |
  Select-Object -First 1
if (-not $crt) { throw 'x64 Visual C++ runtime missing.' }
Copy-Item "$($crt.FullName)/*.dll" $Bundle -Force
Copy-Item "$PSScriptRoot/Lancer-compatibilite.cmd", "$PSScriptRoot/LIRE-MOI.txt" $Bundle
$required = @('structcalc.exe', 'flutter_windows.dll', 'msvcp140.dll',
  'vcruntime140.dll', 'vcruntime140_1.dll', 'data/app.so', 'data/icudtl.dat',
  'data/flutter_assets/FontManifest.json',
  'data/flutter_assets/assets/fonts/DMSans-Variable.ttf',
  'data/flutter_assets/assets/fonts/JetBrainsMono-Variable.ttf')
foreach ($file in $required) {
  if (-not (Test-Path (Join-Path $Bundle $file))) { throw "Bundle incomplete: $file" }
}
Compress-Archive -Path "$Bundle/*" -DestinationPath $Archive -Force
