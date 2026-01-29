import { Router } from 'express';
import axios from 'axios';
import { OrderbookIndexer } from '../indexer/orderbook-indexer';

type OrderEntry = {
  orderKey: string;
  order: {
    nft: { tokenId: bigint; collectionAddr: string };
    price: bigint;
    maker: string;
  };
  status: string;
  firstSeenBlock: number;
  lastUpdateBlock: number;
};

function isTruthyQuery(value: unknown): boolean {
  if (value === true) return true;
  if (value == null) return false;
  const s = String(value).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

function parseNameFromTokenURI(tokenURI: string | null): string | null {
  if (!tokenURI) return null;
  if (tokenURI.startsWith('data:application/json;base64,')) {
    try {
      const b64 = tokenURI.slice('data:application/json;base64,'.length);
      const json = Buffer.from(b64, 'base64').toString('utf8');
      const obj = JSON.parse(json);
      return typeof obj?.name === 'string' ? obj.name : null;
    } catch {
      return null;
    }
  }
  if (tokenURI.startsWith('data:application/json,')) {
    try {
      const raw = tokenURI.slice('data:application/json,'.length);
      const json = decodeURIComponent(raw);
      const obj = JSON.parse(json);
      return typeof obj?.name === 'string' ? obj.name : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function fetchJsonName(url: string): Promise<string | null> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) return null;
  try {
    const res = await axios.get(url, {
      timeout: 8000,
      headers: { accept: 'application/json' },
      responseType: 'text',
      maxContentLength: 2_000_000,
    });
    const data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    return typeof data?.name === 'string' ? data.name : null;
  } catch {
    return null;
  }
}

function entryKey(entry: OrderEntry): string {
  return `${entry.order.nft.collectionAddr.toLowerCase()}:${entry.order.nft.tokenId.toString()}`;
}

async function buildMetadataMap(entries: OrderEntry[], indexer: OrderbookIndexer): Promise<Map<string, { tokenURI: string | null; name: string | null }>> {
  const map = new Map<string, { tokenURI: string | null; name: string | null }>();
  for (const entry of entries) {
    const key = entryKey(entry);
    if (map.has(key)) continue;
    const tokenURI = await indexer.getTokenURI(entry.order.nft.collectionAddr, entry.order.nft.tokenId);
    let name = parseNameFromTokenURI(tokenURI);
    if (!name && tokenURI) {
      const fetched = await fetchJsonName(tokenURI);
      name = fetched ?? null;
    }
    map.set(key, { tokenURI, name });
  }
  return map;
}

export function createOrderbookRoutes(indexer: OrderbookIndexer): Router {
  const router = Router();

  router.get('/orders', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const orders = await indexer.cheapestN(limit);
      const includeMetadata = isTruthyQuery(req.query.includeMetadata);
      const metadataMap = includeMetadata ? await buildMetadataMap(orders as OrderEntry[], indexer) : null;
      
      const formatted = orders.map(o => ({
        orderKey: o.orderKey,
        tokenId: o.order.nft.tokenId.toString(),
        collectionAddr: o.order.nft.collectionAddr,
        price: o.order.price.toString(),
        priceUSD: Number(o.order.price) / 1_000_000,
        seller: o.order.maker,
        isActive: o.status === 'open',
        ...(includeMetadata
          ? metadataMap?.get(entryKey(o as OrderEntry)) || { tokenURI: null, name: null }
          : {}),
      }));

      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/orders/:orderKey', async (req, res) => {
    try {
      const { orderKey } = req.params;
      const entry = await indexer.getOrderByKey(orderKey);
      if (!entry) {
        res.status(404).json({ error: '订单不存在' });
        return;
      }
      const includeMetadata = isTruthyQuery(req.query.includeMetadata);
      const metadataMap = includeMetadata ? await buildMetadataMap([entry as OrderEntry], indexer) : null;
      const formatted = {
        orderKey: entry.orderKey,
        tokenId: entry.order.nft.tokenId.toString(),
        collectionAddr: entry.order.nft.collectionAddr,
        price: entry.order.price.toString(),
        priceUSD: Number(entry.order.price) / 1_000_000,
        seller: entry.order.maker,
        isActive: entry.status === 'open',
        status: entry.status,
        firstSeenBlock: entry.firstSeenBlock,
        lastUpdateBlock: entry.lastUpdateBlock,
        ...(includeMetadata
          ? metadataMap?.get(entryKey(entry as OrderEntry)) || { tokenURI: null, name: null }
          : {}),
      };
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/orders/batch', async (req, res) => {
    try {
      const { orderKeys } = req.body || {};
      if (!Array.isArray(orderKeys)) {
        res.status(400).json({ error: 'orderKeys 必须是数组' });
        return;
      }
      const entries = await indexer.getOrdersByKeys(orderKeys);
      const includeMetadata = isTruthyQuery(req.query.includeMetadata);
      const metadataMap = includeMetadata ? await buildMetadataMap(entries as OrderEntry[], indexer) : null;
      const formatted = entries.map(entry => ({
        orderKey: entry.orderKey,
        tokenId: entry.order.nft.tokenId.toString(),
        collectionAddr: entry.order.nft.collectionAddr,
        price: entry.order.price.toString(),
        priceUSD: Number(entry.order.price) / 1_000_000,
        seller: entry.order.maker,
        isActive: entry.status === 'open',
        status: entry.status,
        firstSeenBlock: entry.firstSeenBlock,
        lastUpdateBlock: entry.lastUpdateBlock,
        ...(includeMetadata
          ? metadataMap?.get(entryKey(entry as OrderEntry)) || { tokenURI: null, name: null }
          : {}),
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/floor-price', async (req, res) => {
    try {
      const floorPrice = await indexer.floorPrice();
      res.json({
        floorPrice: floorPrice?.toString() || null,
        floorPriceUSD: floorPrice ? Number(floorPrice) / 1_000_000 : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/sync', async (req, res) => {
    try {
      await indexer.sync();
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
