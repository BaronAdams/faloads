@echo off
setlocal
cd /d "%~dp0"
start "" /wait "%~dp0KaliSigma.exe" --compatibility
