@echo off
REM One-click start: build client + server, then start the server.
REM For a maxed built-in account, uncomment and edit the next line:
REM set MAX_ACCOUNT=admin:yourpassword

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" %*
pause
