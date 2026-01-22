"""
端到端集成示例
演示完整的语音支付流程
"""

import requests
import time
from typing import Dict, Any

# 服务 URL
AI_SERVICE_URL = "http://localhost:5000"
WEB3_SERVICE_URL = "http://localhost:3001"


class VoiceToPayClient:
    """Voice-to-Pay 客户端"""
    
    def __init__(self):
        self.session_id = None
        self.ai_url = AI_SERVICE_URL
        self.web3_url = WEB3_SERVICE_URL
    
    def create_session(self) -> str:
        """创建会话"""
        response = requests.post(f"{self.ai_url}/session/create")
        result = response.json()
        
        if result['success']:
            self.session_id = result['session_id']
            print(f"✓ 会话创建成功: {self.session_id}")
            return self.session_id
        else:
            raise Exception(f"创建会话失败: {result['error']}")
    
    def parse_voice_command(self, text: str) -> Dict[str, Any]:
        """解析语音命令"""
        response = requests.post(
            f"{self.ai_url}/semantic/parse",
            json={'text': text, 'session_id': self.session_id}
        )
        result = response.json()
        
        if result['success']:
            print(f"✓ 语义解析成功: {result['data']}")
            return result['data']
        else:
            raise Exception(f"语义解析失败: {result['error']}")
    
    def search_products(self, query: str, top_k: int = 5) -> list:
        """搜索商品"""
        response = requests.post(
            f"{self.ai_url}/knowledge/search",
            json={
                'query': query,
                'session_id': self.session_id,
                'top_k': top_k
            }
        )
        result = response.json()
        
        if result['success']:
            products = result['data']['products']
            print(f"✓ 找到 {len(products)} 个商品")
            for i, product in enumerate(products, 1):
                print(f"  {i}. {product['name']} - {product['price']} {product.get('currency', 'MATIC')}")
            return products
        else:
            raise Exception(f"商品搜索失败: {result['error']}")
    
    def initiate_payment(self, product_id: str) -> Dict[str, Any]:
        """发起支付"""
        response = requests.post(
            f"{self.ai_url}/payment/initiate",
            json={
                'product_id': product_id,
                'session_id': self.session_id
            }
        )
        result = response.json()
        
        if result['success']:
            print(f"✓ 支付流程已启动")
            return result['data']
        else:
            raise Exception(f"发起支付失败: {result['error']}")
    
    def confirm_payment(self) -> Dict[str, Any]:
        """确认支付"""
        response = requests.post(
            f"{self.ai_url}/payment/confirm",
            json={'session_id': self.session_id}
        )
        result = response.json()
        
        if result['success']:
            print(f"✓ 支付已确认")
            return result['data']
        else:
            raise Exception(f"确认支付失败: {result['error']}")
    
    def cancel_payment(self) -> Dict[str, Any]:
        """取消支付"""
        response = requests.post(
            f"{self.ai_url}/payment/cancel",
            json={'session_id': self.session_id}
        )
        result = response.json()
        
        if result['success']:
            print(f"✓ 支付已取消")
            return result['data']
        else:
            raise Exception(f"取消支付失败: {result['error']}")
    
    def check_transaction_status(self, tx_hash: str) -> Dict[str, Any]:
        """查询交易状态"""
        response = requests.get(f"{self.web3_url}/transaction/status/{tx_hash}")
        result = response.json()
        
        if result['success']:
            status = result['data']
            print(f"✓ 交易状态: {status['status']}")
            return status
        else:
            raise Exception(f"查询交易状态失败: {result['error']}")


