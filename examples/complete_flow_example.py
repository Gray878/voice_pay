"""
完整流程示例
演示从语音输入到支付完成的完整流程
"""

import asyncio
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'ai_service'))

from voice_feedback import voice_feedback, FeedbackType


async def simulate_complete_flow():
    """模拟完整的语音支付流程"""
    
    print("=" * 60)
    print("Voice-to-Pay 完整流程演示")
    print("=" * 60)
    print()
    
    # 步骤 1: 开始监听
    print("步骤 1: 开始语音输入")
    message = voice_feedback.generate_feedback(
        FeedbackType.INFO,
        "listening"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 2: 处理语音输入
    print("步骤 2: 处理语音输入")
    print("用户: 我想买一个 NFT")
    message = voice_feedback.generate_feedback(
        FeedbackType.INFO,
        "processing"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 3: 搜索商品
    print("步骤 3: 搜索商品")
    message = voice_feedback.generate_feedback(
        FeedbackType.INFO,
        "searching"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 4: 找到商品
    print("步骤 4: 找到商品")
    product = {
        "name": "CryptoPunk #1234",
        "price": "0.5 ETH",
        "chain": "Polygon Mumbai"
    }
    message = voice_feedback.format_product_info(product)
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 5: 连接钱包
    print("步骤 5: 连接钱包")
    message = voice_feedback.generate_feedback(
        FeedbackType.SUCCESS,
        "wallet_connected",
        address="0x1234...5678"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 6: 估算手续费
    print("步骤 6: 估算手续费")
    message = voice_feedback.generate_feedback(
        FeedbackType.INFO,
        "estimating_gas"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 7: 生成交易摘要
    print("步骤 7: 生成交易摘要")
    message = voice_feedback.format_transaction_summary(
        product_name="CryptoPunk #1234",
        price="0.5 ETH",
        wallet_name="MetaMask",
        gas_fee="0.002 ETH",
        network="Polygon Mumbai"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(2)
    
    # 步骤 8: 用户确认
    print("步骤 8: 用户确认")
    print("用户: 确认支付")
    print()
    await asyncio.sleep(1)
    
    # 步骤 9: 发送交易
    print("步骤 9: 发送交易")
    message = voice_feedback.generate_feedback(
        FeedbackType.SUCCESS,
        "transaction_sent",
        tx_hash="0xabcd...ef01"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 10: 等待确认
    print("步骤 10: 等待交易确认")
    message = voice_feedback.generate_feedback(
        FeedbackType.INFO,
        "waiting_confirmation"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(2)
    
    # 步骤 11: 交易确认
    print("步骤 11: 交易确认")
    message = voice_feedback.generate_feedback(
        FeedbackType.SUCCESS,
        "transaction_confirmed"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 12: 资产激活
    print("步骤 12: 资产激活")
    message = voice_feedback.generate_feedback(
        FeedbackType.SUCCESS,
        "asset_activated"
    )
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 步骤 13: 支付完成
    print("步骤 13: 支付完成")
    message = voice_feedback.generate_feedback(
        FeedbackType.SUCCESS,
        "payment_completed"
    )
    print(f"系统: {message}")
    print()
    
    print("=" * 60)
    print("流程演示完成！")
    print("=" * 60)


async def simulate_error_flow():
    """模拟错误处理流程"""
    
    print("\n\n")
    print("=" * 60)
    print("错误处理演示")
    print("=" * 60)
    print()
    
    # 场景 1: 余额不足
    print("场景 1: 余额不足")
    error = Exception("insufficient funds for gas * price + value")
    message = voice_feedback.format_error_message(error)
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 场景 2: 用户取消
    print("场景 2: 用户取消")
    error = Exception("user rejected transaction")
    message = voice_feedback.format_error_message(error)
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 场景 3: 网络错误
    print("场景 3: 网络错误")
    error = Exception("network error: connection timeout")
    message = voice_feedback.format_error_message(error)
    print(f"系统: {message}")
    print()
    await asyncio.sleep(1)
    
    # 场景 4: Gas 过高
    print("场景 4: Gas 过高")
    error = Exception("gas estimation failed: gas too high")
    message = voice_feedback.format_error_message(error)
    print(f"系统: {message}")
    print()
    
    print("=" * 60)
    print("错误处理演示完成！")
    print("=" * 60)


async def main():
    """主函数"""
    # 演示完整流程
    await simulate_complete_flow()
    
    # 演示错误处理
    await simulate_error_flow()


if __name__ == "__main__":
    asyncio.run(main())
