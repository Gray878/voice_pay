/**
 * 合约 ABI 定义
 * 从 Voice-to-Pay 项目迁移
 */

export const ERC20_ABI = [
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export const NFTMANAGER_ABI = [
  "function tokenURI(uint256 tokenId) view returns (string)",
];

/**
 * OrderbookV2 合约 ABI
 * 包含事件和核心方法
 */
export const ORDERBOOK_ABI = [
  // Events
  "event LogMake(bytes32 orderKey,uint8 indexed side,uint8 indexed saleKind,address indexed maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt)",
  "event LogCancel(bytes32 indexed orderKey,address indexed maker)",
  "event LogMatch(bytes32 indexed makeOrderKey,bytes32 indexed takeOrderKey,(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) makeOrder,(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) takeOrder,uint128 fillPrice)",
  
  // Storage getters
  "function orders(bytes32) view returns (tuple(tuple(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) order, bytes32 next))",
  "function filledAmount(bytes32) view returns (uint256)",
  
  // Matching (buy)
  "function matchOrder((uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) sellOrder,(uint8 side,uint8 saleKind,address maker,(uint256 tokenId,address collectionAddr,uint96 amount) nft,uint128 price,address currency,uint64 expiry,uint64 salt) buyOrder) payable",
];
