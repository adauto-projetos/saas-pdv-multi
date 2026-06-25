@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   PDV.multi - Reinicio LIMPO (resolve tela
echo   branca / barra piscando / loop de reload)
echo ============================================
echo.

echo [1/3] Parando servidor na porta 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

echo [2/3] Limpando cache do Next (.next)...
if exist ".next" rmdir /s /q ".next"

echo [3/3] Iniciando servidor limpo em http://localhost:3000
echo (Deixe esta janela ABERTA)
echo.
call npm run dev
