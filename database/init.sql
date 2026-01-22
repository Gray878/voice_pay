-- Voice-to-Pay 数据库初始化脚本
-- PostgreSQL 14+

-- 创建数据库
CREATE DATABASE voice_to_pay;

-- 连接到数据库
\c voice_to_pay;

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==================== 用户表 ====================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_addresses TEXT[] NOT NULL,
    preferred_wallet TEXT,
    preferred_chain TEXT,
    transaction_history TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 用户表索引
CREATE INDEX idx_users_wallet_addresses ON users USING GIN(wallet_addresses);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ==================== 商品表 ====================

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('NFT', 'Token')),
    price NUMERIC(20, 8) NOT NULL,
    currency TEXT NOT NULL,
    chain TEXT NOT NULL,
    contract_address TEXT NOT NULL,
    token_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 商品表索引
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_chain ON products(chain);
CREATE INDEX idx_products_price ON products(price);
CREATE INDEX idx_products_contract_address ON products(contract_address);
CREATE INDEX idx_products_created_at ON products(created_at);

-- ==================== 交易记录表 ====================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    tx_hash TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
    chain TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    value NUMERIC(20, 8) NOT NULL,
    gas_fee NUMERIC(20, 8) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 交易记录表索引
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_session_id ON transactions(session_id);
CREATE INDEX idx_transactions_product_id ON transactions(product_id);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_chain ON transactions(chain);
CREATE INDEX idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX idx_transactions_confirmed_at ON transactions(confirmed_at DESC);

-- ==================== 触发器：自动更新 updated_at ====================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==================== 测试数据 (可选) ====================

-- 插入测试用户
INSERT INTO users (wallet_addresses, preferred_wallet, preferred_chain) VALUES
    (ARRAY['0x1234567890123456789012345678901234567890'], '0x1234567890123456789012345678901234567890', 'polygon');

-- 插入测试商品
INSERT INTO products (name, description, category, price, currency, chain, contract_address, metadata) VALUES
    ('元宇宙音乐派对门票 NFT', '进入虚拟音乐派对的专属门票，包含 VIP 权限', 'NFT', 0.5, 'MATIC', 'polygon', '0xabcdef1234567890abcdef1234567890abcdef12', '{"image": "https://example.com/nft1.png", "attributes": {"type": "VIP", "event": "Music Party"}}'),
    ('游戏内货币 Token', '用于游戏内购买道具和装备的代币', 'Token', 10.0, 'MATIC', 'polygon', '0x1234567890abcdef1234567890abcdef12345678', '{"symbol": "GAME", "decimals": 18}');

-- 完成
SELECT 'Database initialized successfully!' AS status;
