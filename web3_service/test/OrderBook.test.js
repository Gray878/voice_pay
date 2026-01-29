const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("OrderBook", function () {
  let orderBook, usdol;
  let owner, trader1, trader2;
  let mockToken;

  beforeEach(async function () {
    [owner, trader1, trader2] = await ethers.getSigners();

    // 部署 MockUSDOL
    const MockUSDOL = await ethers.getContractFactory("MockUSDOL");
    usdol = await MockUSDOL.deploy();
    await usdol.waitForDeployment();

    // 部署 OrderBook
    const OrderBook = await ethers.getContractFactory("OrderBook");
    orderBook = await OrderBook.deploy(await usdol.getAddress());
    await orderBook.waitForDeployment();

    // 部署测试代币
    const MockToken = await ethers.getContractFactory("MockUSDOL");
    mockToken = await MockToken.deploy();
    await mockToken.waitForDeployment();

    // 给交易者分配代币
    await usdol.mint(trader1.address, ethers.parseEther("10000"));
    await usdol.mint(trader2.address, ethers.parseEther("10000"));
    await mockToken.mint(trader1.address, ethers.parseEther("1000"));
    await mockToken.mint(trader2.address, ethers.parseEther("1000"));
  });

  describe("创建买单", function () {
    it("应该成功创建买单", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");
      const totalCost = amount * price / ethers.parseEther("1");

      await usdol.connect(trader1).approve(await orderBook.getAddress(), totalCost);

      const tx = await orderBook.connect(trader1).createBuyOrder(
        await mockToken.getAddress(),
        amount,
        price
      );

      await expect(tx)
        .to.emit(orderBook, "OrderCreated")
        .withArgs(1, trader1.address, 0, await mockToken.getAddress(), amount, price, await ethers.provider.getBlock("latest").then(b => b.timestamp));

      const order = await orderBook.getOrder(1);
      expect(order.trader).to.equal(trader1.address);
      expect(order.orderType).to.equal(0);
      expect(order.amount).to.equal(amount);
      expect(order.price).to.equal(price);
      expect(order.status).to.equal(0);
    });

    it("应该拒绝无效的买单参数", async function () {
      await expect(
        orderBook.connect(trader1).createBuyOrder(
          ethers.ZeroAddress,
          ethers.parseEther("10"),
          ethers.parseEther("100")
        )
      ).to.be.revertedWith("Invalid token address");

      await expect(
        orderBook.connect(trader1).createBuyOrder(
          await mockToken.getAddress(),
          0,
          ethers.parseEther("100")
        )
      ).to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("创建卖单", function () {
    it("应该成功创建卖单", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");

      await mockToken.connect(trader1).approve(await orderBook.getAddress(), amount);

      const tx = await orderBook.connect(trader1).createSellOrder(
        await mockToken.getAddress(),
        amount,
        price
      );

      await expect(tx).to.emit(orderBook, "OrderCreated");

      const order = await orderBook.getOrder(1);
      expect(order.orderType).to.equal(1);
      expect(order.amount).to.equal(amount);
    });
  });

  describe("取消订单", function () {
    it("应该成功取消买单并退款", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");
      const totalCost = amount * price / ethers.parseEther("1");

      await usdol.connect(trader1).approve(await orderBook.getAddress(), totalCost);
      await orderBook.connect(trader1).createBuyOrder(
        await mockToken.getAddress(),
        amount,
        price
      );

      const balanceBefore = await usdol.balanceOf(trader1.address);
      await orderBook.connect(trader1).cancelOrder(1);
      const balanceAfter = await usdol.balanceOf(trader1.address);

      expect(balanceAfter - balanceBefore).to.equal(totalCost);

      const order = await orderBook.getOrder(1);
      expect(order.status).to.equal(2);
    });

    it("应该拒绝非订单所有者取消", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");

      await usdol.connect(trader1).approve(await orderBook.getAddress(), amount * price / ethers.parseEther("1"));
      await orderBook.connect(trader1).createBuyOrder(
        await mockToken.getAddress(),
        amount,
        price
      );

      await expect(
        orderBook.connect(trader2).cancelOrder(1)
      ).to.be.revertedWith("Not order owner");
    });
  });

  describe("查询订单", function () {
    it("应该正确查询用户订单", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");

      await usdol.connect(trader1).approve(await orderBook.getAddress(), amount * price / ethers.parseEther("1") * 2n);
      
      await orderBook.connect(trader1).createBuyOrder(await mockToken.getAddress(), amount, price);
      await orderBook.connect(trader1).createBuyOrder(await mockToken.getAddress(), amount, price);

      const userOrders = await orderBook.getUserOrders(trader1.address);
      expect(userOrders.length).to.equal(2);
      expect(userOrders[0]).to.equal(1);
      expect(userOrders[1]).to.equal(2);
    });

    it("应该正确批量查询订单", async function () {
      const amount = ethers.parseEther("10");
      const price = ethers.parseEther("100");

      await usdol.connect(trader1).approve(await orderBook.getAddress(), amount * price / ethers.parseEther("1") * 2n);
      
      await orderBook.connect(trader1).createBuyOrder(await mockToken.getAddress(), amount, price);
      await orderBook.connect(trader1).createBuyOrder(await mockToken.getAddress(), amount, price);

      const orders = await orderBook.getOrdersBatch([1, 2]);
      expect(orders.length).to.equal(2);
      expect(orders[0].orderId).to.equal(1);
      expect(orders[1].orderId).to.equal(2);
    });
  });
});
