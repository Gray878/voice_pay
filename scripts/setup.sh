#!/bin/bash

# Voice-to-Pay 环境设置脚本

echo "Setting up Voice-to-Pay development environment..."

# 检查 Python
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    exit 1
fi

# 设置 Python 环境
echo "Setting up Python environment..."
cd ai_service
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# 设置 Node.js 环境
echo "Setting up Node.js environment..."
cd web3_service
npm install
cd ..

# 复制环境变量模板
echo "Setting up environment variables..."
if [ ! -f ai_service/.env ]; then
    cp ai_service/.env.example ai_service/.env
    echo "Created ai_service/.env - Please update with your API keys"
fi

if [ ! -f web3_service/.env ]; then
    cp web3_service/.env.example web3_service/.env
    echo "Created web3_service/.env - Please update with your API keys"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env files with your API keys"
echo "2. Initialize database: psql -U postgres -f database/init.sql"
echo "3. Start services: ./scripts/start.sh"
