#!/bin/bash

# 验证脚本 - 检查项目基础设施是否正确设置

echo "=== Voice-to-Pay 基础设施验证 ==="
echo ""

# 检查 Python
echo "检查 Python..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ $PYTHON_VERSION"
else
    echo "✗ Python 3 未安装"
    exit 1
fi

# 检查 Node.js
echo "检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js $NODE_VERSION"
else
    echo "✗ Node.js 未安装"
    exit 1
fi

# 检查 PostgreSQL
echo "检查 PostgreSQL..."
if command -v psql &> /dev/null; then
    POSTGRES_VERSION=$(psql --version)
    echo "✓ $POSTGRES_VERSION"
else
    echo "✗ PostgreSQL 未安装"
fi

# 检查 Redis
echo "检查 Redis..."
if command -v redis-cli &> /dev/null; then
    REDIS_VERSION=$(redis-cli --version)
    echo "✓ $REDIS_VERSION"
else
    echo "✗ Redis 未安装"
fi

# 检查项目结构
echo ""
echo "检查项目结构..."
REQUIRED_DIRS=(
    "ai_service"
    "web3_service"
    "database"
    "shared"
    "scripts"
)

for dir in "${REQUIRED_DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "✓ $dir/"
    else
        echo "✗ $dir/ 不存在"
    fi
done

# 检查配置文件
echo ""
echo "检查配置文件..."
if [ -f "ai_service/.env" ]; then
    echo "✓ ai_service/.env"
else
    echo "⚠ ai_service/.env 不存在（请从 .env.example 复制）"
fi

if [ -f "web3_service/.env" ]; then
    echo "✓ web3_service/.env"
else
    echo "⚠ web3_service/.env 不存在（请从 .env.example 复制）"
fi

echo ""
echo "=== 验证完成 ==="
