"""
语音输入模块单元测试
"""

import pytest
import numpy as np
import sys
from pathlib import Path

# 添加父目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from voice_input import VoiceInputModule


class TestVoiceInputModule:
    """VoiceInputModule 单元测试"""
    
    def test_initialization(self):
        """测试模块初始化"""
        module = VoiceInputModule(
            sample_rate=16000,
            channels=1,
            silence_threshold=2.0,
            rms_threshold=0.02
        )
        
        assert module.sample_rate == 16000
        assert module.channels == 1
        assert module.silence_threshold == 2.0
        assert module.rms_threshold == 0.02
        assert not module.is_recording()
    
    def test_detect_silence_with_silent_audio(self):
        """测试静音检测 - 静音音频"""
        module = VoiceInputModule(sample_rate=16000, silence_threshold=2.0)
        
        # 生成 3 秒的静音音频 (低能量)
        silent_audio = np.random.normal(0, 0.001, 16000 * 3).astype(np.float32)
        
        # 应该检测到静音 (超过 2 秒阈值)
        assert module.detect_silence(silent_audio)
    
    def test_detect_silence_with_active_audio(self):
        """测试静音检测 - 有声音频"""
        module = VoiceInputModule(sample_rate=16000, silence_threshold=2.0)
        
        # 生成 3 秒的有声音频 (高能量)
        active_audio = np.random.normal(0, 0.5, 16000 * 3).astype(np.float32)
        
        # 不应该检测到静音
        assert not module.detect_silence(active_audio)
    
    def test_detect_silence_with_short_duration(self):
        """测试静音检测 - 短时长静音"""
        module = VoiceInputModule(sample_rate=16000, silence_threshold=2.0)
        
        # 生成 1 秒的静音音频 (低于 2 秒阈值)
        short_silent_audio = np.random.normal(0, 0.001, 16000).astype(np.float32)
        
        # 不应该检测到静音 (未超过阈值)
        assert not module.detect_silence(short_silent_audio)
    
    def test_detect_silence_with_empty_audio(self):
        """测试静音检测 - 空音频"""
        module = VoiceInputModule()
        
        empty_audio = np.array([], dtype=np.float32)
        
        # 空音频应该被视为静音
        assert module.detect_silence(empty_audio)
    
    def test_apply_noise_reduction(self):
        """测试降噪处理"""
        module = VoiceInputModule(sample_rate=16000)
        
        # 生成带噪音的音频
        clean_signal = np.sin(2 * np.pi * 440 * np.arange(16000) / 16000).astype(np.float32)
        noise = np.random.normal(0, 0.1, 16000).astype(np.float32)
        noisy_audio = clean_signal + noise
        
        # 转换为 WAV 字节
        wav_bytes = module._to_wav_bytes(noisy_audio)
        
        # 应用降噪（如果 noisereduce 不可用，会返回原始数据）
        reduced_wav = module.apply_noise_reduction(wav_bytes)
        
        # 验证返回的是字节数据
        assert isinstance(reduced_wav, bytes)
        assert len(reduced_wav) > 0
    
    def test_apply_noise_reduction_with_empty_audio(self):
        """测试降噪处理 - 空音频"""
        module = VoiceInputModule(sample_rate=16000)
        
        # 空音频
        empty_audio = np.array([], dtype=np.float32)
        wav_bytes = module._to_wav_bytes(empty_audio)
        
        # 应该返回原始数据
        reduced_wav = module.apply_noise_reduction(wav_bytes)
        assert isinstance(reduced_wav, bytes)
    
    def test_to_wav_bytes_conversion(self):
        """测试音频数组到 WAV 字节的转换"""
        module = VoiceInputModule(sample_rate=16000)
        
        # 生成测试音频
        audio_array = np.random.randn(16000).astype(np.float32)
        
        # 转换为 WAV 字节
        wav_bytes = module._to_wav_bytes(audio_array)
        
        assert isinstance(wav_bytes, bytes)
        assert len(wav_bytes) > 0
    
    def test_from_wav_bytes_conversion(self):
        """测试 WAV 字节到音频数组的转换"""
        module = VoiceInputModule(sample_rate=16000)
        
        # 生成测试音频（限制在 [-0.9, 0.9] 范围内以避免 PCM_16 裁剪）
        original_audio = (np.random.rand(16000) * 1.8 - 0.9).astype(np.float32)
        wav_bytes = module._to_wav_bytes(original_audio)
        
        # 从 WAV 字节读取
        audio_array, sample_rate = module._from_wav_bytes(wav_bytes)
        
        assert sample_rate == 16000
        assert len(audio_array) == len(original_audio)
        # 验证数据相似 (WAV PCM_16 格式会有精度损失)
        # PCM_16 的量化误差约为 1/32768 ≈ 0.00003
        assert np.allclose(audio_array, original_audio, atol=0.0001)
    
    def test_start_recording_raises_if_already_recording(self):
        """测试重复开始录音会抛出异常"""
        module = VoiceInputModule()
        
        module.start_recording()
        
        # 尝试再次开始录音应该抛出异常
        with pytest.raises(RuntimeError, match="录音已经在进行中"):
            module.start_recording()
        
        # 清理
        module.stop_recording()
    
    def test_stop_recording_raises_if_not_recording(self):
        """测试未开始录音就停止会抛出异常"""
        module = VoiceInputModule()
        
        # 未开始录音就停止应该抛出异常
        with pytest.raises(RuntimeError, match="录音未开始"):
            module.stop_recording()
    
    def test_recording_state_management(self):
        """测试录音状态管理"""
        module = VoiceInputModule()
        
        # 初始状态
        assert not module.is_recording()
        
        # 开始录音
        module.start_recording()
        assert module.is_recording()
        
        # 停止录音
        wav_bytes = module.stop_recording()
        assert not module.is_recording()
        assert isinstance(wav_bytes, bytes)
