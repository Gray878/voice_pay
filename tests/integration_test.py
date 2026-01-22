"""
API 集成测试
测试 AI 服务和 Web3 服务的 API 端点
"""

import requests
import json
from typing import Dict, Any


class Colors:
    """终端颜色"""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'


class APITester:
    """API 测试器"""
    
    def __init__(self, ai_service_url: str, web3_service_url: str):
        self.ai_service_url = ai_service_url
        self.web3_service_url = web3_service_url
        self.passed = 0
        self.failed = 0
    
    def test(self, name: str, url: str, method: str = 'GET', data: Dict = None) -> bool:
        """执行单个测试"""
        try:
            print(f"\n{Colors.BLUE}测试: {name}{Colors.END}")
            print(f"URL: {url}")
            
            if method == 'GET':
                response = requests.get(url, timeout=5)
            else:
                response = requests.post(url, json=data, timeout=5)
            
            print(f"状态码: {response.status_code}")
            
            if response.status_code in [200, 201]:
                print(f"{Colors.GREEN}✓ 通过{Colors.END}")
                self.passed += 1
                return True
            else:
                print(f"{Colors.RED}✗ 失败: {response.text}{Colors.END}")
                self.failed += 1
                return False
                
        except requests.exceptions.ConnectionError:
            print(f"{Colors.RED}✗ 失败: 无法连接到服务{Colors.END}")
            self.failed += 1
            return False
        except Exception as e:
            print(f"{Colors.RED}✗ 失败: {str(e)}{Colors.END}")
            self.failed += 1
            return False
    
    def run_ai_service_tests(self):
        """测试 AI 服务"""
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}AI 服务测试{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        
        # 健康检查
        self.test(
            "健康检查",
            f"{self.ai_service_url}/health"
        )
        
        # 生成反馈消息
        self.test(
            "生成成功反馈",
            f"{self.ai_service_url}/feedback/generate",
            method='POST',
            data={
                "feedback_type": "success",
                "template_key": "payment_completed",
                "params": {}
            }
        )
        
        # 格式化商品信息
        self.test(
            "格式化商品信息",
            f"{self.ai_service_url}/feedback/product-info",
            method='POST',
            data={
                "product": {
                    "name": "测试商品",
                    "price": "0.5 ETH",
                    "chain": "Polygon Mumbai"
                }
            }
        )
        
        # 格式化交易摘要
        self.test(
            "格式化交易摘要",
            f"{self.ai_service_url}/feedback/transaction-summary",
            method='POST',
            data={
                "product_name": "测试商品",
                "price": "0.5 ETH",
                "wallet_name": "MetaMask",
                "gas_fee": "0.002 ETH",
                "network": "Polygon Mumbai"
            }
        )
        
        # 格式化错误消息
        self.test(
            "格式化错误消息",
            f"{self.ai_service_url}/feedback/error-message",
            method='POST',
            data={
                "error_message": "insufficient funds"
            }
        )
        
        # 语义解析
        self.test(
            "语义解析",
            f"{self.ai_service_url}/parse",
            method='POST',
            data={
                "text": "我想买一个 NFT",
                "session_id": "test_session"
            }
        )
        
        # 商品搜索
        self.test(
            "商品搜索",
            f"{self.ai_service_url}/search",
            method='POST',
            data={
                "query": "NFT",
                "top_k": 3
            }
        )
    
    def run_web3_service_tests(self):
        """测试 Web3 服务"""
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}Web3 服务测试{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        
        # 健康检查
        self.test(
            "健康检查",
            f"{self.web3_service_url}/health"
        )
        
        # 获取支持的链
        self.test(
            "获取支持的链",
            f"{self.web3_service_url}/chains/supported"
        )
        
        # 支付启动（模拟）
        self.test(
            "支付启动",
            f"{self.web3_service_url}/payment/start",
            method='POST',
            data={
                "product": {
                    "id": "1",
                    "name": "测试商品",
                    "price": "0.5 ETH",
                    "contract_address": "0x1234567890123456789012345678901234567890"
                },
                "userAddress": "0x1234567890123456789012345678901234567890"
            }
        )
    
    def print_summary(self):
        """打印测试总结"""
        print(f"\n{Colors.YELLOW}{'='*60}{Colors.END}")
        print(f"{Colors.YELLOW}测试总结{Colors.END}")
        print(f"{Colors.YELLOW}{'='*60}{Colors.END}")
        
        total = self.passed + self.failed
        print(f"\n总测试数: {total}")
        print(f"{Colors.GREEN}通过: {self.passed}{Colors.END}")
        print(f"{Colors.RED}失败: {self.failed}{Colors.END}")
        
        if self.failed == 0:
            print(f"\n{Colors.GREEN}✓ 所有测试通过！{Colors.END}")
        else:
            print(f"\n{Colors.RED}✗ 有 {self.failed} 个测试失败{Colors.END}")


def main():
    """主函数"""
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    print(f"{Colors.BLUE}Voice-to-Pay API 集成测试{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}")
    
    # 创建测试器
    tester = APITester(
        ai_service_url="http://localhost:8000",
        web3_service_url="http://localhost:3001"
    )
    
    # 运行测试
    tester.run_ai_service_tests()
    tester.run_web3_service_tests()
    
    # 打印总结
    tester.print_summary()


if __name__ == "__main__":
    main()
