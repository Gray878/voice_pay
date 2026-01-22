@echo off
REM Voice-to-Pay 环境设置脚本 (Windows)

echo Setting up Voice-to-Pay development environment...

REM 检查 Python
python --version >NUL 2>&1
if errorlevel 1 (
    echo Error: Python is not installed
    exit /b 1
)

REM 检查 Node.js
node --version >NUL 2>&1
if errorlevel 1 (
    echo Error: Node.js is not installed
    exit /b 1
)

REM 设置 Python 环境
echo Setting up Python environment...
cd ai_service
python -m venv venv
call venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
cd ..

REM 设置 Node.js 环境
echo Setting up Node.js environment...
cd web3_service
call npm install
cd ..

REM 复制环境变量模板
echo Setting up environment variables...
if not exist ai_service\.env (
    copy ai_service\.env.example ai_service\.env
    echo Created ai_service\.env - Please update with your API keys
)

if not exist web3_service\.env (
    copy web3_service\.env.example web3_service\.env
    echo Created web3_service\.env - Please update with your API keys
)

echo.
echo Setup complete!
echo.
echo Next steps:
echo 1. Update .env files with your API keys
echo 2. Initialize database: psql -U postgres -f database\init.sql
echo 3. Start services: scripts\start.bat
pause
