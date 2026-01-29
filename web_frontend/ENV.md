# Web Frontend .env 配置说明

## 文件位置

- web_frontend/.env（当前未使用）
- web_frontend/.env.example（当前未提供）

## 加载方式

前端工程未在代码中读取环境变量。开发代理地址直接在 [vite.config.ts](file:///e:/code/Hackathon/voice_to_pay/voice_to_pay/web_frontend/vite.config.ts#L1-L21) 中配置。

## 最小可运行配置

- 无需 .env

## 配置项

### 代理

- /api/ai：目标地址在 vite.config.ts 的 proxy 中配置
- /api/web3：目标地址在 vite.config.ts 的 proxy 中配置

### 说明

- 如需引入 .env，可按 Vite 约定使用 VITE_ 前缀并在代码中读取
