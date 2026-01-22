#!/bin/bash
# Node.js 环境设置脚本

set -e

echo "=========================================="
echo "Voice-to-Pay Node.js 环境设置"
echo "=========================================="

# 检查 Node.js 版本
echo "检查 Node.js 版本..."
if ! command -v node &> /dev/null; then
    echo "错误: 未找到 Node.js"
    echo "请先安装 Node.js 18 或更高版本"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "找到 Node.js 版本: $NODE_VERSION"

# 检查 npm 版本
echo "检查 npm 版本..."
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "找到 npm 版本: $NPM_VERSION"

# 进入 Web3 服务目录
cd "$(dirname "$0")/../web3_service"

# 安装依赖
echo ""
echo "安装 Node.js 依赖..."
npm install

# 编译 TypeScript
echo ""
echo "编译 TypeScript..."
npm run build

echo ""
echo "=========================================="
echo "✓ Node.js 环境设置完成！"
echo "=========================================="
echo ""
echo "运行测试:"
echo "  cd web3_service"
echo "  npm test"
echo ""
echo "启动 Web3 服务 (开发模式):"
echo "  npm run dev"
echo ""
echo "启动 Web3 服务 (生产模式):"
echo "  npm start"
echo ""
