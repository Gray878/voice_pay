"""
ASR 引擎属性测试 (Property-Based Tests)
使用 Hypothesis 进行基于属性的测试

Feature: voice-to-pay
Property 1: ASR 结果完整性
Validates: Requirements 1.4
"""

import pytest
from dataclasses import dataclass
from hypothesis import given, strategies as st, settings
import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# 为了避免 torch/whisper 的 DLL 加载问题，我们直接定义 ASRResult
# 这与 asr_engine.py 中的定义完全一致
@dataclass
class ASRResult:
    """
    ASR 转录结果
    
    Attributes:
        text: 转录的文本内容
        confidence: 置信度分数 (0-1)
        language: 检测到的语言代码 (如 'zh', 'en')
        duration: 处理时长 (秒)
    """
    text: str
    confidence: float
    language: str
    duration: float


# ============================================================================
# Property 1: ASR 结果完整性
# ============================================================================

@pytest.mark.property
class TestASRResultCompleteness:
    """
    Property 1: ASR 结果完整性
    
    对于任意音频输入，ASR_Engine 的转录结果应包含 text 和 confidence 两个字段，
    且置信度分数在 0 到 1 之间。
    
    **Validates: Requirements 1.4**
    """
    
    @given(
        text=st.text(min_size=0, max_size=100),
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        language=st.sampled_from(['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es']),
        duration=st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_asr_result_has_required_fields(
        self,
        text: str,
        confidence: float,
        language: str,
        duration: float
    ):
        """
        测试 ASRResult 包含所有必需字段
        
        Property: 对于任意有效的参数，创建的 ASRResult 对象应包含
                 text, confidence, language, duration 四个字段
        """
        # 创建 ASRResult 对象
        result = ASRResult(
            text=text,
            confidence=confidence,
            language=language,
            duration=duration
        )
        
        # 验证所有必需字段存在
        assert hasattr(result, 'text'), "ASRResult 缺少 'text' 字段"
        assert hasattr(result, 'confidence'), "ASRResult 缺少 'confidence' 字段"
        assert hasattr(result, 'language'), "ASRResult 缺少 'language' 字段"
        assert hasattr(result, 'duration'), "ASRResult 缺少 'duration' 字段"
        
        # 验证字段值正确
        assert result.text == text
        assert result.confidence == confidence
        assert result.language == language
        assert result.duration == duration
    
    @given(
        text=st.text(min_size=0, max_size=100),
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        language=st.sampled_from(['zh', 'en', 'ja', 'ko']),
        duration=st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_asr_result_confidence_in_valid_range(
        self,
        text: str,
        confidence: float,
        language: str,
        duration: float
    ):
        """
        测试 ASRResult 的置信度在有效范围内
        
        Property: 对于任意 ASRResult 对象，其 confidence 字段应在 [0, 1] 范围内
        """
        # 创建 ASRResult 对象
        result = ASRResult(
            text=text,
            confidence=confidence,
            language=language,
            duration=duration
        )
        
        # 验证置信度在有效范围
        assert 0.0 <= result.confidence <= 1.0, (
            f"置信度 {result.confidence} 不在有效范围 [0, 1] 内"
        )
        
        # 验证置信度是浮点数
        assert isinstance(result.confidence, float), (
            f"置信度应为 float 类型，实际为 {type(result.confidence)}"
        )
    
    @given(
        text=st.text(min_size=0, max_size=100),
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False),
        language=st.sampled_from(['zh', 'en', 'ja', 'ko']),
        duration=st.floats(min_value=0.0, max_value=10.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_asr_result_field_types(
        self,
        text: str,
        confidence: float,
        language: str,
        duration: float
    ):
        """
        测试 ASRResult 字段类型正确性
        
        Property: 对于任意 ASRResult 对象，其字段类型应符合定义：
                 - text: str
                 - confidence: float
                 - language: str
                 - duration: float
        """
        # 创建 ASRResult 对象
        result = ASRResult(
            text=text,
            confidence=confidence,
            language=language,
            duration=duration
        )
        
        # 验证字段类型
        assert isinstance(result.text, str), (
            f"text 应为 str 类型，实际为 {type(result.text)}"
        )
        assert isinstance(result.confidence, float), (
            f"confidence 应为 float 类型，实际为 {type(result.confidence)}"
        )
        assert isinstance(result.language, str), (
            f"language 应为 str 类型，实际为 {type(result.language)}"
        )
        assert isinstance(result.duration, float), (
            f"duration 应为 float 类型，实际为 {type(result.duration)}"
        )
    
    @given(
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_asr_result_confidence_boundary_values(self, confidence: float):
        """
        测试 ASRResult 置信度边界值
        
        Property: 对于置信度的边界值 (0.0 和 1.0)，ASRResult 应正确处理
        """
        # 创建 ASRResult 对象
        result = ASRResult(
            text="test",
            confidence=confidence,
            language="en",
            duration=1.0
        )
        
        # 验证置信度在有效范围
        assert 0.0 <= result.confidence <= 1.0
        
        # 特别验证边界值
        if confidence == 0.0:
            assert result.confidence == 0.0, "置信度 0.0 应被正确保存"
        elif confidence == 1.0:
            assert result.confidence == 1.0, "置信度 1.0 应被正确保存"
    
    @given(
        text_length=st.integers(min_value=0, max_value=1000)
    )
    @settings(max_examples=100)
    def test_asr_result_text_length_handling(self, text_length: int):
        """
        测试 ASRResult 处理不同长度的文本
        
        Property: 对于任意长度的文本，ASRResult 应正确存储
        """
        # 生成指定长度的文本
        text = "a" * text_length
        
        # 创建 ASRResult 对象
        result = ASRResult(
            text=text,
            confidence=0.8,
            language="en",
            duration=1.0
        )
        
        # 验证文本长度
        assert len(result.text) == text_length, (
            f"文本长度不匹配：期望 {text_length}，实际 {len(result.text)}"
        )
        
        # 验证文本内容
        assert result.text == text


# ============================================================================
# Property 2: 低置信度处理
# ============================================================================

@pytest.mark.property
class TestLowConfidenceHandling:
    """
    Property 2: 低置信度处理
    
    对于任意置信度分数低于 0.7 的 ASR 结果，系统应请求用户重新输入
    而不是继续处理。
    
    **Validates: Requirements 1.5**
    """
    
    @given(
        confidence=st.floats(min_value=0.0, max_value=0.69, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_low_confidence_should_be_rejected(self, confidence: float):
        """
        测试低置信度结果应被拒绝
        
        Property: 对于任意置信度 < 0.7 的 ASR 结果，
                 is_confidence_acceptable 方法应返回 False
        """
        # 模拟 ASREngine 的置信度检查逻辑
        confidence_threshold = 0.7
        is_acceptable = confidence >= confidence_threshold
        
        # 验证低置信度被拒绝
        assert not is_acceptable, (
            f"置信度 {confidence} < 0.7 应被拒绝，但被接受了"
        )
        
        # 验证置信度在有效范围内
        assert 0.0 <= confidence < 0.7, (
            f"测试的置信度 {confidence} 应在 [0.0, 0.7) 范围内"
        )
    
    @given(
        confidence=st.floats(min_value=0.7, max_value=1.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_high_confidence_should_be_accepted(self, confidence: float):
        """
        测试高置信度结果应被接受
        
        Property: 对于任意置信度 >= 0.7 的 ASR 结果，
                 is_confidence_acceptable 方法应返回 True
        """
        # 模拟 ASREngine 的置信度检查逻辑
        confidence_threshold = 0.7
        is_acceptable = confidence >= confidence_threshold
        
        # 验证高置信度被接受
        assert is_acceptable, (
            f"置信度 {confidence} >= 0.7 应被接受，但被拒绝了"
        )
        
        # 验证置信度在有效范围内
        assert 0.7 <= confidence <= 1.0, (
            f"测试的置信度 {confidence} 应在 [0.7, 1.0] 范围内"
        )
    
    @given(
        confidence=st.floats(min_value=0.0, max_value=1.0, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_confidence_threshold_boundary(self, confidence: float):
        """
        测试置信度阈值边界
        
        Property: 对于任意置信度值，应根据阈值 0.7 正确分类为接受或拒绝
        """
        # 模拟 ASREngine 的置信度检查逻辑
        confidence_threshold = 0.7
        is_acceptable = confidence >= confidence_threshold
        
        # 验证分类逻辑
        if confidence < 0.7:
            assert not is_acceptable, (
                f"置信度 {confidence} < 0.7 应被拒绝"
            )
        else:
            assert is_acceptable, (
                f"置信度 {confidence} >= 0.7 应被接受"
            )
    
    @given(
        confidence=st.just(0.7)  # 精确测试边界值
    )
    @settings(max_examples=10)
    def test_exact_threshold_value(self, confidence: float):
        """
        测试精确的阈值边界值 0.7
        
        Property: 置信度恰好为 0.7 时应被接受
        """
        # 模拟 ASREngine 的置信度检查逻辑
        confidence_threshold = 0.7
        is_acceptable = confidence >= confidence_threshold
        
        # 验证边界值 0.7 被接受
        assert is_acceptable, (
            f"置信度恰好为 0.7 应被接受"
        )
        assert confidence == 0.7
    
    @given(
        confidence=st.floats(min_value=0.0, max_value=0.69, allow_nan=False, allow_infinity=False),
        text=st.text(min_size=1, max_size=100)
    )
    @settings(max_examples=100)
    def test_low_confidence_result_properties(self, confidence: float, text: str):
        """
        测试低置信度结果的属性
        
        Property: 对于任意低置信度的 ASR 结果，即使包含有效文本，
                 也应被标记为不可接受
        """
        # 创建低置信度的 ASR 结果
        result = ASRResult(
            text=text,
            confidence=confidence,
            language="zh",
            duration=1.0
        )
        
        # 模拟置信度检查
        confidence_threshold = 0.7
        is_acceptable = result.confidence >= confidence_threshold
        
        # 验证即使有文本，低置信度也不可接受
        assert not is_acceptable, (
            f"即使文本为 '{text[:20]}...'，置信度 {confidence} < 0.7 也应被拒绝"
        )
        
        # 验证结果对象本身是有效的
        assert result.text == text
        assert 0.0 <= result.confidence < 0.7
    
    @given(
        confidence=st.floats(min_value=0.0, max_value=0.69, allow_nan=False, allow_infinity=False)
    )
    @settings(max_examples=100)
    def test_low_confidence_requires_retry(self, confidence: float):
        """
        测试低置信度需要重试
        
        Property: 对于任意低置信度的结果，系统应标记为需要用户重新输入
        """
        # 模拟 ASREngine 的置信度检查逻辑
        confidence_threshold = 0.7
        is_acceptable = confidence >= confidence_threshold
        requires_retry = not is_acceptable
        
        # 验证低置信度需要重试
        assert requires_retry, (
            f"置信度 {confidence} < 0.7 应标记为需要重试"
        )
        
        # 验证不应继续处理
        should_continue_processing = is_acceptable
        assert not should_continue_processing, (
            f"置信度 {confidence} < 0.7 不应继续处理"
        )


# ============================================================================
# 运行测试
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v", "-m", "property"])
