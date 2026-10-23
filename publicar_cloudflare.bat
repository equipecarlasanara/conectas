@echo off
set CLOUDFLARE_ACCOUNT_ID=c73fb1c3bbf7bd2e26dbee06ff613d69
cd /d "C:\Users\carla\OneDrive\Documentos\documentos conectas\conectas"
echo Gerando build e publicando Conectas na Cloudflare Pages...
call npm.cmd run build:cf
npx.cmd wrangler pages deploy out --project-name=conectas --branch=main --commit-dirty=true
pause
