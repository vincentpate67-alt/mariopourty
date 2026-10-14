@echo off
cd /d "%~dp0"
python "%~dp0scripts\local-server.py"
if errorlevel 1 pause
