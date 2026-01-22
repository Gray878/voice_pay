@echo off
REM 数据库设置脚本 (Windows)

echo ==========================================
echo Voice-to-Pay 数据库设置
echo ==========================================

REM 加载环境变量
if exist "..\\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("..\\.env") do (
        if not "%%a"=="" if not "%%a:~0,1%"=="#" set %%a=%%b
    )
) else (
    echo 警告: 未找到 .env 文件，使用默认配置
    if not defined POSTGRES_HOST set POSTGRES_HOST=localhost
    if not defined POSTGRES_PORT set POSTGRES_PORT=5432
    if not defined POSTGRES_USER set POSTGRES_USER=postgres
    if not defined POSTGRES_DB set POSTGRES_DB=voice_to_pay
)

echo PostgreSQL 配置:
echo   主机: %POSTGRES_HOST%
echo   端口: %POSTGRES_PORT%
echo   用户: %POSTGRES_USER%
echo   数据库: %POSTGRES_DB%

REM 检查 PostgreSQL 是否安装
echo.
echo 检查 PostgreSQL 连接...
where psql >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 psql 命令
    echo 请先安装 PostgreSQL 客户端
    pause
    exit /b 1
)

REM 测试连接
set PGPASSWORD=%POSTGRES_PASSWORD%
psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d postgres -c "\q" >nul 2>&1
if errorlevel 1 (
    echo 错误: 无法连接到 PostgreSQL
    echo 请确保 PostgreSQL 正在运行，并且密码正确
    pause
    exit /b 1
)

echo √ PostgreSQL 连接成功

REM 创建数据库
echo.
echo 创建数据库...
cd /d "%~dp0\..\database"

psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d postgres -c "CREATE DATABASE %POSTGRES_DB%;" 2>nul || echo 数据库已存在，跳过创建

REM 执行初始化脚本
echo.
echo 执行数据库初始化脚本...
psql -h %POSTGRES_HOST% -p %POSTGRES_PORT% -U %POSTGRES_USER% -d %POSTGRES_DB% -f init.sql

echo.
echo ==========================================
echo √ 数据库设置完成！
echo ==========================================
echo.
echo 数据库信息:
echo   数据库名: %POSTGRES_DB%
echo   连接 URL: postgresql://%POSTGRES_USER%:****@%POSTGRES_HOST%:%POSTGRES_PORT%/%POSTGRES_DB%
echo.
echo 表结构:
echo   - users (用户表)
echo   - products (商品表)
echo   - transactions (交易记录表)
echo.
pause
