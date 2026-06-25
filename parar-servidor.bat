@echo off
chcp 65001 >nul
echo ============================================
echo   PDV.multi - Parando servidor
echo ============================================
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    echo Encerrando processo na porta 3000 (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="0" (
    echo Nenhum servidor rodando na porta 3000.
) else (
    echo Servidor parado.
)
echo.
timeout /t 2 >nul
