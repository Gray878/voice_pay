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
  const [sessionId, setSessionId] = useState<string>('');
  const [discoveryFilters, setDiscoveryFilters] = useState<string[]>([]);
  const [listAllMode, setListAllMode] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [transactionState, setTransactionState] = useState<TransactionState>({
    status: 'idle',
    message: ''
  });
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
    console.info('Voice input transcript:', transcript);

    try {
      // 调用 AI 服务进行语义解析
      const response = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, session_id: sessionId || undefined })
      });

      const data = await parseJsonResponse(response);
      console.info('Parse response:', data);
      if (!response.ok) {
        throw new Error(data?.message || '语义解析服务不可用');
      }

      // 处理不同意图
      if (data.success) {
        if (data.session_id && data.session_id !== sessionId) {
          setSessionId(data.session_id);
        }
        const { intent, entities, missing_info, action, discovery_filters, text_response, default_query } = data;

        if (intent === 'purchase') {
          const selectionCandidates = filteredProducts.length > 0 ? filteredProducts : products;
          const resolvedProduct = resolveProductSelection(entities, transcript, selectionCandidates);
          if (resolvedProduct) {
            setSelectedProduct(resolvedProduct);
            setTransactionState({
              status: 'confirmation',
              message: `已选择 ${resolvedProduct.name}，价格 ${resolvedProduct.price}`
            });
            return;
          }
          setDiscoveryFilters([]);
          if (selectionCandidates.length === 0) {
            setTransactionState({
              status: 'success',
              message: '请先搜索商品'
            });
          } else {
            setTransactionState({
              status: 'success',
              message: '没有找到对应序号的商品'
            });
          }
          return;
        }

        if (intent === 'search_product' || intent === 'query') {
          if (action === 'show_discovery') {
            const filters = Array.isArray(discovery_filters) ? discovery_filters : [];
            setDiscoveryFilters(filters);
            setTransactionState({
              status: 'success',
              message: text_response || '先给你推荐一些热门商品'
            });
            const query = default_query || '热门';
            await searchProducts(query, undefined, data.session_id || sessionId);
            return;
          }
          // 如果有缺失信息，提示用户
          if (missing_info && missing_info.length > 0) {
            setDiscoveryFilters([]);
            setTransactionState({
              status: 'success',
              message: `请补充信息: ${missing_info.join(', ')}`
            });
            console.info('Missing info:', missing_info);
            return;
          }
          
          const queryText = buildSearchQuery(entities, transcript);
          if (!queryText) {
            setDiscoveryFilters([]);
            setTransactionState({
              status: 'success',
              message: '请告诉我想找的商品或关键词'
            });
            console.info('Empty search query, fallback to user prompt');
            return;
          }

          // 搜索商品
          setDiscoveryFilters([]);
          console.info('Search query:', queryText);
          const listAll =
            Boolean(entities?.list_all_products) ||
            isListAllQuery(transcript) ||
            isListAllQuery(queryText);
          await searchProducts(queryText, { listAll }, data.session_id || sessionId);
        } else if (intent === 'help') {
           setDiscoveryFilters([]);
           setTransactionState({
              status: 'success',
              message: '您可以说"我想买个 Azuki"或"查看我的订单"'
            });
            console.info('Help intent triggered');
        } else {
           setDiscoveryFilters([]);
           setTransactionState({
              status: 'success',
              message: `未识别的指令: ${intent}`
            });
            console.info('Unhandled intent:', intent);
        }
      }
    } catch (error: any) {
      console.error('Voice input failed:', error);
      setTransactionState({
        status: 'error',
        message: `处理失败: ${error.message}`
      });
    }
  };

  const resolveProductSelection = (entities: any, text: string, candidates: Product[]) => {
    if (!candidates || candidates.length === 0) {
      return null;
    }

    if (entities?.product_id) {
      const matched = candidates.find((item) => item.id === entities.product_id);
      if (matched) {
        return matched;
      }
    }

    const textLower = text.toLowerCase();
    const ordinalMap: Array<[string, number]> = [
      ['第一个', 0], ['第1个', 0], ['1', 0], ['first', 0],
      ['第二个', 1], ['第2个', 1], ['2', 1], ['second', 1],
      ['第三个', 2], ['第3个', 2], ['3', 2], ['third', 2],
      ['第四个', 3], ['第4个', 3], ['4', 3], ['fourth', 3],
      ['第五个', 4], ['第5个', 4], ['5', 4], ['fifth', 4]
    ];

    for (const [keyword, index] of ordinalMap) {
      if (textLower.includes(keyword)) {
        return candidates[index] || null;
      }
    }

    const demonstratives = ['这个', '那个', 'this', 'that', '它'];
    if (demonstratives.some((keyword) => textLower.includes(keyword))) {
      return candidates[candidates.length - 1] || null;
    }

    return null;
  };

  const buildSearchQuery = (entities: any, fallbackText: string) => {
    if (!entities || typeof entities !== 'object') {
      return fallbackText;
    }
    const parts = [
      entities.product_name,
      entities.product_type,
      entities.category,
      entities.use_case,
      entities.collection
    ].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' ');
    }
    return fallbackText;
  };

  const isListAllQuery = (text: string) => {
    if (!text) {
      return false;
    }
    const lowerText = text.toLowerCase();
    const keywords = [
      '列出所有商品',
      '列出全部商品',
      '列出所有',
      '列出全部',
      '展示全部商品',
      '展示所有商品',
      '全部商品',
      '所有商品',
      '所有的商品',
      '把所有商品',
      '把全部商品',
      '全部列出',
      '全部列出来',
      '列出来所有',
      '列出来全部',
      '全都有哪些',
      '有哪些商品',
      '所有nft',
      '全部nft',
      '全部token',
      '所有token'
    ];
    return keywords.some((keyword) => lowerText.includes(keyword));
  };

  const searchProducts = async (
    query: string,
    options?: { listAll?: boolean },
    sessionOverride?: string
  ) => {
    try {
      const payload: Record<string, any> = {
        query,
        session_id: sessionOverride || sessionId || undefined
      };
      if (options?.listAll) {
        payload.list_all = true;
      }
      const enableListAll = Boolean(options?.listAll);
      setListAllMode(enableListAll);
      setSelectedCategory('全部');
      const response = await fetch('/api/ai/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await parseJsonResponse(response);
      console.info('Search response:', data);
      if (!response.ok) {
        throw new Error(data?.message || '商品搜索服务不可用');
      }

      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }

      if (data.success && data.products) {
        setProducts(data.products);
        setSelectedProduct(null);
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

  const handleDiscoveryFilter = async (filter: string) => {
    setTransactionState({
      status: 'processing',
      message: `正在加载${filter}推荐...`
    });
    await searchProducts(filter);
  };

  const normalizeCategory = (category?: string) => {
    if (!category) {
      return '其他';
    }
    const trimmed = category.trim();
    return trimmed ? trimmed : '其他';
  };

  const orderCategories = (categories: string[]) => {
    const priority = ['NFT', 'TOKEN', 'Token', '热门'];
    return categories.sort((a, b) => {
      const aIndex = priority.indexOf(a);
      const bIndex = priority.indexOf(b);
      if (aIndex !== -1 || bIndex !== -1) {
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return aIndex - bIndex;
      }
      return a.localeCompare(b);
    });
  };

  const rawCategories = Array.from(
    new Set(products.map((product) => normalizeCategory(product.category)))
  );
  const categoryOptions = listAllMode ? ['全部', ...orderCategories(rawCategories)] : [];

  const filteredProducts =
    listAllMode && selectedCategory !== '全部'
      ? products.filter((product) => normalizeCategory(product.category) === selectedCategory)
      : products;

  const parseJsonResponse = async (response: Response) => {
    const contentType = response.headers.get('content-type') || '';
    const text = await response.text();
    if (!text) {
      return { success: false, message: '服务响应为空' };
    }
    if (!contentType.includes('application/json')) {
      return { success: false, message: text };
    }
    try {
      return JSON.parse(text);
    } catch {
      return { success: false, message: '服务响应格式异常' };
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
            {discoveryFilters.length > 0 && (
              <div className="discovery-section">
                <div className="discovery-header">为你推荐</div>
                <div className="discovery-filters">
                  {discoveryFilters.map((filter) => (
                    <button
                      key={filter}
                      className="discovery-chip"
                      onClick={() => handleDiscoveryFilter(filter)}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {listAllMode && categoryOptions.length > 1 && (
              <div className="category-filters">
                {categoryOptions.map((category) => (
                  <button
                    key={category}
                    className={`category-chip ${selectedCategory === category ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
            <ProductList
              products={filteredProducts}
              selectedProduct={selectedProduct}
              onSelect={handleProductSelect}
              groupByCategory={listAllMode && selectedCategory === '全部'}
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
