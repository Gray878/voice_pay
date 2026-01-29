# AI Service .env 配置说明

## 文件位置

- ai_service/.env
- ai_service/.env.example

## 加载方式

通过 [config.py](file:///e:/code/Hackathon/voice_to_pay/voice_to_pay/ai_service/config.py#L12-L99) 使用 pydantic settings 从 .env 加载。

## 最小可运行配置

- LLM_PROVIDER=openai 并配置 OPENAI_API_KEY
- 或 LLM_PROVIDER=zhipu 并配置 ZHIPU_API_KEY
- POSTGRES_PASSWORD

## 配置项

### LLM

- LLM_PROVIDER：openai 或 zhipu，默认 openai
- OPENAI_API_KEY：OpenAI API Key，使用 openai 时必填
- OPENAI_MODEL：OpenAI 模型，默认 gpt-4
- OPENAI_EMBEDDING_MODEL：OpenAI embedding 模型，默认 text-embedding-3-large
- ZHIPU_API_KEY：智谱 API Key，使用 zhipu 时必填
- ZHIPU_MODEL：智谱模型，默认 glm-4
- ZHIPU_EMBEDDING_MODEL：智谱 embedding 模型，默认 embedding-2

### Whisper

- WHISPER_MODEL：Whisper 模型，默认 whisper-large-v3
- WHISPER_DEVICE：运行设备，默认 cpu

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

### 服务

- AI_SERVICE_HOST：默认 localhost
- AI_SERVICE_PORT：默认 8000
- WEB3_SERVICE_URL：Web3 服务地址，默认 http://localhost:3001
- DEBUG：默认 false

### 会话

- SESSION_TTL：会话超时秒数，默认 600

### 音频

- AUDIO_SAMPLE_RATE：默认 16000
- SILENCE_THRESHOLD：默认 2.0

### 知识库

- SEARCH_TOP_K：默认 5

### 匹配

- MATCH_MIN_SCORE：默认 0.3
- MATCH_TOP_K：默认 5
- CANDIDATE_LIMIT：默认 20

### 日志

- LOG_LEVEL：默认 info
