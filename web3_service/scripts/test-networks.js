/**
 * 测试所有可用测试网的连接
 */

const networks = {
  'Sepolia': {
    rpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    chainId: 11155111
  },
  'Base Sepolia': {
    rpc: 'https://sepolia.base.org',
    chainId: 84532
  },
  'Optimism Sepolia': {
    rpc: 'https://sepolia.optimism.io',
    chainId: 11155420
  },
  'Arbitrum Sepolia': {
    rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
    chainId: 421614
  },
  'BSC Testnet': {
    rpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    chainId: 97
  },
  'Polygon Amoy': {
    rpc: 'https://rpc-amoy.polygon.technology',
    chainId: 80002
  }
};

async function testNetwork(name, config) {
  try {
    const response = await fetch(config.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1
      })
    });

    const data = await response.json();
    const chainId = parseInt(data.result, 16);
    
    if (chainId === config.chainId) {
      console.log(`✅ ${name.padEnd(20)} - 连接成功 (Chain ID: ${chainId})`);
      return true;
    } else {
      console.log(`❌ ${name.padEnd(20)} - Chain ID 不匹配 (期望: ${config.chainId}, 实际: ${chainId})`);
      return false;
    }
  } catch (error) {
    console.log(`❌ ${name.padEnd(20)} - 连接失败: ${error.message}`);
    return false;
  }
}

async function testAllNetworks() {
  console.log('🌐 测试所有测试网连接...\n');
  
  const results = [];
  for (const [name, config] of Object.entries(networks)) {
    const success = await testNetwork(name, config);
    results.push({ name, success });
  }
  
  console.log('\n📊 测试结果汇总:');
  const successCount = results.filter(r => r.success).length;
  console.log(`成功: ${successCount}/${results.length}`);
  
  if (successCount > 0) {
    console.log('\n✅ 可用的测试网:');
    results.filter(r => r.success).forEach(r => console.log(`   - ${r.name}`));
  }
  
  if (successCount < results.length) {
    console.log('\n❌ 不可用的测试网:');
    results.filter(r => !r.success).forEach(r => console.log(`   - ${r.name}`));
  }
  
  console.log('\n💡 推荐使用: Base Sepolia (Layer 2, 低成本, Coinbase 生态)');
}

testAllNetworks().catch(console.error);