def demo_successful_payment():
    """演示成功的支付流程"""
    print("\n" + "="*60)
    print("演示场景 1: 成功的支付流程")
    print("="*60 + "\n")
    
    client = VoiceToPayClient()
    
    try:
        # 1. 创建会话
        print("步骤 1: 创建会话")
        client.create_session()
        time.sleep(0.5)
        
        # 2. 语音命令解析
        print("\n步骤 2: 解析语音命令")
        voice_command = "我想买一个 NFT 艺术品"
        client.parse_voice_command(voice_command)
        time.sleep(0.5)
        
        # 3. 搜索商品
        print("\n步骤 3: 搜索商品")
        products = client.search_products("NFT 艺术品")
        time.sleep(0.5)
        
        if not products:
            print("✗ 没有找到商品")
            return
        
        # 4. 选择第一个商品
        selected_product = products[0]
        print(f"\n步骤 4: 选择商品 - {selected_product['name']}")
        time.sleep(0.5)
        
        # 5. 发起支付
        print("\n步骤 5: 发起支付流程")
        client.initiate_payment(selected_product['id'])
        time.sleep(1)
        
        # 6. 用户确认
        print("\n步骤 6: 用户确认支付")
        print("用户说: '确认支付'")
        payment_result = client.confirm_payment()
        time.sleep(1)
        
        # 7. 监听交易状态（模拟）
        if 'txHash' in payment_result:
            print(f"\n步骤 7: 监听交易状态")
            print(f"交易哈希: {payment_result['txHash']}")
            
            # 模拟轮询
            for i in range(3):
                time.sleep(2)
                print(f"  轮询 {i+1}/3...")
            
            print("✓ 交易已确认")
        
        print("\n" + "="*60)
        print("✓ 支付流程完成！")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ 错误: {e}\n")


def demo_cancelled_payment():
    """演示取消支付流程"""
    print("\n" + "="*60)
    print("演示场景 2: 取消支付流程")
    print("="*60 + "\n")
    
    client = VoiceToPayClient()
    
    try:
        # 1. 创建会话
        print("步骤 1: 创建会话")
        client.create_session()
        time.sleep(0.5)
        
        # 2. 搜索商品
        print("\n步骤 2: 搜索商品")
        products = client.search_products("游戏道具")
        time.sleep(0.5)
        
        if not products:
            print("✗ 没有找到商品")
            return
        
        # 3. 发起支付
        print("\n步骤 3: 发起支付流程")
        client.initiate_payment(products[0]['id'])
        time.sleep(1)
        
        # 4. 用户取消
        print("\n步骤 4: 用户取消支付")
        print("用户说: '取消'")
        client.cancel_payment()
        
        print("\n" + "="*60)
        print("✓ 支付已取消")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ 错误: {e}\n")


def demo_multi_product_search():
    """演示多商品搜索"""
    print("\n" + "="*60)
    print("演示场景 3: 多商品搜索和比较")
    print("="*60 + "\n")
    
    client = VoiceToPayClient()
    
    try:
        # 1. 创建会话
        print("步骤 1: 创建会话")
        client.create_session()
        time.sleep(0.5)
        
        # 2. 搜索多个类别
        queries = ["NFT 艺术品", "游戏道具", "虚拟土地"]
        
        for query in queries:
            print(f"\n步骤 2.{queries.index(query)+1}: 搜索 '{query}'")
            products = client.search_products(query, top_k=3)
            time.sleep(1)
        
        print("\n" + "="*60)
        print("✓ 搜索完成")
        print("="*60 + "\n")
        
    except Exception as e:
        print(f"\n✗ 错误: {e}\n")


if __name__ == "__main__":
    print("\n")
    print("╔" + "="*58 + "╗")
    print("║" + " "*15 + "Voice-to-Pay 端到端演示" + " "*15 + "║")
    print("╚" + "="*58 + "╝")
    
    # 检查服务是否运行
    print("\n检查服务状态...")
    try:
        ai_health = requests.get(f"{AI_SERVICE_URL}/health", timeout=2)
        print(f"✓ AI Service: {ai_health.json()['status']}")
    except:
        print("✗ AI Service 未运行")
        print("  请先启动: python ai_service/api_gateway.py")
        exit(1)
    
    try:
        web3_health = requests.get(f"{WEB3_SERVICE_URL}/health", timeout=2)
        print(f"✓ Web3 Service: {web3_health.json()['status']}")
    except:
        print("✗ Web3 Service 未运行")
        print("  请先启动: npm start (在 web3_service 目录)")
        exit(1)
    
    # 运行演示
    demo_successful_payment()
    time.sleep(2)
    
    demo_cancelled_payment()
    time.sleep(2)
    
    demo_multi_product_search()
    
    print("\n演示完成！\n")
