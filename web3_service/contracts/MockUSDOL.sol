// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockUSDOL
 * @dev 测试用的 USDOL 稳定币合约
 */
contract MockUSDOL is ERC20, Ownable {
    constructor() ERC20("USD On-chain Liquidity", "USDOL") Ownable(msg.sender) {
        // 初始铸造 1,000,000 USDOL 给部署者
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }
    
    /**
     * @dev 铸造代币 (测试用)
     * @param to 接收地址
     * @param amount 数量
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
    
    /**
     * @dev 批量空投 (测试用)
     * @param recipients 接收地址数组
     * @param amount 每个地址的数量
     */
    function airdrop(address[] calldata recipients, uint256 amount) external onlyOwner {
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amount);
        }
    }
}
