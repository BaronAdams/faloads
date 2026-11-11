param([string]$Archive = 'structcalc-windows.zip')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class WindowProbe {
  [StructLayout(LayoutKind.Sequential)]
  public struct Rect { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out Rect rect);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, ref Point point);
  [StructLayout(LayoutKind.Sequential)]
  public struct Point { public int X, Y; }
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
}
'@
$evidence = New-Item -ItemType Directory -Force 'windows-smoke'
# Spaces and a Unicode path exercise asset/plugin path resolution. Always launch
# the extracted ZIP from a different current directory than the executable.
$probeTemp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { [IO.Path]::GetTempPath() }
$extracted = Join-Path $probeTemp ('StructCalc verification é ' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Force $extracted | Out-Null
Expand-Archive $Archive $extracted -Force
$exe = Join-Path $extracted 'structcalc.exe'
$log = Join-Path $env:LOCALAPPDATA 'StructCalc/Logs/startup.log'
$failures = [System.Collections.Generic.List[string]]::new()
foreach ($mode in @('default', 'compatibility')) {
  if (Test-Path $log) { Remove-Item $log -Force }
  $options = @{ FilePath = $exe; WorkingDirectory = $probeTemp; PassThru = $true }
  if ($mode -eq 'compatibility') { $options.ArgumentList = '--compatibility' }
  $process = Start-Process @options
  try {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $ready = $false
    while ([DateTime]::UtcNow -lt $deadline) {
      $process.Refresh()
      if ($process.HasExited) { throw "Application exited: $($process.ExitCode) ($mode)" }
      if ($process.MainWindowHandle -ne 0 -and (Test-Path $log)) {
        $startup = Get-Content $log -Raw
        if ($startup.Contains('dart.startup.route_ready')) { $ready = $true; break }
      }
      Start-Sleep -Milliseconds 500
    }
    if (-not $ready) { throw "First application route was not painted ($mode)." }
    $startup = Get-Content $log -Raw
    foreach ($marker in @('native.start', 'dart.startup.main', 'dart.startup.first_frame', 'dart.preferences.loaded', 'dart.startup.route_ready')) {
      if (-not $startup.Contains($marker)) { throw "Startup marker missing: $marker ($mode)" }
    }
    $expectedMode = if ($mode -eq 'compatibility') { 'true' } else { 'false' }
    if (-not $startup.Contains("compatibility=$expectedMode")) { throw "Incorrect renderer mode: $mode" }
    if ($startup -match 'dart.flutter.error|dart.async.error|dart.preferences.failed') {
      throw "Startup exception detected ($mode)."
    }
    [WindowProbe]::SetForegroundWindow($process.MainWindowHandle) | Out-Null
    Start-Sleep -Seconds 2
    $rect = [WindowProbe+Rect]::new()
    [WindowProbe]::GetClientRect($process.MainWindowHandle, [ref]$rect) | Out-Null
    $point = [WindowProbe+Point]::new()
    [WindowProbe]::ClientToScreen($process.MainWindowHandle, [ref]$point) | Out-Null
    $bitmap = [System.Drawing.Bitmap]::new($rect.Right, $rect.Bottom)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.CopyFromScreen($point.X, $point.Y, 0, 0, $bitmap.Size)
      $bitmap.Save((Join-Path $evidence.FullName "$mode.png"))
      # Exclude the title bar: a window shell with a black/flat client must fail.
      $colors = [System.Collections.Generic.HashSet[int]]::new()
      for ($y = 16; $y -lt $bitmap.Height - 16; $y += 3) {
        for ($x = 16; $x -lt $bitmap.Width - 16; $x += 3) {
          [void]$colors.Add($bitmap.GetPixel($x, $y).ToArgb())
        }
      }
      if ($colors.Count -lt 32) { throw "Client area is blank ($mode): $($colors.Count) colors." }
      Write-Output "PASS: $mode release paints the application route; $($colors.Count) sampled colors."
    } finally {
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } catch {
    $failures.Add("${mode}: $_")
    Write-Output "FAIL: ${mode}: $_"
  } finally {
    # Capture failures too, before terminating the process. Preserve the
    # original test failure if diagnostic collection itself is unavailable.
    try {
      if ($process.MainWindowHandle -ne 0 -and -not (Test-Path (Join-Path $evidence.FullName "$mode.png"))) {
        $rect = [WindowProbe+Rect]::new()
        [WindowProbe]::GetClientRect($process.MainWindowHandle, [ref]$rect) | Out-Null
        $point = [WindowProbe+Point]::new()
        [WindowProbe]::ClientToScreen($process.MainWindowHandle, [ref]$point) | Out-Null
        $bitmap = [System.Drawing.Bitmap]::new($rect.Right, $rect.Bottom)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
          $graphics.CopyFromScreen($point.X, $point.Y, 0, 0, $bitmap.Size)
          $bitmap.Save((Join-Path $evidence.FullName "$mode.png"))
        } finally { $graphics.Dispose(); $bitmap.Dispose() }
      }
    } catch { Write-Warning "Capture unavailable: $_" }
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force
      [void]$process.WaitForExit(5000)
    }
    if (Test-Path $log) {
      Copy-Item $log (Join-Path $evidence.FullName "$mode.log") -Force -ErrorAction Continue
    }
  }
}

if ($failures.Count -gt 0) { throw ($failures -join "`n") }
