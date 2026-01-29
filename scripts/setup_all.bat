@echo off
REM 完整项目设置脚本 (Windows)

echo ==========================================
echo Voice-to-Pay 完整项目设置
echo ==========================================

set SCRIPT_DIR=%~dp0

REM 检查 .env 文件
echo.
echo 步骤 1/5: 检查环境变量配置...
if not exist "%SCRIPT_DIR%..\\.env" (
    echo 未找到 .env 文件，从模板创建...
    copy "%SCRIPT_DIR%..\\.env.example" "%SCRIPT_DIR%..\\.env"
    echo √ 已创建 .env 文件
    echo.
    echo ⚠️  重要: 请编辑 .env 文件，填入以下必需的配置:
    echo   - OPENAI_API_KEY
    echo   - POSTGRES_PASSWORD
    echo   - API_SECRET_KEY
    echo.
    pause
) else (
    echo √ 找到 .env 文件
)

REM 设置 Python 环境
echo.
echo 步骤 2/5: 设置 Python 环境...
call "%SCRIPT_DIR%setup_python_env.bat"

REM 设置 Node.js 环境
echo.
echo 步骤 3/5: 设置 Node.js 环境...
call "%SCRIPT_DIR%setup_nodejs_env.bat"

REM 设置数据库
echo.
echo 步骤 4/5: 设置数据库...
echo 注意: 此步骤需要 PostgreSQL 正在运行
set /p SETUP_DB="是否继续设置数据库? (y/n): "
if /i "%SETUP_DB%"=="y" (
    call "%SCRIPT_DIR%setup_database.bat"
) else (
    echo 跳过数据库设置
)

REM 检查 Redis
echo.
echo 步骤 5/5: 检查 Redis...
where redis-cli >nul 2>&1
if errorlevel 1 (
    echo ⚠️  未找到 Redis，请安装 Redis:
    echo   下载地址: https://github.com/microsoftarchive/redis/releases
) else (
    redis-cli ping >nul 2>&1
    if errorlevel 1 (
        echo ⚠️  Redis 未运行，请启动 Redis:
        echo   redis-server
    ) else (
        echo √ Redis 正在运行
    )
)

echo.
echo ==========================================
echo √ 项目设置完成！
echo ==========================================
echo.
echo 下一步:
echo.
echo 1. 确保已配置 .env 文件中的所有必需变量
echo.
echo 2. 启动 Redis (如果未运行):
echo    redis-server
echo.
echo 3. 启动 AI 服务:
echo    cd ai_service
echo    venv\Scripts\activate.bat
echo    python main.py
echo.
echo 4. 启动 Web3 服务:
echo    cd web3_service
echo    npm run dev
echo.
echo 5. 运行测试:
echo    cd ai_service ^&^& pytest
echo    cd web3_service ^&^& npm test
echo.
pause
