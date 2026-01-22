#!/bin/bash
# 数据库设置脚本

set -e

echo "=========================================="
echo "Voice-to-Pay 数据库设置"
echo "=========================================="

# 加载环境变量
if [ -f "../.env" ]; then
    export $(cat ../.env | grep -v '^#' | xargs)
else
    echo "警告: 未找到 .env 文件，使用默认配置"
    POSTGRES_HOST=${POSTGRES_HOST:-localhost}
    POSTGRES_PORT=${POSTGRES_PORT:-5432}
    POSTGRES_USER=${POSTGRES_USER:-postgres}
    POSTGRES_DB=${POSTGRES_DB:-voice_to_pay}
fi

echo "PostgreSQL 配置:"
echo "  主机: $POSTGRES_HOST"
echo "  端口: $POSTGRES_PORT"
echo "  用户: $POSTGRES_USER"
echo "  数据库: $POSTGRES_DB"

# 检查 PostgreSQL 是否运行
echo ""
echo "检查 PostgreSQL 连接..."
if ! command -v psql &> /dev/null; then
    echo "错误: 未找到 psql 命令"
    echo "请先安装 PostgreSQL 客户端"
    exit 1
fi

# 测试连接
if ! PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c '\q' 2>/dev/null; then
    echo "错误: 无法连接到 PostgreSQL"
    echo "请确保 PostgreSQL 正在运行，并且密码正确"
    exit 1
fi

echo "✓ PostgreSQL 连接成功"

# 创建数据库
echo ""
echo "创建数据库..."
cd "$(dirname "$0")/../database"

PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;" 2>/dev/null || echo "数据库已存在，跳过创建"

# 执行初始化脚本
echo ""
echo "执行数据库初始化脚本..."
PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB -f init.sql

echo ""
echo "=========================================="
echo "✓ 数据库设置完成！"
echo "=========================================="
echo ""
echo "数据库信息:"
echo "  数据库名: $POSTGRES_DB"
echo "  连接 URL: postgresql://$POSTGRES_USER:****@$POSTGRES_HOST:$POSTGRES_PORT/$POSTGRES_DB"
echo ""
echo "表结构:"
echo "  - users (用户表)"
echo "  - products (商品表)"
echo "  - transactions (交易记录表)"
echo ""
