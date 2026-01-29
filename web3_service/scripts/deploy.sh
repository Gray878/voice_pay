#!/bin/bash

echo "========================================"
echo "OrderBook 合约自动部署脚本"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js"
    exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
    echo "[警告] 未找到 .env 文件，从 .env.example 复制..."
    cp .env.example .env
    echo "[提示] 请编辑 .env 文件，填入 PRIVATE_KEY 和 MUMBAI_RPC_URL"
    read -p "按回车继续..."
fi

# 安装依赖
if [ ! -d "node_modules" ]; then
    echo "[步骤 1/3] 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
else
    echo "[步骤 1/3] 依赖已安装，跳过"
fi

# 编译合约
echo ""
echo "[步骤 2/3] 编译合约..."
npx hardhat compile
if [ $? -ne 0 ]; then
    echo "[错误] 合约编译失败"
    exit 1
fi

# 部署合约
echo ""
echo "[步骤 3/3] 部署合约到 Mumbai 测试网..."
echo ""
npx hardhat run scripts/deploy.js --network mumbai
if [ $? -ne 0 ]; then
    echo "[错误] 合约部署失败"
    exit 1
fi

echo ""
echo "========================================"
echo "部署完成！"
echo "========================================"
echo "合约地址已保存到 deployments/mumbai.json"
echo ".env 文件已自动更新"
echo ""
