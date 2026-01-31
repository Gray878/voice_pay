/**
 * 从链上 OrderBook 合约读取 USDOL 地址（用于补全 .env 的 USDOL_ADDRESS）
 * 用法：在 web3_service 目录下，.env 已设置 EVM_RPC_URL、EVM_CHAIN_ID、ORDERBOOK_ADDRESS 后执行：
 *   node scripts/get-usdol-from-orderbook.js
 * 若官方 RPC 连不上（ECONNRESET），脚本会自动尝试备用 Amoy RPC。
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), override: true });
const { JsonRpcProvider, Contract } = require('ethers');

const ORDERBOOK_ABI = ['function usdolToken() view returns (address)'];

// 官方 rpc-amoy.polygon.technology 部分地区不可达，优先用备用
const AMOY_RPC_FALLBACKS = [
  'https://polygon-amoy.drpc.org',
  'https://80002.rpc.thirdweb.com',
  'https://polygon-amoy-bor-rpc.publicnode.com',
  'https://rpc-amoy.polygon.technology',
];

async function main() {
  const rawUrls = process.env.EVM_RPC_ENDPOINTS || process.env.EVM_RPC_URL || '';
  const urls = rawUrls.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const rpcList = urls.length > 0 ? urls : AMOY_RPC_FALLBACKS;
  const chainId = parseInt(process.env.EVM_CHAIN_ID || '80002', 10);
  const orderbookAddress = process.env.ORDERBOOK_ADDRESS || '';

  if (!orderbookAddress) {
    console.error('请先在 .env 中设置 ORDERBOOK_ADDRESS');
    process.exit(1);
  }

  let lastErr;
  for (const rpc of rpcList) {
    try {
      const provider = new JsonRpcProvider(rpc, chainId);
      await provider.getBlockNumber();
      const ob = new Contract(orderbookAddress, ORDERBOOK_ABI, provider);
      const usdolAddress = await ob.usdolToken();
      console.log('USDOL_ADDRESS=', usdolAddress);
      console.log('\n将上面一行填入 .env 的 USDOL_ADDRESS 即可。');
      return;
    } catch (e) {
      lastErr = e;
      console.error('RPC 失败:', rpc, '-', e.message || e.code || e);
    }
  }
  console.error('所有 RPC 均失败，最后错误:', lastErr?.message || lastErr);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
