"""
语音输入模块属性测试 (Property-Based Tests)
使用 Hypothesis 进行基于属性的测试
"""

import pytest
import numpy as np
import sys
from pathlib import Path
from hypothesis import given, settings, strategies as st

# 添加父目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from voice_input import VoiceInputModule


@pytest.mark.property
class TestVoiceInputProperties:
    """VoiceInputModule 属性测试"""
    
    @given(
        duration=st.floats(min_value=0.1, max_value=10.0),
        silence_threshold=st.floats(min_value=0.5, max_value=5.0),
        rms_level=st.floats(min_value=0.0001, max_value=0.005)  # 确保远低于 0.02 阈值
    )
    @settings(max_examples=100, deadline=None)
    def test_property_2_silence_detection_logic(
        self,
        duration: float,
        silence_threshold: float,
        rms_level: float
    ):
        """
        Property 2: 静音检测逻辑
        
        测试不同长度静音的检测准确性
        
        属性：
        - 对于任意时长的低能量音频（RMS < rms_threshold），
          如果时长 >= silence_threshold，应检测为静音
        - 如果时长 < silence_threshold，不应检测为静音
        
        Validates: Requirements 1.2
        """
        # 创建 VoiceInputModule 实例
        module = VoiceInputModule(
            sample_rate=16000,
            silence_threshold=silence_threshold,
            rms_threshold=0.02  # 固定 RMS 阈值
        )
        
        # 生成低能量音频（静音）
        # 使用 rms_level 作为标准差，确保 RMS 低于阈值
        # 对于正态分布，RMS ≈ 标准差，所以使用远低于 0.02 的值
        num_samples = int(duration * module.sample_rate)
        silent_audio = np.random.normal(0, rms_level, num_samples).astype(np.float32)
        
        # 验证生成的音频确实是低能量的
        actual_rms = np.sqrt(np.mean(silent_audio ** 2))
        assert actual_rms < module.rms_threshold, (
            f"生成的音频 RMS ({actual_rms:.4f}) 应该低于阈值 ({module.rms_threshold})"
        )
        
        # 计算实际音频时长（考虑采样率离散化）
        actual_duration = len(silent_audio) / module.sample_rate
        
        # 执行静音检测
        is_silent = module.detect_silence(silent_audio, threshold=silence_threshold)
        
        # 验证属性：
        # 如果音频时长 >= silence_threshold，应该检测为静音
        # 如果音频时长 < silence_threshold，不应该检测为静音
        # 使用实际时长而不是输入的 duration，因为采样率会导致离散化
        if actual_duration >= silence_threshold:
            assert is_silent, (
                f"应该检测到静音: actual_duration={actual_duration:.6f}s >= "
                f"threshold={silence_threshold:.6f}s, "
                f"actual RMS={actual_rms:.4f}, rms_level={rms_level:.4f}"
            )
        else:
            assert not is_silent, (
                f"不应该检测到静音: actual_duration={actual_duration:.6f}s < "
                f"threshold={silence_threshold:.6f}s, "
                f"actual RMS={actual_rms:.4f}, rms_level={rms_level:.4f}"
            )
    
    @given(
        duration=st.floats(min_value=0.1, max_value=10.0),
        silence_threshold=st.floats(min_value=0.5, max_value=5.0),
        rms_level=st.floats(min_value=0.05, max_value=1.0)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_2_active_audio_not_silent(
        self,
        duration: float,
        silence_threshold: float,
        rms_level: float
    ):
        """
        Property 2: 静音检测逻辑 - 有声音频
        
        测试高能量音频不应被检测为静音
        
        属性：
        - 对于任意时长的高能量音频（RMS > rms_threshold），
          无论时长多长，都不应检测为静音
        
        Validates: Requirements 1.2
        """
        # 创建 VoiceInputModule 实例
        module = VoiceInputModule(
            sample_rate=16000,
            silence_threshold=silence_threshold,
            rms_threshold=0.02  # 固定 RMS 阈值
        )
        
        # 生成高能量音频（有声）
        # 使用 rms_level 作为标准差，确保 RMS 高于阈值
        num_samples = int(duration * module.sample_rate)
        active_audio = np.random.normal(0, rms_level, num_samples).astype(np.float32)
        
        # 执行静音检测
        is_silent = module.detect_silence(active_audio, threshold=silence_threshold)
        
        # 验证属性：高能量音频不应该被检测为静音
        assert not is_silent, (
            f"高能量音频不应该检测为静音: duration={duration:.2f}s, "
            f"threshold={silence_threshold:.2f}s, "
            f"RMS level={rms_level:.4f}"
        )
    
    @given(
        silence_threshold=st.floats(min_value=0.5, max_value=5.0)
    )
    @settings(max_examples=50, deadline=None)
    def test_property_2_empty_audio_is_silent(
        self,
        silence_threshold: float
    ):
        """
        Property 2: 静音检测逻辑 - 空音频
        
        测试空音频应始终被检测为静音
        
        属性：
        - 对于任意 silence_threshold，空音频应该被检测为静音
        
        Validates: Requirements 1.2
        """
        # 创建 VoiceInputModule 实例
        module = VoiceInputModule(
            sample_rate=16000,
            silence_threshold=silence_threshold
        )
        
        # 空音频
        empty_audio = np.array([], dtype=np.float32)
        
        # 执行静音检测
        is_silent = module.detect_silence(empty_audio, threshold=silence_threshold)
        
        # 验证属性：空音频应该被检测为静音
        assert is_silent, (
            f"空音频应该被检测为静音: threshold={silence_threshold:.2f}s"
        )
    
    @given(
        duration=st.floats(min_value=0.1, max_value=10.0),
        silence_threshold_1=st.floats(min_value=0.5, max_value=3.0),
        silence_threshold_2=st.floats(min_value=3.1, max_value=5.0)
    )
    @settings(max_examples=100, deadline=None)
    def test_property_2_threshold_consistency(
        self,
        duration: float,
        silence_threshold_1: float,
        silence_threshold_2: float
    ):
        """
        Property 2: 静音检测逻辑 - 阈值一致性
        
        测试不同阈值下的检测一致性
        
        属性：
        - 对于相同的音频，使用更高的阈值应该更不容易检测到静音
        - 如果在高阈值下检测到静音，在低阈值下也应该检测到静音
        
        Validates: Requirements 1.2
        """
        # 创建 VoiceInputModule 实例
        module = VoiceInputModule(sample_rate=16000)
        
        # 生成低能量音频（静音）
        num_samples = int(duration * module.sample_rate)
        silent_audio = np.random.normal(0, 0.001, num_samples).astype(np.float32)
        
        # 使用两个不同的阈值进行检测
        is_silent_low = module.detect_silence(silent_audio, threshold=silence_threshold_1)
        is_silent_high = module.detect_silence(silent_audio, threshold=silence_threshold_2)
        
        # 验证属性：如果在高阈值下检测到静音，在低阈值下也应该检测到静音
        if is_silent_high:
            assert is_silent_low, (
                f"阈值一致性失败: duration={duration:.2f}s, "
                f"low_threshold={silence_threshold_1:.2f}s (silent={is_silent_low}), "
                f"high_threshold={silence_threshold_2:.2f}s (silent={is_silent_high})"
            )
