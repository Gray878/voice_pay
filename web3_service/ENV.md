# Web3 Service .env 配置说明

## 文件位置

- web3_service/.env
- web3_service/.env.example

## 加载方式

通过 [config.ts](file:///e:/code/Hackathon/voice_to_pay/voice_to_pay/web3_service/src/config.ts#L1-L155) 使用 dotenv 加载，**实际加载路径为 `web3_service/.env`**（代码中为 `path.resolve(__dirname, '../.env')`）。索引器相关配置由 [indexer-config.ts](file:///e:/code/Hackathon/voice_to_pay/voice_to_pay/web3_service/src/config/indexer-config.ts#L7-L40) 直接读取 process.env。

## 最小可运行配置

- 索引器必填：EVM_RPC_URL 或 EVM_RPC_ENDPOINTS、EVM_CHAIN_ID、ORDERBOOK_ADDRESS、USDOL_ADDRESS
- 数据库：POSTGRES_PASSWORD
- 安全：API_SECRET_KEY

## 配置项

### 环境与服务

- NODE_ENV：默认 development
- ENVIRONMENT：testnet 或 mainnet，默认 testnet
- WEB3_SERVICE_HOST：默认 localhost
- WEB3_SERVICE_PORT：默认 3000

### 链与钱包

- POLYGON_MUMBAI_RPC_URL：默认 https://rpc-mumbai.maticvigil.com
- POLYGON_MUMBAI_CHAIN_ID：默认 80001
- WEB3_SERVICE_PRIVATE_KEY：后端签名私钥，可选

### Alchemy

- ALCHEMY_API_KEY：可选
- ALCHEMY_POLYGON_MUMBAI_RPC：可选

### 区块链浏览器

- ETHERSCAN_API_KEY：可选
- POLYGONSCAN_API_KEY：可选

### 数据库

- POSTGRES_HOST：默认 localhost
- POSTGRES_PORT：默认 5432
- POSTGRES_DB：默认 voice_to_pay
- POSTGRES_USER：默认 postgres
- POSTGRES_PASSWORD：必填

### Redis

- REDIS_HOST：默认 localhost
- REDIS_PORT：默认 6379
- REDIS_DB：默认 0
- REDIS_PASSWORD：可选

### 会话与安全

- SESSION_TTL：默认 600
- API_SECRET_KEY：必填
- CORS_ORIGIN：默认 http://localhost:3000

### 日志与 Gas

- LOG_LEVEL：默认 info
- GAS_LIMIT_MULTIPLIER：默认 1.2

### 订单簿索引器

- EVM_RPC_URL：RPC 地址，必填（或提供 EVM_RPC_ENDPOINTS）
- EVM_RPC_ENDPOINTS：RPC 列表（逗号或空格分隔）
- EVM_CHAIN_ID：链 ID，必填
- ORDERBOOK_ADDRESS：订单簿合约地址，必填
- USDOL_ADDRESS：USDOL 合约地址，必填
- INDEX_PATH：索引文件路径，默认 ./data/index.json
- INDEX_FROM_BLOCK：起始区块高度，默认 0
- COLLECTION_ALLOWLIST：可选，集合白名单
- SYNC_INTERVAL：同步间隔毫秒，默认 30000
- INDEXER_BATCH_SIZE：每次同步区块数，默认 500
- WHIMLAND_PRIVATE_KEY：撮合/成交私钥，可选
- MAX_QTY：单次下单数量上限，默认 5

具体.env文档如下：
```txt
NODE_ENV=development
ENVIRONMENT=testnet
WEB3_SERVICE_HOST=localhost
WEB3_SERVICE_PORT=3001

# Polygon Mumbai Testnet
POLYGON_MUMBAI_RPC_URL=https://rpc-amoy.polygon.technology
POLYGON_MUMBAI_CHAIN_ID=80002
WEB3_SERVICE_PRIVATE_KEY=ca0b7a58a75f2bc96f59b0d327f87f48d989c9ce231487574df85b6a888984e1

# Alchemy
ALCHEMY_API_KEY=your-alchemy-api-key-here
ALCHEMY_POLYGON_MUMBAI_RPC=https://polygon-mumbai.g.alchemy.com/v2/YOUR-API-KEY

# Etherscan
ETHERSCAN_API_KEY=your-etherscan-api-key-here
POLYGONSCAN_API_KEY=DQS7F6S3ABUCDVT1MKTPH772R6U53BAVDM
EVM_RPC_URL=https://polygon-bor-rpc.publicnode.com
EVM_RPC_ENDPOINTS=https://polygon-bor-rpc.publicnode.com,https://polygon-rpc.com,https://polygon.blockpi.network/v1/rpc/public
EVM_CHAIN_ID=137
ORDERBOOK_ADDRESS=0x0000000000000000000000000000000000000000
USDOL_ADDRESS=0x0000000000000000000000000000000000000000
INDEX_PATH=./data/index.json
INDEX_FROM_BLOCK=0
COLLECTION_ALLOWLIST=
SYNC_INTERVAL=30000
INDEXER_BATCH_SIZE=500
WHIMLAND_PRIVATE_KEY=
MAX_QTY=5

# Redis (用于会话管理)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Session
SESSION_TTL=600

# Security
API_SECRET_KEY=your-secret-key-here
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info

# Gas
GAS_LIMIT_MULTIPLIER=1.2
```

## 常见问题

### 订单簿初始化报错 "History has been pruned for this block"

说明当前 RPC 是**裁剪节点**，不保留远古区块。代码已做兼容：未设置 `INDEX_FROM_BLOCK` 时，会从「当前区块 - 50000」开始扫描，避免请求区块 1。若需从合约部署区块开始完整同步，请在 .env 中设置 `INDEX_FROM_BLOCK=合约部署区块号`，并确保使用支持完整历史的 RPC。

### 启动报错 "EADDRINUSE: address already in use :::3001"

说明 **3001 端口已被占用**（多为上次未关闭的 Web3 服务或其它程序）。处理方式二选一：

1. **关闭占用端口的进程**（Windows PowerShell）：
   ```powershell
   netstat -ano | findstr :3001
   taskkill /PID <显示的 PID> /F
   ```
2. **改用其它端口**：在 `web3_service/.env` 中设置 `WEB3_SERVICE_PORT=3002`（或其它未占用端口），并确保前端/网关中访问的 Web3 服务地址与端口一致。
