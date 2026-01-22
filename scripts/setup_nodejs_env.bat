@echo off
REM Node.js 环境设置脚本 (Windows)

echo ==========================================
echo Voice-to-Pay Node.js 环境设置
echo ==========================================

REM 检查 Node.js 版本
echo 检查 Node.js 版本...
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Node.js
    echo 请先安装 Node.js 18 或更高版本
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo 找到 Node.js 版本: %NODE_VERSION%

REM 检查 npm 版本
echo 检查 npm 版本...
npm --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 npm
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('npm --version') do set NPM_VERSION=%%i
echo 找到 npm 版本: %NPM_VERSION%

REM 进入 Web3 服务目录
cd /d "%~dp0\..\web3_service"

REM 安装依赖
echo.
echo 安装 Node.js 依赖...
call npm install

REM 编译 TypeScript
echo.
echo 编译 TypeScript...
call npm run build

echo.
echo ==========================================
echo √ Node.js 环境设置完成！
echo ==========================================
echo.
echo 运行测试:
echo   cd web3_service
echo   npm test
echo.
echo 启动 Web3 服务 (开发模式):
echo   npm run dev
echo.
echo 启动 Web3 服务 (生产模式):
echo   npm start
echo.
pause
