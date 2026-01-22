@echo off
REM Python 虚拟环境设置脚本 (Windows)

echo ==========================================
echo Voice-to-Pay Python 环境设置
echo ==========================================

REM 检查 Python 版本
echo 检查 Python 版本...
python --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Python
    echo 请先安装 Python 3.10 或更高版本
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo 找到 Python 版本: %PYTHON_VERSION%

REM 进入 AI 服务目录
cd /d "%~dp0\..\ai_service"

REM 创建虚拟环境
echo.
echo 创建 Python 虚拟环境...
if exist venv (
    echo 虚拟环境已存在，跳过创建
) else (
    python -m venv venv
    echo √ 虚拟环境创建成功
)

REM 激活虚拟环境
echo.
echo 激活虚拟环境...
call venv\Scripts\activate.bat

REM 升级 pip
echo.
echo 升级 pip...
python -m pip install --upgrade pip

REM 安装依赖
echo.
echo 安装 Python 依赖...
pip install -r requirements.txt

echo.
echo ==========================================
echo √ Python 环境设置完成！
echo ==========================================
echo.
echo 使用以下命令激活虚拟环境:
echo   cd ai_service
echo   venv\Scripts\activate.bat
echo.
echo 运行测试:
echo   pytest
echo.
echo 启动 AI 服务:
echo   python main.py
echo.
pause
