import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpeechRecognitionSupport, VoiceAction, VoiceControllerOptions, VoiceError, VoiceMessage, VoiceState } from './voiceTypes';
import { cleanForSpeech, isDone, isSelfSpeechEcho, pickFemaleVoice, truncateToWords } from './voiceUtils';
import { assistantApi } from '../api-client';

const GREETING = "Hey, I'm Approve. How do you want me to help you?";
const CLOSING_FAREWELL = "Happy to help with your approvals! Have a great day.";

type SpeechRecognitionInstance = unknown;

export function useVoiceController(options: VoiceControllerOptions = {}) {
  const [state, setState] = useState<VoiceState>('idle');
  const stateRef = useRef<VoiceState>('idle');
  const activeRef = useRef<boolean>(false);
  const recRef = useRef<SpeechRecognitionInstance | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  // Self-speech echo suppression refs
  const lastSpokenAssistantTextRef = useRef<string>('');
  const speechEndTimeRef = useRef<number>(0);
  const lastProcessedUserTextRef = useRef<string>('');
  const lastProcessedUserTimeRef = useRef<number>(0);

  // Store all callbacks in refs to avoid stale closures inside speech event listeners
  const cbTranscript = useRef(options.onTranscript);
  const cbAnswer = useRef(options.onAnswer);
  const cbStateChange = useRef(options.onStateChange);
  const cbError = useRef(options.onError);
  const cbAction = useRef(options.onAction);
  const projectIdRef = useRef(options.projectId);
  const tokenRef = useRef(options.token);

  useEffect(() => {
    cbTranscript.current = options.onTranscript;
    cbAnswer.current = options.onAnswer;
    cbStateChange.current = options.onStateChange;
    cbError.current = options.onError;
    cbAction.current = options.onAction;
    projectIdRef.current = options.projectId;
    tokenRef.current = options.token;
  });

  const isSupported: SpeechRecognitionSupport = {
    stt: typeof window !== 'undefined' && Boolean(
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    ),
    tts: typeof window !== 'undefined' && 'speechSynthesis' in window,
  };

  const setVoiceState = useCallback((nextState: VoiceState) => {
    stateRef.current = nextState;
    setState(nextState);
    cbStateChange.current?.(nextState);
  }, []);

  const emitError = useCallback((err: VoiceError) => {
    cbError.current?.(err);
  }, []);

  const stopRecognition = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recRef.current) {
      try {
        (recRef.current as { stop?: () => void }).stop?.();
      } catch {
        // Ignore
      }
      recRef.current = null;
    }
  }, []);

  const activeUttRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel(); // cancel any active utterance

      const doSpeak = () => {
        const cleaned = cleanForSpeech(text);
        if (!cleaned) {
          resolve();
          return;
        }

        lastSpokenAssistantTextRef.current = cleaned;

        const words = cleaned.split(/\s+/).length;
        // Dynamic duration: ~140 wpm + 600ms buffer, bounded between 2s and 10s
        const maxDurationMs = Math.min(Math.max((words / 2.3) * 1000 + 600, 2000), 10000);

        const utt = new SpeechSynthesisUtterance(truncateToWords(cleaned, 500));
        activeUttRef.current = utt;
        (window as unknown as { __activeVoiceUtt?: unknown }).__activeVoiceUtt = utt;

        const voice = pickFemaleVoice();
        if (voice) utt.voice = voice;
        utt.rate = 1.05;
        utt.pitch = 1.15; // slightly elevated for friendly, natural clarity
        utt.volume = 1.0;

        let isResolved = false;
        const done = () => {
          if (isResolved) return;
          isResolved = true;
          activeUttRef.current = null;
          (window as unknown as { __activeVoiceUtt?: unknown }).__activeVoiceUtt = null;
          clearInterval(keepAlive);
          clearTimeout(safetyTimer);
          speechEndTimeRef.current = Date.now();
          resolve();
        };

        const safetyTimer = setTimeout(done, maxDurationMs);

        // Chromium speech synthesis bug workaround: keep synthesis active
        const keepAlive = setInterval(() => {
          if (!window.speechSynthesis.speaking) {
            done();
          } else {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
          }
        }, 1200);

        utt.onend = done;
        utt.onerror = done;

        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utt);
      };

      if (window.speechSynthesis.getVoices().length > 0) {
        doSpeak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          window.speechSynthesis.onvoiceschanged = null;
          doSpeak();
        };
        setTimeout(() => {
          if (window.speechSynthesis.getVoices().length === 0) doSpeak();
        }, 200);
      }
    });
  }, []);

  const processTranscript = useCallback(async (transcript: string) => {
    if (!activeRef.current) return;
    const text = transcript.trim();
    if (!text) {
      startListening();
      return;
    }

    // 0. Double-check self-speech echo suppression
    const timeSinceSpeech = Date.now() - speechEndTimeRef.current;
    if (isSelfSpeechEcho(text, lastSpokenAssistantTextRef.current, timeSinceSpeech)) {
      console.warn('[VoiceController] Suppressed echo in processTranscript:', text);
      if (activeRef.current) {
        setTimeout(() => startListening(), 200);
      }
      return;
    }

    // 1. Immediately emit user message to chat UI
    const userMsg: VoiceMessage = {
      id: crypto.randomUUID?.() || String(Date.now()),
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    };
    cbAnswer.current?.(userMsg);
    cbTranscript.current?.('', true);

    // Record user message in multi-turn conversation history
    historyRef.current.push({ role: 'user', content: text });

    // 2. Exit check
    if (isDone(text)) {
      setVoiceState('speaking');
      const farewellMsg: VoiceMessage = {
        id: crypto.randomUUID?.() || String(Date.now()),
        role: 'assistant',
        text: CLOSING_FAREWELL,
        spokenText: CLOSING_FAREWELL,
        timestamp: new Date().toISOString(),
      };
      cbAnswer.current?.(farewellMsg);
      await speak(CLOSING_FAREWELL);
      setVoiceState('idle');
      activeRef.current = false;
      return;
    }

    setVoiceState('processing');

    try {
      const targetProjectId = projectIdRef.current;
      const token = tokenRef.current || undefined;

      let res: { reply: string; spokenText?: string; actions?: VoiceAction[] } | null = null;

      if (targetProjectId && token) {
        try {
          res = await assistantApi.chatTurn(
            targetProjectId,
            text,
            historyRef.current.slice(-6),
            token,
          );
        } catch {
          // If project-scoped chat 401s/404s, fall through to general platform assistant
          res = null;
        }
      }

      if (!res) {
        try {
          res = await assistantApi.generalChatTurn(
            text,
            historyRef.current.slice(-6),
            token,
          );
        } catch {
          // Offline fallback
          res = null;
        }
      }

      const reply = res?.reply || res?.spokenText || "I'm Approve, your voice copilot. I can help navigate your compliance roadmap, inspect required documents, or check government schemes and subsidies.";
      const spoken = res?.spokenText || reply;

      const assistantMsg: VoiceMessage = {
        id: crypto.randomUUID?.() || String(Date.now()),
        role: 'assistant',
        text: reply,
        spokenText: spoken,
        timestamp: new Date().toISOString(),
        actions: res?.actions as VoiceAction[] | undefined,
      };

      historyRef.current.push({ role: 'assistant', content: reply });
      cbAnswer.current?.(assistantMsg);

      // Execute structured navigation action if present
      if (res?.actions && res.actions.length > 0) {
        cbAction.current?.(res.actions[0] as VoiceAction);
      }

      if (!activeRef.current) return;

      setVoiceState('speaking');
      await speak(spoken);

      if (!activeRef.current) return;

      // Acoustic settling buffer: allow speaker audio to fully clear before listening
      await new Promise((r) => setTimeout(r, 450));

      if (!activeRef.current) return;

      // Automatically loop back to listening for follow-up questions
      startListening();
    } catch {
      const errMsg = "I'm Approve. You can ask me about your approval roadmap, required licenses, government schemes, or navigate across the dashboard.";
      const assistantMsg: VoiceMessage = {
        id: crypto.randomUUID?.() || String(Date.now()),
        role: 'assistant',
        text: errMsg,
        spokenText: errMsg,
        timestamp: new Date().toISOString(),
      };
      cbAnswer.current?.(assistantMsg);
      setVoiceState('speaking');
      await speak(errMsg);
      if (!activeRef.current) return;
      await new Promise((r) => setTimeout(r, 450));
      if (!activeRef.current) return;
      startListening();
    }
  }, [setVoiceState, speak]);

  const startListening = useCallback(() => {
    if (!activeRef.current || typeof window === 'undefined') return;
    stopRecognition();

    const winObj = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        maxAlternatives: number;
        onresult: (e: { resultIndex: number; results: Array<Array<{ transcript: string }> & { isFinal?: boolean }> }) => void;
        onerror: (e: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        maxAlternatives: number;
        onresult: (e: { resultIndex: number; results: Array<Array<{ transcript: string }> & { isFinal?: boolean }> }) => void;
        onerror: (e: { error: string }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const Ctor = winObj.SpeechRecognition ?? winObj.webkitSpeechRecognition;
    if (!Ctor) {
      emitError({ code: 'STT_UNSUPPORTED', message: 'Speech recognition is not supported in this browser. Please type your query below.' });
      setVoiceState('idle');
      return;
    }

    setVoiceState('listening');
    const rec = new Ctor();

    rec.continuous = false; // Discrete per-utterance cycle for instant commit on speech end
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;
    recRef.current = rec;

    let latestSpoken = '';

    rec.onresult = (event) => {
      let interim = '';
      let finals = '';

      for (let i = 0; i < event.results.length; i++) {
        const item = event.results[i];
        if (!item || !item[0]) continue;
        const t = item[0].transcript;
        if (item.isFinal) {
          finals += ' ' + t;
        } else {
          interim += ' ' + t;
        }
      }

      const text = (finals || interim).trim();
      if (text) {
        latestSpoken = text;
        cbTranscript.current?.(text, false);
      }
    };

    rec.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      if (event.error === 'not-allowed') {
        emitError({ code: 'MIC_DENIED', message: 'Microphone permission was denied. Please allow microphone access in your browser settings.' });
        stopRecognition();
        setVoiceState('idle');
        activeRef.current = false;
        return;
      }
      if (activeRef.current) {
        setTimeout(() => startListening(), 250);
      }
    };

    rec.onend = () => {
      recRef.current = null;
      if (!activeRef.current) return;

      const toProcess = latestSpoken.trim();
      latestSpoken = '';

      if (toProcess) {
        // Echo filter: if this transcript is the tail of what the assistant just spoke, discard it
        const timeSinceSpeech = Date.now() - speechEndTimeRef.current;
        if (isSelfSpeechEcho(toProcess, lastSpokenAssistantTextRef.current, timeSinceSpeech)) {
          console.warn('[VoiceController] Acoustic echo detected and suppressed:', toProcess);
          if (activeRef.current) {
            setTimeout(() => startListening(), 200);
          }
          return;
        }

        // Duplicate loop suppression (repeated identical utterance within 4 seconds)
        if (
          toProcess.toLowerCase() === lastProcessedUserTextRef.current.toLowerCase() &&
          Date.now() - lastProcessedUserTimeRef.current < 4000
        ) {
          console.warn('[VoiceController] Duplicate loop utterance suppressed:', toProcess);
          if (activeRef.current) {
            setTimeout(() => startListening(), 200);
          }
          return;
        }

        lastProcessedUserTextRef.current = toProcess;
        lastProcessedUserTimeRef.current = Date.now();
        processTranscript(toProcess);
      } else if (stateRef.current === 'listening') {
        setTimeout(() => startListening(), 100);
      }
    };

    try {
      rec.start();
    } catch {
      if (activeRef.current) {
        setTimeout(() => startListening(), 300);
      }
    }
  }, [emitError, processTranscript, setVoiceState, stopRecognition]);

  const startSession = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    historyRef.current = [];
    lastSpokenAssistantTextRef.current = GREETING;
    lastProcessedUserTextRef.current = '';

    // Greeting turn
    setVoiceState('speaking');
    const greetingMsg: VoiceMessage = {
      id: crypto.randomUUID?.() || String(Date.now()),
      role: 'assistant',
      text: GREETING,
      spokenText: GREETING,
      timestamp: new Date().toISOString(),
    };
    cbAnswer.current?.(greetingMsg);

    await speak(GREETING);
    if (!activeRef.current) return;

    // Settling delay before listening
    await new Promise((r) => setTimeout(r, 450));
    if (!activeRef.current) return;

    startListening();
  }, [setVoiceState, speak, startListening]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    stopRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
  }, [setVoiceState, stopRecognition]);

  const sendTextMessage = useCallback((text: string) => {
    if (!text.trim()) return;
    if (!activeRef.current) {
      activeRef.current = true;
    }
    stopRecognition();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    processTranscript(text);
  }, [processTranscript, stopRecognition]);

  return {
    state,
    startSession,
    stopSession,
    startListening,
    sendTextMessage,
    isSupported,
  };
}

