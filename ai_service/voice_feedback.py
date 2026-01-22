"""
语音反馈模块 (Voice Feedback Module)
负责将系统消息转换为用户友好的语音反馈
Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7
"""

import logging
from typing import Optional, Dict, Any
from enum import Enum
import re

logger = logging.getLogger(__name__)


class FeedbackType(Enum):
    """反馈类型枚举"""
    SUCCESS = "success"
    ERROR = "error"
    INFO = "info"
    CONFIRMATION = "confirmation"
    PROGRESS = "progress"


class VoiceFeedbackModule:
    """
    语音反馈模块
    
    职责：
    - 生成用户友好的反馈消息
    - 将技术术语转换为通俗语言
    - 提供多语言支持（当前支持中文）
    """
    
    def __init__(self, language: str = "zh-CN"):
        """
        初始化语音反馈模块
        
        Args:
            language: 语言代码，默认 "zh-CN" (简体中文)
        """
        self.language = language
        
        # 初始化消息模板
        self._init_templates()
        
        # 初始化技术术语映射
        self._init_term_mapping()
        
        logger.info(f"VoiceFeedbackModule 初始化完成: language={language}")
    
    def _init_templates(self) -> None:
        """初始化反馈消息模板"""
        self.templates: Dict[str, Dict[str, str]] = {
            # 成功消息
            "success": {
                "product_found": "我找到了 {count} 个商品，{product_name}，价格是 {price}",
                "wallet_connected": "钱包连接成功，当前地址是 {address}",
                "transaction_sent": "交易已发送，交易哈希是 {tx_hash}",
                "transaction_confirmed": "交易已确认，您的支付成功了",
                "asset_activated": "资产激活成功，您现在可以使用了",
                "payment_completed": "支付完成，感谢您的购买"
            },
            
            # 错误消息
            "error": {
                "no_product_found": "抱歉，我没有找到相关的商品，您可以换个说法试试",
                "wallet_not_connected": "请先连接您的钱包",
                "insufficient_balance": "您的余额不足，无法完成支付",
                "transaction_failed": "交易失败了，{reason}",
                "network_error": "网络连接出现问题，请稍后再试",
                "invalid_input": "抱歉，我没有理解您的意思，请再说一遍",
                "gas_too_high": "当前网络拥堵，手续费较高，建议稍后再试"
            },
            
            # 信息消息
            "info": {
                "listening": "我在听，请说话",
                "processing": "正在处理您的请求，请稍等",
                "searching": "正在搜索商品",
                "estimating_gas": "正在估算手续费",
                "waiting_confirmation": "等待交易确认中"
            },
            
            # 确认消息
            "confirmation": {
                "payment_summary": "您要购买 {product_name}，价格是 {price}，使用 {wallet} 钱包支付，手续费大约 {gas_fee}，确认支付吗？",
                "cancel_payment": "支付已取消",
                "switch_network": "需要切换到 {network} 网络，确认吗？"
            },
            
            # 进度消息
            "progress": {
                "step_1": "第一步：查找商品",
                "step_2": "第二步：选择钱包",
                "step_3": "第三步：确认支付",
                "step_4": "第四步：执行交易",
                "step_5": "第五步：等待确认"
            }
        }
    
    def _init_term_mapping(self) -> None:
        """初始化技术术语到用户友好语言的映射"""
        self.term_mapping: Dict[str, str] = {
            # 区块链术语
            "transaction": "交易",
            "gas": "手续费",
            "gas fee": "手续费",
            "wallet": "钱包",
            "address": "地址",
            "balance": "余额",
            "token": "代币",
            "NFT": "数字藏品",
            "smart contract": "智能合约",
            "blockchain": "区块链",
            "network": "网络",
            "confirmation": "确认",
            "hash": "哈希值",
            
            # 错误术语
            "insufficient funds": "余额不足",
            "gas estimation failed": "手续费估算失败",
            "transaction reverted": "交易被拒绝",
            "user rejected": "用户取消",
            "network error": "网络错误",
            "invalid address": "地址无效",
            "contract not verified": "合约未验证",
            
            # 状态术语
            "pending": "处理中",
            "confirmed": "已确认",
            "failed": "失败",
            "success": "成功",
            "cancelled": "已取消"
        }
    
    def generate_feedback(
        self,
        feedback_type: FeedbackType,
        template_key: str,
        **kwargs
    ) -> str:
        """
        生成反馈消息
        Requirements: 18.1, 18.2
        
        Args:
            feedback_type: 反馈类型
            template_key: 模板键名
            **kwargs: 模板参数
            
        Returns:
            str: 格式化的反馈消息
        """
        try:
            # 获取模板
            template = self.templates.get(feedback_type.value, {}).get(template_key)
            
            if not template:
                logger.warning(f"未找到模板: {feedback_type.value}.{template_key}")
                return self._generate_fallback_message(feedback_type, **kwargs)
            
            # 格式化消息
            message = template.format(**kwargs)
            
            # 转换技术术语
            message = self._translate_technical_terms(message)
            
            logger.debug(f"生成反馈消息: {message}")
            return message
            
        except Exception as e:
            logger.error(f"生成反馈消息失败: {e}")
            return self._generate_fallback_message(feedback_type, **kwargs)
    
    def _translate_technical_terms(self, message: str) -> str:
        """
        将技术术语转换为用户友好的语言
        Requirements: 18.3, 18.4
        
        Args:
            message: 原始消息
            
        Returns:
            str: 转换后的消息
        """
        translated = message
        
        # 替换技术术语
        for tech_term, friendly_term in self.term_mapping.items():
            # 使用正则表达式进行不区分大小写的替换
            pattern = re.compile(re.escape(tech_term), re.IGNORECASE)
            translated = pattern.sub(friendly_term, translated)
        
        return translated
    
    def _generate_fallback_message(
        self,
        feedback_type: FeedbackType,
        **kwargs
    ) -> str:
        """
        生成备用消息（当模板不存在时）
        
        Args:
            feedback_type: 反馈类型
            **kwargs: 消息参数
            
        Returns:
            str: 备用消息
        """
        if feedback_type == FeedbackType.SUCCESS:
            return "操作成功"
        elif feedback_type == FeedbackType.ERROR:
            reason = kwargs.get("reason", "未知错误")
            return f"操作失败：{reason}"
        elif feedback_type == FeedbackType.INFO:
            return "正在处理"
        elif feedback_type == FeedbackType.CONFIRMATION:
            return "请确认操作"
        else:
            return "收到"
    
    def format_product_info(self, product: Dict[str, Any]) -> str:
        """
        格式化商品信息
        Requirements: 18.5
        
        Args:
            product: 商品信息字典
            
        Returns:
            str: 格式化的商品描述
        """
        name = product.get("name", "未知商品")
        price = product.get("price", "0")
        chain = product.get("chain", "未知链")
        
        return f"{name}，价格 {price}，在 {chain} 链上"
    
    def format_transaction_summary(
        self,
        product_name: str,
        price: str,
        wallet_name: str,
        gas_fee: str,
        network: str
    ) -> str:
        """
        格式化交易摘要
        Requirements: 18.6
        
        Args:
            product_name: 商品名称
            price: 价格
            wallet_name: 钱包名称
            gas_fee: 手续费
            network: 网络名称
            
        Returns:
            str: 格式化的交易摘要
        """
        return self.generate_feedback(
            FeedbackType.CONFIRMATION,
            "payment_summary",
            product_name=product_name,
            price=price,
            wallet=wallet_name,
            gas_fee=gas_fee,
            network=network
        )
    
    def format_error_message(self, error: Exception) -> str:
        """
        格式化错误消息
        Requirements: 18.7
        
        Args:
            error: 异常对象
            
        Returns:
            str: 用户友好的错误消息
        """
        error_message = str(error)
        
        # 识别常见错误类型
        if "insufficient funds" in error_message.lower():
            return self.generate_feedback(
                FeedbackType.ERROR,
                "insufficient_balance"
            )
        elif "user rejected" in error_message.lower() or "user denied" in error_message.lower():
            return "您取消了操作"
        elif "network" in error_message.lower():
            return self.generate_feedback(
                FeedbackType.ERROR,
                "network_error"
            )
        elif "gas" in error_message.lower():
            return self.generate_feedback(
                FeedbackType.ERROR,
                "gas_too_high"
            )
        else:
            # 转换技术术语
            friendly_message = self._translate_technical_terms(error_message)
            return self.generate_feedback(
                FeedbackType.ERROR,
                "transaction_failed",
                reason=friendly_message
            )
    
    def add_custom_template(
        self,
        feedback_type: FeedbackType,
        key: str,
        template: str
    ) -> None:
        """
        添加自定义消息模板
        
        Args:
            feedback_type: 反馈类型
            key: 模板键名
            template: 模板字符串
        """
        if feedback_type.value not in self.templates:
            self.templates[feedback_type.value] = {}
        
        self.templates[feedback_type.value][key] = template
        logger.info(f"添加自定义模板: {feedback_type.value}.{key}")
    
    def add_term_mapping(self, tech_term: str, friendly_term: str) -> None:
        """
        添加技术术语映射
        
        Args:
            tech_term: 技术术语
            friendly_term: 用户友好术语
        """
        self.term_mapping[tech_term] = friendly_term
        logger.info(f"添加术语映射: {tech_term} -> {friendly_term}")


# 全局实例
voice_feedback = VoiceFeedbackModule()
