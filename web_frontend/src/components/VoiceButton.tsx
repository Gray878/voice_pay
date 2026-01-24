import React, { useState, useRef } from 'react';

interface VoiceButtonProps {
  onVoiceInput: (transcript: string) => void;
  disabled?: boolean;
}

const VoiceButton: React.FC<VoiceButtonProps> = ({ onVoiceInput, disabled }) => {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // 初始化 Web Speech API
  const initSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('您的浏览器不支持语音识别功能');
      return null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      const mergedTranscript = `${finalTranscript}${interimTranscript}`.trim();
      if (mergedTranscript) {
        setTranscript(mergedTranscript);
      }
      if (finalTranscript.trim()) {
        onVoiceInput(finalTranscript.trim());
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('语音识别错误:', event.error);
      setIsListening(false);
      if (event.error === 'no-speech') {
        setTranscript('未检测到语音，请再试一次');
        return;
      }
      alert(`语音识别失败: ${event.error}`);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  };

  // 开始录音
  const startListening = () => {
    if (isListening) return;
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeechRecognition();
    }

    if (recognitionRef.current) {
      recognitionRef.current.start();
      setTranscript('');
      setIsListening(true);
    }
  };

  // 停止录音
  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  return (
    <div className="voice-button-container">
      <button
        className={`voice-button ${isListening ? 'listening' : ''}`}
        onClick={isListening ? stopListening : startListening}
        disabled={disabled}
      >
        <svg className="mic-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
        <span className="button-text">
          {isListening ? '正在听...' : '点击说话'}
        </span>
      </button>
      {transcript && (
        <div className="transcript">
          <p>您说: {transcript}</p>
        </div>
      )}
    </div>
  );
};

export default VoiceButton;
