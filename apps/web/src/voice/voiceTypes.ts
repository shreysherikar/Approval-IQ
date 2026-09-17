export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface VoiceAction {
  type: 'navigate';
  target: 'roadmap' | 'schemes' | 'profile' | 'vault' | 'time-cost' | 'inspections' | 'grievances';
  entityId?: string;
  label?: string;
}

export interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  spokenText?: string | undefined;
  timestamp: string;
  actions?: VoiceAction[] | undefined;
}


export interface VoiceError {
  code: 'MIC_DENIED' | 'STT_UNSUPPORTED' | 'TTS_UNSUPPORTED' | 'NETWORK_ERROR' | 'API_ERROR';
  message: string;
}

export interface VoiceControllerOptions {
  projectId?: string | undefined;
  token?: string | null | undefined;
  onTranscript?: ((transcript: string, isFinal: boolean) => void) | undefined;
  onAnswer?: ((message: VoiceMessage) => void) | undefined;
  onStateChange?: ((state: VoiceState) => void) | undefined;
  onError?: ((error: VoiceError) => void) | undefined;
  onAction?: ((action: VoiceAction) => void) | undefined;
}


export interface SpeechRecognitionSupport {
  stt: boolean;
  tts: boolean;
}
