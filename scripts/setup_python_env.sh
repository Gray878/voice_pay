#!/bin/bash
# Python 虚拟环境设置脚本

set -e

echo "=========================================="
echo "Voice-to-Pay Python 环境设置"
echo "=========================================="

# 检查 Python 版本
echo "检查 Python 版本..."
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 Python 3"
    echo "请先安装 Python 3.10 或更高版本"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "找到 Python 版本: $PYTHON_VERSION"

# 进入 AI 服务目录
cd "$(dirname "$0")/../ai_service"

# 创建虚拟环境
echo ""
echo "创建 Python 虚拟环境..."
if [ -d "venv" ]; then
    echo "虚拟环境已存在，跳过创建"
else
    python3 -m venv venv
    echo "✓ 虚拟环境创建成功"
fi

# 激活虚拟环境
echo ""
echo "激活虚拟环境..."
source venv/bin/activate

# 升级 pip
echo ""
echo "升级 pip..."
pip install --upgrade pip

# 安装依赖
echo ""
echo "安装 Python 依赖..."
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "✓ Python 环境设置完成！"
echo "=========================================="
echo ""
echo "使用以下命令激活虚拟环境:"
echo "  cd ai_service"
echo "  source venv/bin/activate"
echo ""
echo "运行测试:"
echo "  pytest"
echo ""
echo "启动 AI 服务:"
echo "  python main.py"
echo ""
