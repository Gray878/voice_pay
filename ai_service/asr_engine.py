"""
ASR 引擎模块 (ASR Engine)
负责将语音转换为文本，支持中英文混合识别
"""

import logging
from dataclasses import dataclass
from typing import Optional
import time

logger = logging.getLogger(__name__)

# 尝试导入 faster-whisper，如果失败则使用标准 whisper
try:
    from faster_whisper import WhisperModel
    FASTER_WHISPER_AVAILABLE = True
    logger.info("使用 faster-whisper 进行 ASR 推理")
except ImportError:
    FASTER_WHISPER_AVAILABLE = False
    logger.warning("faster-whisper 不可用，将使用标准 whisper")
    try:
        import whisper
        WHISPER_AVAILABLE = True
        logger.info("使用标准 whisper 进行 ASR 推理")
    except ImportError:
        WHISPER_AVAILABLE = False
        logger.error("whisper 和 faster-whisper 都不可用")


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


class ASREngine:
    """
    ASR 引擎
    
    职责：
    - 将语音转换为文本
    - 支持中英文混合识别
    - 提供置信度评分
    - 自动语言检测
    """
    
    def __init__(
        self,
        model_name: str = "large-v3",
        device: str = "cpu",
        compute_type: str = "int8",
        confidence_threshold: float = 0.7
    ):
        """
        初始化 ASR 引擎
        
        Args:
            model_name: Whisper 模型名称，默认 "large-v3" (最高精度)
                       可选: tiny, base, small, medium, large, large-v2, large-v3
            device: 计算设备，默认 "cpu"，可选 "cuda" (需要 GPU)
            compute_type: 计算精度，默认 "int8"
                         faster-whisper 支持: int8, int8_float16, float16, float32
            confidence_threshold: 置信度阈值，默认 0.7
        
        Raises:
            RuntimeError: 如果 Whisper 模型不可用
        """
        if not FASTER_WHISPER_AVAILABLE and not WHISPER_AVAILABLE:
            raise RuntimeError(
                "Whisper 模型不可用。请安装 faster-whisper 或 openai-whisper:\n"
                "pip install faster-whisper 或 pip install openai-whisper"
            )
        
        self.model_name = model_name
        self.device = device
        self.compute_type = compute_type
        self.confidence_threshold = confidence_threshold
        
        # 加载模型
        self._load_model()
        
        logger.info(
            f"ASREngine 初始化完成: model={model_name}, device={device}, "
            f"confidence_threshold={confidence_threshold}"
        )
    
    def _load_model(self):
        """加载 Whisper 模型"""
        try:
            if FASTER_WHISPER_AVAILABLE:
                # 使用 faster-whisper (2-4x 速度提升)
                self.model = WhisperModel(
                    self.model_name,
                    device=self.device,
                    compute_type=self.compute_type
                )
                self.use_faster_whisper = True
                logger.info(f"成功加载 faster-whisper 模型: {self.model_name}")
            else:
                # 使用标准 whisper
                self.model = whisper.load_model(self.model_name, device=self.device)
                self.use_faster_whisper = False
                logger.info(f"成功加载标准 whisper 模型: {self.model_name}")
        except Exception as e:
            logger.error(f"加载 Whisper 模型失败: {e}")
            raise RuntimeError(f"无法加载 Whisper 模型: {e}")
    
    def transcribe(self, audio_data: bytes) -> ASRResult:
        """
        转录音频为文本
        
        Args:
            audio_data: WAV 格式的音频数据 (16-bit PCM, 16kHz 推荐)
        
        Returns:
            ASRResult: 包含文本、置信度、语言和处理时长的结果对象
        
        Raises:
            ValueError: 如果音频数据为空或格式无效
            RuntimeError: 如果转录过程失败
        """
        if not audio_data or len(audio_data) == 0:
            raise ValueError("音频数据为空")
        
        start_time = time.time()
        
        try:
            if self.use_faster_whisper:
                result = self._transcribe_faster_whisper(audio_data)
            else:
                result = self._transcribe_standard_whisper(audio_data)
            
            duration = time.time() - start_time
            
            # 创建结果对象
            asr_result = ASRResult(
                text=result['text'],
                confidence=result['confidence'],
                language=result['language'],
                duration=duration
            )
            
            logger.info(
                f"ASR 转录完成: text='{asr_result.text[:50]}...', "
                f"confidence={asr_result.confidence:.3f}, "
                f"language={asr_result.language}, "
                f"duration={duration:.2f}s"
            )
            
            return asr_result
            
        except Exception as e:
            logger.error(f"ASR 转录失败: {e}")
            raise RuntimeError(f"转录过程失败: {e}")
    
    def _transcribe_faster_whisper(self, audio_data: bytes) -> dict:
        """
        使用 faster-whisper 进行转录
        
        Args:
            audio_data: WAV 格式的音频数据
        
        Returns:
            dict: 包含 text, confidence, language 的字典
        """
        import io
        import soundfile as sf
        
        # 从字节数据读取音频
        audio_buffer = io.BytesIO(audio_data)
        audio_array, sample_rate = sf.read(audio_buffer, dtype='float32')
        
        # 转录音频
        segments, info = self.model.transcribe(
            audio_array,
            language=None,  # 自动检测语言
            beam_size=5,
            vad_filter=True,  # 启用 VAD (Voice Activity Detection)
            vad_parameters=dict(min_silence_duration_ms=500)
        )
        
        # 合并所有片段
        text_segments = []
        confidence_scores = []
        
        for segment in segments:
            text_segments.append(segment.text)
            # faster-whisper 提供平均对数概率，转换为置信度
            # avg_logprob 范围通常是 [-1, 0]，转换为 [0, 1]
            confidence = max(0.0, min(1.0, segment.avg_logprob + 1.0))
            confidence_scores.append(confidence)
        
        # 合并文本
        full_text = " ".join(text_segments).strip()
        
        # 计算平均置信度
        avg_confidence = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores else 0.0
        )
        
        return {
            'text': full_text,
            'confidence': avg_confidence,
            'language': info.language
        }
    
    def _transcribe_standard_whisper(self, audio_data: bytes) -> dict:
        """
        使用标准 whisper 进行转录
        
        Args:
            audio_data: WAV 格式的音频数据
        
        Returns:
            dict: 包含 text, confidence, language 的字典
        """
        import io
        import soundfile as sf
        import torch
        
        # 从字节数据读取音频
        audio_buffer = io.BytesIO(audio_data)
        audio_array, sample_rate = sf.read(audio_buffer, dtype='float32')
        
        # 转录音频
        result = self.model.transcribe(
            audio_array,
            language=None,  # 自动检测语言
            fp16=(self.device == "cuda")  # GPU 使用 fp16
        )
        
        # 提取文本
        text = result['text'].strip()
        
        # 计算置信度 (基于片段的平均对数概率)
        if 'segments' in result and result['segments']:
            # 从片段中提取对数概率
            log_probs = [
                segment.get('avg_logprob', -1.0)
                for segment in result['segments']
            ]
            avg_log_prob = sum(log_probs) / len(log_probs)
            # 转换为置信度 [0, 1]
            confidence = max(0.0, min(1.0, avg_log_prob + 1.0))
        else:
            # 如果没有片段信息，使用默认置信度
            confidence = 0.8
        
        # 提取语言
        language = result.get('language', 'unknown')
        
        return {
            'text': text,
            'confidence': confidence,
            'language': language
        }
    
    def is_confidence_acceptable(self, confidence: float) -> bool:
        """
        检查置信度是否可接受
        
        Args:
            confidence: 置信度分数 (0-1)
        
        Returns:
            bool: 如果置信度高于阈值返回 True，否则返回 False
        """
        return confidence >= self.confidence_threshold
    
    def transcribe_streaming(self, audio_stream):
        """
        流式转录 (未来优化)
        
        Args:
            audio_stream: 音频流
        
        Raises:
            NotImplementedError: 此功能尚未实现
        """
        raise NotImplementedError("流式转录功能尚未实现，将在未来版本中添加")

