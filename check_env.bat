@echo off
echo ========================================
echo Voice-to-Pay Environment Check
echo ========================================
echo.

echo [1] Checking Python...
python --version 2>nul
if errorlevel 1 (
    echo [FAIL] Python not found
    echo Please install Python 3.9+ from https://www.python.org/downloads/
) else (
    echo [PASS] Python installed
)
echo.

echo [2] Checking Node.js...
node --version 2>nul
if errorlevel 1 (
    echo [FAIL] Node.js not found
    echo Please install Node.js 18+ from https://nodejs.org/
) else (
    echo [PASS] Node.js installed
)
echo.

echo [3] Checking npm...
npm --version 2>nul
if errorlevel 1 (
    echo [FAIL] npm not found
) else (
    echo [PASS] npm installed
)
echo.

echo [4] Checking Python virtual environment...
if exist "ai_service\.venv" (
    echo [PASS] Python venv exists
    ai_service\.venv\Scripts\python.exe --version
) else (
    echo [WARN] Python venv not found - will be created on first run
)
echo.

echo [5] Checking Web3 dependencies...
if exist "web3_service\node_modules" (
    echo [PASS] Web3 dependencies installed
) else (
    echo [WARN] Web3 dependencies not found - will be installed on first run
)
echo.

echo [6] Checking Frontend dependencies...
if exist "web_frontend\node_modules" (
    echo [PASS] Frontend dependencies installed
) else (
    echo [WARN] Frontend dependencies not found - will be installed on first run
)
echo.

echo [7] Checking AI service files...
if exist "ai_service\main.py" (
    echo [PASS] AI service main.py found
) else (
    echo [FAIL] AI service main.py not found
)
echo.

echo [8] Checking Web3 service files...
if exist "web3_service\package.json" (
    echo [PASS] Web3 service package.json found
) else (
    echo [FAIL] Web3 service package.json not found
)
echo.

echo [9] Checking Frontend files...
if exist "web_frontend\package.json" (
    echo [PASS] Frontend package.json found
) else (
    echo [FAIL] Frontend package.json not found
)
echo.

echo ========================================
echo Environment check complete
echo ========================================
echo.
echo If you see any [FAIL] messages, please fix them before running start.bat
echo.
pause
