@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   PDV.multi - Iniciando servidor (dev)
echo ============================================
echo.

REM Sobe o Postgres (Docker) se ainda nao estiver no ar
echo [1/2] Verificando banco de dados (Docker)...
docker compose up -d
echo.

echo [2/2] Iniciando Next.js em http://localhost:3000
echo (Deixe esta janela ABERTA. Para parar: feche a janela ou rode parar-servidor.bat)
echo.
call npm run dev
