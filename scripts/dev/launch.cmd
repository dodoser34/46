@echo off
setlocal
chcp 65001 >nul
set "PYTHONUTF8=1"
if exist "%~dp0..\..\backend\.venv\Scripts\python.exe" (
    "%~dp0..\..\backend\.venv\Scripts\python.exe" "%~dp0launcher.py" %*
) else (
    py -3.11 --version >nul 2>&1
    if not errorlevel 1 (
        py -3.11 "%~dp0launcher.py" %*
    ) else (
        py -3 --version >nul 2>&1
        if not errorlevel 1 (
            py -3 "%~dp0launcher.py" %*
        ) else (
            python --version >nul 2>&1
            if errorlevel 1 (
                echo Python 3.11+ is required: https://www.python.org/downloads/
                pause
                exit /b 1
            )
            python "%~dp0launcher.py" %*
        )
    )
)
set "result=%errorlevel%"
if not "%result%"=="0" (
    echo.
    echo Launch failed. See the error above.
    pause
)
exit /b %result%
