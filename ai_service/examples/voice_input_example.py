"""
语音输入模块使用示例
演示如何使用 VoiceInputModule 捕获和处理语音输入
"""

import sys
from pathlib import Path

# 添加父目录到 Python 路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from voice_input import VoiceInputModule
import time


def example_basic_recording():
    """基础录音示例"""
    print("=== 基础录音示例 ===")
    
    # 创建语音输入模块实例
    module = VoiceInputModule(
        sample_rate=16000,
        channels=1,
        silence_threshold=2.0
    )
    
    print("开始录音，请说话...")
    module.start_recording()
    
    # 录音 5 秒
    time.sleep(5)
    
    print("停止录音")
    audio_data = module.stop_recording()
    
    print(f"录音完成，音频数据大小: {len(audio_data)} 字节")
    
    return audio_data


def example_silence_detection():
    """静音检测示例"""
    print("\n=== 静音检测示例 ===")
    
    import numpy as np
    
    module = VoiceInputModule(sample_rate=16000, silence_threshold=2.0)
    
    # 生成测试音频
    silent_audio = np.random.normal(0, 0.001, 16000 * 3).astype(np.float32)
    active_audio = np.random.normal(0, 0.5, 16000 * 3).astype(np.float32)
    
    # 检测静音
    is_silent_1 = module.detect_silence(silent_audio)
    is_silent_2 = module.detect_silence(active_audio)
    
    print(f"静音音频检测结果: {is_silent_1}")  # 应该是 True
    print(f"有声音频检测结果: {is_silent_2}")  # 应该是 False


def example_noise_reduction(audio_data):
    """降噪处理示例"""
    print("\n=== 降噪处理示例 ===")
    
    module = VoiceInputModule()
    
    print("应用降噪处理...")
    reduced_audio = module.apply_noise_reduction(audio_data)
    
    print(f"降噪前大小: {len(audio_data)} 字节")
    print(f"降噪后大小: {len(reduced_audio)} 字节")
    
    return reduced_audio


def example_auto_stop_on_silence():
    """自动静音停止示例（模拟）"""
    print("\n=== 自动静音停止示例 ===")
    
    import numpy as np
    
    module = VoiceInputModule(sample_rate=16000, silence_threshold=2.0)
    
    # 模拟录音过程中的静音检测
    print("模拟录音过程...")
    
    # 模拟 3 秒有声音频
    active_audio = np.random.normal(0, 0.5, 16000 * 3).astype(np.float32)
    print(f"前 3 秒有声音频，静音检测: {module.detect_silence(active_audio)}")
    
    # 模拟 3 秒静音
    silent_audio = np.random.normal(0, 0.001, 16000 * 3).astype(np.float32)
    is_silent = module.detect_silence(silent_audio)
    print(f"后 3 秒静音，静音检测: {is_silent}")
    
    if is_silent:
        print("检测到静音超过阈值，自动停止录音")


def main():
    """主函数"""
    print("语音输入模块使用示例\n")
    
    try:
        # 示例 1: 基础录音（需要麦克风）
        # 注意：在没有麦克风的环境中会失败
        # audio_data = example_basic_recording()
        
        # 示例 2: 静音检测
        example_silence_detection()
        
        # 示例 3: 降噪处理（使用模拟数据）
        import numpy as np
        module = VoiceInputModule()
        test_audio = np.random.randn(16000).astype(np.float32) * 0.5
        audio_bytes = module._to_wav_bytes(test_audio)
        example_noise_reduction(audio_bytes)
        
        # 示例 4: 自动静音停止
        example_auto_stop_on_silence()
        
        print("\n所有示例执行完成！")
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
