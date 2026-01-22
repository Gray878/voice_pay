@echo off
REM 数据库迁移管理脚本 (Windows)
REM Usage: migrate.bat [command] [options]

setlocal enabledelayedexpansion

REM 配置
if "%DB_HOST%"=="" set DB_HOST=localhost
if "%DB_PORT%"=="" set DB_PORT=5432
if "%DB_NAME%"=="" set DB_NAME=voice_to_pay
if "%DB_USER%"=="" set DB_USER=postgres
if "%DB_PASSWORD%"=="" set DB_PASSWORD=postgres

set MIGRATIONS_DIR=%~dp0migrations

REM 检查 psql 是否安装
where psql >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] psql 未安装，请先安装 PostgreSQL 客户端
    exit /b 1
)

REM 解析命令
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=help

if "%COMMAND%"=="up" goto migrate_up
if "%COMMAND%"=="status" goto migrate_status
if "%COMMAND%"=="create" goto migrate_create
if "%COMMAND%"=="help" goto show_help
if "%COMMAND%"=="--help" goto show_help
if "%COMMAND%"=="-h" goto show_help

echo [ERROR] 未知命令: %COMMAND%
goto show_help

:migrate_up
echo [INFO] 应用数据库迁移...
call :create_migrations_table

REM 获取当前版本
for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;" 2^>nul') do set CURRENT_VERSION=%%i
set CURRENT_VERSION=%CURRENT_VERSION: =%
if "%CURRENT_VERSION%"=="" set CURRENT_VERSION=0
echo [INFO] 当前数据库版本: %CURRENT_VERSION%

set APPLIED=0
for %%f in ("%MIGRATIONS_DIR%\*.sql") do (
    set FILENAME=%%~nxf
    for /f "tokens=1 delims=_" %%v in ("!FILENAME!") do set VERSION=%%v
    
    if !VERSION! gtr %CURRENT_VERSION% (
        echo [INFO] 应用迁移 !VERSION!: !FILENAME!
        set PGPASSWORD=%DB_PASSWORD%
        psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "%%f"
        set /a APPLIED+=1
    )
)

if %APPLIED%==0 (
    echo [INFO] 没有待执行的迁移
) else (
    echo [INFO] 成功应用 %APPLIED% 个迁移
)
goto :eof

:migrate_status
echo [INFO] 迁移状态:
call :create_migrations_table
set PGPASSWORD=%DB_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT version, description, applied_at FROM schema_migrations ORDER BY version;"

for /f "tokens=*" %%i in ('psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -t -c "SELECT COALESCE(MAX(version), 0) FROM schema_migrations;" 2^>nul') do set CURRENT_VERSION=%%i
set CURRENT_VERSION=%CURRENT_VERSION: =%
echo [INFO] 当前版本: %CURRENT_VERSION%
goto :eof

:migrate_create
set DESCRIPTION=%2
if "%DESCRIPTION%"=="" (
    echo [ERROR] 请提供迁移描述
    echo Usage: migrate.bat create ^<description^>
    exit /b 1
)

REM 获取下一个版本号
set NEXT_VERSION=1
for /f "tokens=*" %%f in ('dir /b /o:n "%MIGRATIONS_DIR%\*.sql" 2^>nul') do (
    set LAST_FILE=%%f
)
if defined LAST_FILE (
    for /f "tokens=1 delims=_" %%v in ("!LAST_FILE!") do set LAST_VERSION=%%v
    set /a NEXT_VERSION=!LAST_VERSION!+1
)

REM 格式化版本号（3位数字）
set VERSION_PADDED=00%NEXT_VERSION%
set VERSION_PADDED=%VERSION_PADDED:~-3%

set FILENAME=%VERSION_PADDED%_%DESCRIPTION%.sql
set FILEPATH=%MIGRATIONS_DIR%\%FILENAME%

REM 创建迁移文件模板
(
echo -- Migration: %VERSION_PADDED%_%DESCRIPTION%
echo -- Description: %DESCRIPTION%
echo -- Date: %DATE%
echo.
echo -- ==================== UP Migration ====================
echo.
echo -- 在此处添加迁移 SQL 语句
echo.
echo.
echo -- ==================== 更新迁移版本 ====================
echo.
echo INSERT INTO schema_migrations ^(version, description^) VALUES ^(%NEXT_VERSION%, '%DESCRIPTION%'^);
) > "%FILEPATH%"

echo [INFO] 创建迁移文件: %FILEPATH%
goto :eof

:create_migrations_table
set PGPASSWORD=%DB_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, description TEXT NOT NULL, applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP);" >nul 2>nul
goto :eof

:show_help
echo 数据库迁移管理脚本
echo.
echo Usage: migrate.bat [command] [options]
echo.
echo Commands:
echo     up          应用所有待执行的迁移
echo     status      显示迁移状态
echo     create      创建新的迁移文件
echo     help        显示帮助信息
echo.
echo Examples:
echo     migrate.bat up                          # 应用所有迁移
echo     migrate.bat status                      # 查看迁移状态
echo     migrate.bat create add_user_settings    # 创建新迁移
echo.
echo Environment Variables:
echo     DB_HOST      数据库主机 (默认: localhost)
echo     DB_PORT      数据库端口 (默认: 5432)
echo     DB_NAME      数据库名称 (默认: voice_to_pay)
echo     DB_USER      数据库用户 (默认: postgres)
echo     DB_PASSWORD  数据库密码 (默认: postgres)
goto :eof
