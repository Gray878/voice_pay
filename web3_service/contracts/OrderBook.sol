// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OrderBook
 * @dev 去中心化订单簿合约 - 支持买卖订单管理
 */
contract OrderBook is Ownable, ReentrancyGuard {
    // 订单类型
    enum OrderType { BUY, SELL }
    
    // 订单状态
    enum OrderStatus { ACTIVE, FILLED, CANCELLED }
    
    // 订单结构
    struct Order {
        uint256 orderId;
        address trader;
        OrderType orderType;
        address tokenAddress;
        uint256 amount;
        uint256 price;
        uint256 timestamp;
        OrderStatus status;
    }
    
    // USDOL 稳定币地址
    IERC20 public usdolToken;
    
    // 订单计数器
    uint256 public orderCounter;
    
    // 订单映射: orderId => Order
    mapping(uint256 => Order) public orders;
    
    // 用户订单列表: trader => orderIds[]
    mapping(address => uint256[]) public userOrders;
    
    // 代币订单列表: tokenAddress => orderIds[]
    mapping(address => uint256[]) public tokenOrders;
    
    // 事件
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        OrderType orderType,
        address indexed tokenAddress,
        uint256 amount,
        uint256 price,
        uint256 timestamp
    );
    
    event OrderFilled(
        uint256 indexed orderId,
        address indexed trader,
        uint256 timestamp
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed trader,
        uint256 timestamp
    );
    
    constructor(address _usdolAddress) Ownable(msg.sender) {
        require(_usdolAddress != address(0), "Invalid USDOL address");
        usdolToken = IERC20(_usdolAddress);
    }
    
    /**
     * @dev 创建买单
     * @param tokenAddress 要购买的代币地址
     * @param amount 购买数量
     * @param price 单价 (USDOL)
     */
    function createBuyOrder(
        address tokenAddress,
        uint256 amount,
        uint256 price
    ) external nonReentrant returns (uint256) {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(price > 0, "Price must be greater than 0");
        
        uint256 totalCost = amount * price;
        require(
            usdolToken.transferFrom(msg.sender, address(this), totalCost),
            "USDOL transfer failed"
        );
        
        orderCounter++;
        uint256 orderId = orderCounter;
        
        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            orderType: OrderType.BUY,
            tokenAddress: tokenAddress,
            amount: amount,
            price: price,
            timestamp: block.timestamp,
            status: OrderStatus.ACTIVE
        });
        
        userOrders[msg.sender].push(orderId);
        tokenOrders[tokenAddress].push(orderId);
        
        emit OrderCreated(
            orderId,
            msg.sender,
            OrderType.BUY,
            tokenAddress,
            amount,
            price,
            block.timestamp
        );
        
        return orderId;
    }
    
    /**
     * @dev 创建卖单
     * @param tokenAddress 要出售的代币地址
     * @param amount 出售数量
     * @param price 单价 (USDOL)
     */
    function createSellOrder(
        address tokenAddress,
        uint256 amount,
        uint256 price
    ) external nonReentrant returns (uint256) {
        require(tokenAddress != address(0), "Invalid token address");
        require(amount > 0, "Amount must be greater than 0");
        require(price > 0, "Price must be greater than 0");
        
        IERC20 token = IERC20(tokenAddress);
        require(
            token.transferFrom(msg.sender, address(this), amount),
            "Token transfer failed"
        );
        
        orderCounter++;
        uint256 orderId = orderCounter;
        
        orders[orderId] = Order({
            orderId: orderId,
            trader: msg.sender,
            orderType: OrderType.SELL,
            tokenAddress: tokenAddress,
            amount: amount,
            price: price,
            timestamp: block.timestamp,
            status: OrderStatus.ACTIVE
        });
        
        userOrders[msg.sender].push(orderId);
        tokenOrders[tokenAddress].push(orderId);
        
        emit OrderCreated(
            orderId,
            msg.sender,
            OrderType.SELL,
            tokenAddress,
            amount,
            price,
            block.timestamp
        );
        
        return orderId;
    }
    
    /**
     * @dev 取消订单
     * @param orderId 订单ID
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "Not order owner");
        require(order.status == OrderStatus.ACTIVE, "Order not active");
        
        order.status = OrderStatus.CANCELLED;
        
        // 退还资产
        if (order.orderType == OrderType.BUY) {
            uint256 refundAmount = order.amount * order.price;
            require(
                usdolToken.transfer(msg.sender, refundAmount),
                "USDOL refund failed"
            );
        } else {
            IERC20 token = IERC20(order.tokenAddress);
            require(
                token.transfer(msg.sender, order.amount),
                "Token refund failed"
            );
        }
        
        emit OrderCancelled(orderId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev 执行订单 (简化版本 - 实际应用需要匹配引擎)
     * @param orderId 订单ID
     */
    function fillOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.ACTIVE, "Order not active");
        require(order.trader != msg.sender, "Cannot fill own order");
        
        order.status = OrderStatus.FILLED;
        
        if (order.orderType == OrderType.BUY) {
            // 买单: 卖家提供代币，获得 USDOL
            IERC20 token = IERC20(order.tokenAddress);
            require(
                token.transferFrom(msg.sender, order.trader, order.amount),
                "Token transfer failed"
            );
            
            uint256 payment = order.amount * order.price;
            require(
                usdolToken.transfer(msg.sender, payment),
                "USDOL payment failed"
            );
        } else {
            // 卖单: 买家提供 USDOL，获得代币
            uint256 payment = order.amount * order.price;
            require(
                usdolToken.transferFrom(msg.sender, order.trader, payment),
                "USDOL payment failed"
            );
            
            IERC20 token = IERC20(order.tokenAddress);
            require(
                token.transfer(msg.sender, order.amount),
                "Token transfer failed"
            );
        }
        
        emit OrderFilled(orderId, msg.sender, block.timestamp);
    }
    
    /**
     * @dev 查询订单详情
     * @param orderId 订单ID
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    /**
     * @dev 查询用户所有订单
     * @param trader 用户地址
     */
    function getUserOrders(address trader) external view returns (uint256[] memory) {
        return userOrders[trader];
    }
    
    /**
     * @dev 查询代币的所有订单
     * @param tokenAddress 代币地址
     */
    function getTokenOrders(address tokenAddress) external view returns (uint256[] memory) {
        return tokenOrders[tokenAddress];
    }
    
    /**
     * @dev 批量查询订单详情
     * @param orderIds 订单ID数组
     */
    function getOrdersBatch(uint256[] calldata orderIds) 
        external 
        view 
        returns (Order[] memory) 
    {
        Order[] memory result = new Order[](orderIds.length);
        for (uint256 i = 0; i < orderIds.length; i++) {
            result[i] = orders[orderIds[i]];
        }
        return result;
    }
    
    /**
     * @dev 更新 USDOL 地址 (仅管理员)
     * @param newUsdolAddress 新的 USDOL 地址
     */
    function updateUsdolAddress(address newUsdolAddress) external onlyOwner {
        require(newUsdolAddress != address(0), "Invalid address");
        usdolToken = IERC20(newUsdolAddress);
    }
}
