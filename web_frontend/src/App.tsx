import { useState } from 'react';
import VoiceButton from './components/VoiceButton';
import ProductList from './components/ProductList';
import TransactionStatus from './components/TransactionStatus';
import WalletConnect from './components/WalletConnect';
import { Product, TransactionState } from './types';
import './App.css';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [transactionState, setTransactionState] = useState<TransactionState>({
    status: 'idle',
    message: ''
  });
  const [isListening] = useState(false);

  // 处理钱包连接
  const handleWalletConnect = async (address: string) => {
    setIsConnected(true);
    setWalletAddress(address);
    setTransactionState({
      status: 'success',
      message: `钱包已连接: ${address.slice(0, 6)}...${address.slice(-4)}`
    });
  };

  // 处理语音输入
  const handleVoiceInput = async (transcript: string) => {
    setTransactionState({
      status: 'processing',
      message: '正在处理您的请求...'
    });

    try {
      // 调用 AI 服务进行语义解析
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript })
      });

      const data = await response.json();

      if (data.success && data.intent === 'search_product') {
        // 搜索商品
        await searchProducts(data.entities);
      }
    } catch (error: any) {
      setTransactionState({
        status: 'error',
        message: `处理失败: ${error.message}`
      });
    }
  };

  // 搜索商品
  const searchProducts = async (query: any) => {
    try {
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      const data = await response.json();

      if (data.success && data.products) {
        setProducts(data.products);
        setTransactionState({
          status: 'success',
          message: `找到 ${data.products.length} 个商品`
        });
      }
    } catch (error: any) {
      setTransactionState({
        status: 'error',
        message: `搜索失败: ${error.message}`
      });
    }
  };

  // 处理商品选择
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setTransactionState({
      status: 'confirmation',
      message: `您选择了 ${product.name}，价格 ${product.price}`
    });
  };

  // 确认支付
  const handleConfirmPayment = async () => {
    if (!selectedProduct || !isConnected) return;

    setTransactionState({
      status: 'processing',
      message: '正在发送交易...'
    });

    try {
      // 调用 Web3 服务发送交易
      const response = await fetch('/api/web3/payment/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: selectedProduct,
          userAddress: walletAddress
        })
      });

      const data = await response.json();

      if (data.success) {
        setTransactionState({
          status: 'pending',
          message: '交易已发送，等待确认...',
          txHash: data.txHash
        });

        // 监听交易状态
        pollTransactionStatus(data.txHash);
      }
    } catch (error: any) {
      setTransactionState({
        status: 'error',
        message: `交易失败: ${error.message}`
      });
    }
  };

  // 轮询交易状态
  const pollTransactionStatus = async (txHash: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/web3/transaction/status/${txHash}`);
        const data = await response.json();

        if (data.success) {
          if (data.data.status === 'confirmed') {
            clearInterval(interval);
            setTransactionState({
              status: 'success',
              message: '支付成功！',
              txHash
            });
          } else if (data.data.status === 'failed') {
            clearInterval(interval);
            setTransactionState({
              status: 'error',
              message: '交易失败',
              txHash
            });
          }
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 3000);

    // 5 分钟后停止轮询
    setTimeout(() => clearInterval(interval), 300000);
  };

  return (
    <div className="app">
      {/* 顶部导航栏 */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo">
            <svg className="logo-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
            <span className="logo-text">Voice-to-Pay</span>
          </div>
          <WalletConnect
            isConnected={isConnected}
            address={walletAddress}
            onConnect={handleWalletConnect}
          />
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            用<span className="highlight">语音</span>支付
            <br />
            让 Web3 更简单
          </h1>
          <p className="hero-subtitle">
            结合 AI 语音识别和区块链技术，只需说话即可完成支付
          </p>
          
          {/* 语音输入按钮 */}
          <div className="hero-action">
            <VoiceButton
              isListening={isListening}
              onVoiceInput={handleVoiceInput}
              disabled={!isConnected}
            />
            {!isConnected && (
              <p className="hint-text">请先连接钱包以开始使用</p>
            )}
          </div>
        </div>

        {/* 装饰性背景 */}
        <div className="hero-bg">
          <div className="glow-orb glow-orb-1"></div>
          <div className="glow-orb glow-orb-2"></div>
          <div className="grid-pattern"></div>
        </div>
      </section>

      {/* 主内容区域 */}
      <main className="main-content">
        {/* 交易状态 */}
        {transactionState.status !== 'idle' && (
          <TransactionStatus state={transactionState} />
        )}

        {/* 商品列表 */}
        {products.length > 0 && (
          <section className="products-section">
            <ProductList
              products={products}
              selectedProduct={selectedProduct}
              onSelect={handleProductSelect}
            />
          </section>
        )}

        {/* 确认支付面板 */}
        {selectedProduct && (
          <section className="payment-panel">
            <div className="payment-card">
              <h3 className="payment-title">确认支付</h3>
              <div className="payment-details">
                <div className="detail-row">
                  <span className="detail-label">商品</span>
                  <span className="detail-value">{selectedProduct.name}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">价格</span>
                  <span className="detail-value highlight">{selectedProduct.price}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">链</span>
                  <span className="detail-value">{selectedProduct.chain}</span>
                </div>
              </div>
              <div className="payment-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleConfirmPayment}
                  disabled={transactionState.status === 'processing'}
                >
                  {transactionState.status === 'processing' ? '处理中...' : '确认支付'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSelectedProduct(null)}
                >
                  取消
                </button>
              </div>
            </div>
          </section>
        )}

        {/* 空状态 */}
        {!isConnected && products.length === 0 && (
          <section className="empty-state">
            <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <h3>开始您的语音支付之旅</h3>
            <p>连接钱包后，点击麦克风说出您想购买的商品</p>
          </section>
        )}
      </main>

      {/* 页脚 */}
      <footer className="footer">
        <div className="footer-content">
          <p className="footer-text">Powered by Web3 & AI Technology</p>
          <div className="footer-links">
            <a href="#" className="footer-link">文档</a>
            <a href="#" className="footer-link">GitHub</a>
            <a href="#" className="footer-link">支持</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
