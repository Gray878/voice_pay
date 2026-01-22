@echo off
echo ========================================
echo Voice-to-Pay 环境验证
echo ========================================
echo.

set ERROR_COUNT=0

REM 检查 Python
echo [1/8] 检查 Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Python 未安装
    set /a ERROR_COUNT+=1
) else (
    python --version
    echo [√] Python 已安装
)
echo.

REM 检查 Node.js
echo [2/8] 检查 Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Node.js 未安装
    set /a ERROR_COUNT+=1
) else (
    node --version
    echo [√] Node.js 已安装
)
echo.

REM 检查 npm
echo [3/8] 检查 npm...
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] npm 未安装
    set /a ERROR_COUNT+=1
) else (
    npm --version
    echo [√] npm 已安装
)
echo.

REM 检查 Python 虚拟环境
echo [4/8] 检查 Python 虚拟环境...
if exist "ai_service\.venv" (
    echo [√] Python 虚拟环境已创建
) else (
    echo [X] Python 虚拟环境未创建
    echo     请运行: cd ai_service ^&^& python -m venv .venv
    set /a ERROR_COUNT+=1
)
echo.

REM 检查 AI 服务依赖
echo [5/8] 检查 AI 服务依赖...
if exist "ai_service\.venv\Lib\site-packages\fastapi" (
    echo [√] AI 服务依赖已安装
) else (
    echo [X] AI 服务依赖未安装
    echo     请运行: cd ai_service ^&^& .venv\Scripts\activate ^&^& pip install -r requirements.txt
    set /a ERROR_COUNT+=1
)
echo.

REM 检查 Web3 服务依赖
echo [6/8] 检查 Web3 服务依赖...
if exist "web3_service\node_modules" (
    echo [√] Web3 服务依赖已安装
) else (
    echo [X] Web3 服务依赖未安装
    echo     请运行: cd web3_service ^&^& npm install
    set /a ERROR_COUNT+=1
)
echo.

REM 检查环境变量文件
echo [7/8] 检查环境变量文件...
if exist "ai_service\.env" (
    echo [√] AI 服务 .env 文件存在
) else (
    echo [!] AI 服务 .env 文件不存在
    echo     请复制 .env.example 并配置
)

if exist "web3_service\.env" (
    echo [√] Web3 服务 .env 文件存在
) else (
    echo [!] Web3 服务 .env 文件不存在
    echo     请复制 .env.example 并配置
)
echo.

REM 检查 TypeScript 编译
echo [8/8] 检查 TypeScript 编译...
cd web3_service
call npm run build >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] TypeScript 编译失败
    set /a ERROR_COUNT+=1
) else (
    echo [√] TypeScript 编译成功
)
cd ..
echo.

REM 总结
echo ========================================
echo 验证总结
echo ========================================
if %ERROR_COUNT% equ 0 (
    echo [√] 所有检查通过！环境配置正确。
    echo.
    echo 可以运行以下命令启动服务:
    echo   start_all_services.bat
) else (
    echo [X] 发现 %ERROR_COUNT% 个问题，请修复后再启动服务。
)
echo.
pause
