#!/bin/bash
# 完整项目设置脚本

set -e

echo "=========================================="
echo "Voice-to-Pay 完整项目设置"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 检查 .env 文件
echo ""
echo "步骤 1/5: 检查环境变量配置..."
if [ ! -f "$SCRIPT_DIR/../.env" ]; then
    echo "未找到 .env 文件，从模板创建..."
    cp "$SCRIPT_DIR/../.env.example" "$SCRIPT_DIR/../.env"
    echo "✓ 已创建 .env 文件"
    echo ""
    echo "⚠️  重要: 请编辑 .env 文件，填入以下必需的配置:"
    echo "  - OPENAI_API_KEY"
    echo "  - PINECONE_API_KEY"
    echo "  - POSTGRES_PASSWORD"
    echo "  - API_SECRET_KEY"
    echo ""
    read -p "按 Enter 继续（确保已配置 .env 文件）..."
else
    echo "✓ 找到 .env 文件"
fi

# 设置 Python 环境
echo ""
echo "步骤 2/5: 设置 Python 环境..."
bash "$SCRIPT_DIR/setup_python_env.sh"

# 设置 Node.js 环境
echo ""
echo "步骤 3/5: 设置 Node.js 环境..."
bash "$SCRIPT_DIR/setup_nodejs_env.sh"

# 设置数据库
echo ""
echo "步骤 4/5: 设置数据库..."
echo "注意: 此步骤需要 PostgreSQL 正在运行"
read -p "是否继续设置数据库? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    bash "$SCRIPT_DIR/setup_database.sh"
else
    echo "跳过数据库设置"
fi

# 检查 Redis
echo ""
echo "步骤 5/5: 检查 Redis..."
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        echo "✓ Redis 正在运行"
    else
        echo "⚠️  Redis 未运行，请启动 Redis:"
        echo "  Linux/Mac: redis-server"
        echo "  或使用配置文件: redis-server database/redis.conf"
    fi
else
    echo "⚠️  未找到 Redis，请安装 Redis:"
    echo "  Ubuntu/Debian: sudo apt-get install redis-server"
    echo "  Mac: brew install redis"
fi

echo ""
echo "=========================================="
echo "✓ 项目设置完成！"
echo "=========================================="
echo ""
echo "下一步:"
echo ""
echo "1. 确保已配置 .env 文件中的所有必需变量"
echo ""
echo "2. 启动 Redis (如果未运行):"
echo "   redis-server"
echo ""
echo "3. 启动 AI 服务:"
echo "   cd ai_service"
echo "   source venv/bin/activate"
echo "   python main.py"
echo ""
echo "4. 启动 Web3 服务:"
echo "   cd web3_service"
echo "   npm run dev"
echo ""
echo "5. 运行测试:"
echo "   cd ai_service && pytest"
echo "   cd web3_service && npm test"
echo ""
