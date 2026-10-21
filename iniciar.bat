@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Falta instalar o Node.js. Baixe a versao LTS em https://nodejs.org, instale e abra este arquivo de novo.
  pause
  exit /b
)
if not exist node_modules (
  echo Instalando pela primeira vez, pode levar alguns minutos...
  call npm install
)
start "" http://localhost:3000
call npm run dev
