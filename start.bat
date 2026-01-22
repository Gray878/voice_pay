@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Voice-to-Pay Startup
echo ========================================
echo.

REM Check Python
echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Please install Python 3.9+
    echo Download: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo [OK] Python ready
echo.

REM Check Node.js
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js 18+
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)
node --version
echo [OK] Node.js ready
echo.

REM Check dependencies
echo [3/6] Checking dependencies...

if not exist "ai_service\.venv" (
    echo [WARNING] Python virtual environment not found
    echo Creating virtual environment...
    cd ai_service
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment
        cd ..
        pause
        exit /b 1
    )
    echo Installing Python dependencies...
    call .venv\Scripts\activate.bat
    pip install -r requirements.txt
    if errorlevel 1 (
        echo [ERROR] Failed to install Python dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Python environment created
)

if not exist "web3_service\node_modules" (
    echo [WARNING] Web3 service dependencies not found
    echo Installing dependencies...
    cd web3_service
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install Web3 dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Web3 dependencies installed
)

if not exist "web_frontend\node_modules" (
    echo [WARNING] Frontend dependencies not found
    echo Installing dependencies...
    cd web_frontend
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        cd ..
        pause
        exit /b 1
    )
    cd ..
    echo [OK] Frontend dependencies installed
)

echo [OK] All dependencies ready
echo.

REM Start AI Service
echo [4/6] Starting AI Service (Port 8000)...
start "Voice-to-Pay AI Service" cmd /k "cd /d %~dp0ai_service && .venv\Scripts\activate.bat && python main.py"
timeout /t 3 /nobreak >nul
echo [OK] AI Service started
echo.

REM Start Web3 Service
echo [5/6] Starting Web3 Service (Port 3001)...
start "Voice-to-Pay Web3 Service" cmd /k "cd /d %~dp0web3_service && npm run dev"
timeout /t 3 /nobreak >nul
echo [OK] Web3 Service started
echo.

REM Start Frontend
echo [6/6] Starting Frontend (Port 5173)...
start "Voice-to-Pay Frontend" cmd /k "cd /d %~dp0web_frontend && npm run dev"
timeout /t 3 /nobreak >nul
echo [OK] Frontend started
echo.

echo ========================================
echo All services started successfully!
echo ========================================
echo.
echo AI Service:      http://localhost:8000
echo Web3 Service:    http://localhost:3001
echo Frontend:        http://localhost:5173
echo.
echo Tips:
echo - Open http://localhost:5173 in your browser
echo - Closing this window will NOT stop the services
echo - To stop services, close the individual command windows
echo.
echo Press any key to exit...
pause >nul
