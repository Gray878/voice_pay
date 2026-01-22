"""
ASR 引擎使用示例
演示如何使用 ASREngine 进行语音转文本
"""

import sys
import os

# 添加父目录到路径
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from asr_engine import ASREngine, ASRResult
from voice_input import VoiceInputModule
import logging

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def example_transcribe_from_file():
    """示例：从音频文件转录"""
    print("\n=== 示例 1: 从音频文件转录 ===")
    
    # 初始化 ASR 引擎
    # 注意：首次运行会下载模型，可能需要一些时间
    asr = ASREngine(
        model_name="base",  # 使用较小的模型以加快演示速度
        device="cpu",
        confidence_threshold=0.7
    )
    
    # 读取测试音频文件
    audio_file = "test_audio.wav"
    
    if not os.path.exists(audio_file):
        print(f"警告: 测试音频文件 {audio_file} 不存在")
        print("请准备一个 WAV 格式的音频文件进行测试")
        return
    
    with open(audio_file, 'rb') as f:
        audio_data = f.read()
    
    # 转录音频
    result = asr.transcribe(audio_data)
    
    # 显示结果
    print(f"转录文本: {result.text}")
    print(f"置信度: {result.confidence:.3f}")
    print(f"语言: {result.language}")
    print(f"处理时长: {result.duration:.2f} 秒")
    
    # 检查置信度
    if asr.is_confidence_acceptable(result.confidence):
        print("✓ 置信度可接受")
    else:
        print("✗ 置信度过低，建议重新录音")


def example_transcribe_from_microphone():
    """示例：从麦克风录音并转录"""
    print("\n=== 示例 2: 从麦克风录音并转录 ===")
    
    # 初始化语音输入模块
    voice_input = VoiceInputModule(
        sample_rate=16000,
        silence_threshold=2.0
    )
    
    # 初始化 ASR 引擎
    asr = ASREngine(
        model_name="base",
        device="cpu"
    )
    
    print("请说话...")
    
    # 开始录音
    voice_input.start_recording()
    
    # 等待用户输入 (实际应用中应该有更好的停止机制)
    input("按 Enter 键停止录音...")
    
    # 停止录音并获取音频数据
    audio_data = voice_input.stop_recording()
    
    print("正在转录...")
    
    # 转录音频
    result = asr.transcribe(audio_data)
    
    # 显示结果
    print(f"\n转录文本: {result.text}")
    print(f"置信度: {result.confidence:.3f}")
    print(f"语言: {result.language}")
    print(f"处理时长: {result.duration:.2f} 秒")


def example_with_noise_reduction():
    """示例：结合降噪的完整流程"""
    print("\n=== 示例 3: 结合降噪的完整流程 ===")
    
    # 初始化模块
    voice_input = VoiceInputModule(sample_rate=16000)
    asr = ASREngine(model_name="base", device="cpu")
    
    # 读取或录制音频
    audio_file = "test_audio.wav"
    
    if os.path.exists(audio_file):
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
    else:
        print("请说话...")
        voice_input.start_recording()
        input("按 Enter 键停止录音...")
        audio_data = voice_input.stop_recording()
    
    # 应用降噪
    print("正在降噪...")
    audio_data = voice_input.apply_noise_reduction(audio_data)
    
    # 转录音频
    print("正在转录...")
    result = asr.transcribe(audio_data)
    
    # 显示结果
    print(f"\n转录文本: {result.text}")
    print(f"置信度: {result.confidence:.3f}")
    print(f"语言: {result.language}")


def example_multiple_languages():
    """示例：测试多语言支持"""
    print("\n=== 示例 4: 多语言支持测试 ===")
    
    asr = ASREngine(model_name="base", device="cpu")
    
    test_files = [
        ("chinese_audio.wav", "中文"),
        ("english_audio.wav", "英文"),
        ("mixed_audio.wav", "中英混合")
    ]
    
    for audio_file, description in test_files:
        if not os.path.exists(audio_file):
            print(f"跳过 {description} 测试 (文件不存在: {audio_file})")
            continue
        
        print(f"\n测试 {description}:")
        
        with open(audio_file, 'rb') as f:
            audio_data = f.read()
        
        result = asr.transcribe(audio_data)
        
        print(f"  文本: {result.text}")
        print(f"  检测语言: {result.language}")
        print(f"  置信度: {result.confidence:.3f}")


if __name__ == "__main__":
    print("ASR 引擎示例程序")
    print("=" * 50)
    
    # 运行示例
    try:
        # 示例 1: 从文件转录
        example_transcribe_from_file()
        
        # 示例 2: 从麦克风录音 (需要用户交互)
        # example_transcribe_from_microphone()
        
        # 示例 3: 结合降噪
        # example_with_noise_reduction()
        
        # 示例 4: 多语言测试
        # example_multiple_languages()
        
    except Exception as e:
        logger.error(f"示例运行失败: {e}", exc_info=True)
        print(f"\n错误: {e}")
        print("\n提示:")
        print("1. 确保已安装所有依赖: pip install -r requirements.txt")
        print("2. 首次运行会下载 Whisper 模型，需要网络连接")
        print("3. 准备测试音频文件 (WAV 格式, 16kHz)")

