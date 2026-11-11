@echo off
setlocal
cd /d "%~dp0"
if not exist "structcalc.exe" (
  echo Extrayez toute l'archive dans un dossier avant de lancer l'application.
  pause
  exit /b 1
)
start "" /wait "%~dp0structcalc.exe" --compatibility
