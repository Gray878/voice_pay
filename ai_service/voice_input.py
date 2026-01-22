"""
语音输入模块 (Voice Input Module)
负责捕获用户语音输入，进行预处理和降噪
"""

import sounddevice as sd
import soundfile as sf
import numpy as np
from typing import Optional
from io import BytesIO
import logging

# 尝试导入 noisereduce，如果失败则降噪功能不可用
try:
    import noisereduce as nr
    NOISEREDUCE_AVAILABLE = True
except (ImportError, OSError) as e:
    NOISEREDUCE_AVAILABLE = False
    logging.warning(f"noisereduce 不可用，降噪功能将被禁用: {e}")

logger = logging.getLogger(__name__)


class VoiceInputModule:
    """
    语音输入模块
    
    职责：
    - 捕获麦克风输入
    - 静音检测
    - 降噪处理
    """
    
    def __init__(
        self,
        sample_rate: int = 16000,
        channels: int = 1,
        silence_threshold: float = 2.0,
        rms_threshold: float = 0.02
    ):
        """
        初始化语音输入模块
        
        Args:
            sample_rate: 采样率 (Hz)，默认 16000 (Whisper 推荐)
            channels: 声道数，默认 1 (单声道)
            silence_threshold: 静音检测阈值 (秒)，默认 2.0
            rms_threshold: RMS 能量阈值，默认 0.02
        """
        self.sample_rate = sample_rate
        self.channels = channels
        self.silence_threshold = silence_threshold
        self.rms_threshold = rms_threshold
        
        # 录音状态
        self._recording = False
        self._audio_data = []
        self._stream: Optional[sd.InputStream] = None
        
        logger.info(
            f"VoiceInputModule 初始化完成: "
            f"sample_rate={sample_rate}, channels={channels}, "
            f"silence_threshold={silence_threshold}s"
        )
    
    def start_recording(self) -> None:
        """
        激活麦克风开始录音
        
        Raises:
            RuntimeError: 如果录音已经在进行中
        """
        if self._recording:
            raise RuntimeError("录音已经在进行中")
        
        self._recording = True
        self._audio_data = []
        
        # 创建音频流
        self._stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            callback=self._audio_callback,
            dtype=np.float32
        )
        
        self._stream.start()
        logger.info("开始录音")
    
    def stop_recording(self) -> bytes:
        """
        停止录音并返回音频数据
        
        Returns:
            bytes: WAV 格式的音频数据
            
        Raises:
            RuntimeError: 如果录音未开始
        """
        if not self._recording:
            raise RuntimeError("录音未开始")
        
        # 停止音频流
        if self._stream:
            self._stream.stop()
            self._stream.close()
            self._stream = None
        
        self._recording = False
        
        # 合并音频数据
        if not self._audio_data:
            logger.warning("录音数据为空")
            audio_array = np.array([], dtype=np.float32)
        else:
            audio_array = np.concatenate(self._audio_data, axis=0)
        
        logger.info(f"停止录音，录制了 {len(audio_array) / self.sample_rate:.2f} 秒")
        
        # 转换为 WAV 格式的字节数据
        wav_bytes = self._to_wav_bytes(audio_array)
        
        return wav_bytes
    
    def detect_silence(self, audio_data: np.ndarray, threshold: Optional[float] = None) -> bool:
        """
        检测静音，基于 RMS 能量阈值
        
        Args:
            audio_data: 音频数据数组
            threshold: 静音检测时长阈值 (秒)，默认使用初始化时的值
            
        Returns:
            bool: 如果检测到静音超过阈值返回 True，否则返回 False
        """
        if threshold is None:
            threshold = self.silence_threshold
        
        if len(audio_data) == 0:
            return True
        
        # 计算 RMS (Root Mean Square) 能量
        rms = np.sqrt(np.mean(audio_data ** 2))
        
        # 判断是否为静音
        is_silent = rms < self.rms_threshold
        
        if is_silent:
            # 计算静音时长
            silence_duration = len(audio_data) / self.sample_rate
            logger.debug(f"检测到静音: RMS={rms:.4f}, 时长={silence_duration:.2f}s")
            return silence_duration >= threshold
        
        return False
    
    def apply_noise_reduction(self, audio_data: bytes) -> bytes:
        """
        应用降噪算法处理音频
        
        Args:
            audio_data: WAV 格式的音频数据
            
        Returns:
            bytes: 降噪后的 WAV 格式音频数据
            
        Raises:
            RuntimeError: 如果 noisereduce 库不可用
        """
        if not NOISEREDUCE_AVAILABLE:
            logger.warning("noisereduce 不可用，返回原始音频")
            return audio_data
        
        # 从字节数据读取音频
        audio_array, sample_rate = self._from_wav_bytes(audio_data)
        
        if len(audio_array) == 0:
            logger.warning("音频数据为空，跳过降噪")
            return audio_data
        
        # 应用谱减法降噪
        try:
            reduced_noise = nr.reduce_noise(
                y=audio_array,
                sr=sample_rate,
                stationary=True,
                prop_decrease=1.0
            )
            logger.info("降噪处理完成")
        except Exception as e:
            logger.error(f"降噪处理失败: {e}")
            reduced_noise = audio_array
        
        # 转换回 WAV 字节数据
        return self._to_wav_bytes(reduced_noise)
    
    def _audio_callback(self, indata, frames, time, status):
        """
        音频流回调函数
        
        Args:
            indata: 输入音频数据
            frames: 帧数
            time: 时间信息
            status: 状态信息
        """
        if status:
            logger.warning(f"音频流状态: {status}")
        
        if self._recording:
            # 复制音频数据并添加到缓冲区
            self._audio_data.append(indata.copy())
    
    def _to_wav_bytes(self, audio_array: np.ndarray) -> bytes:
        """
        将音频数组转换为 WAV 格式的字节数据
        
        Args:
            audio_array: 音频数据数组
            
        Returns:
            bytes: WAV 格式的字节数据
        """
        buffer = BytesIO()
        
        # 写入 WAV 文件到内存缓冲区
        sf.write(
            buffer,
            audio_array,
            self.sample_rate,
            format='WAV',
            subtype='PCM_16'
        )
        
        # 获取字节数据
        buffer.seek(0)
        wav_bytes = buffer.read()
        
        return wav_bytes
    
    def _from_wav_bytes(self, wav_bytes: bytes) -> tuple[np.ndarray, int]:
        """
        从 WAV 字节数据读取音频数组
        
        Args:
            wav_bytes: WAV 格式的字节数据
            
        Returns:
            tuple: (音频数据数组, 采样率)
        """
        buffer = BytesIO(wav_bytes)
        audio_array, sample_rate = sf.read(buffer, dtype=np.float32)
        
        return audio_array, sample_rate
    
    def is_recording(self) -> bool:
        """
        检查是否正在录音
        
        Returns:
            bool: 如果正在录音返回 True，否则返回 False
        """
        return self._recording
