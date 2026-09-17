import React, { createContext, useContext, useEffect, useRef, useState } from 'react';

import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { VoiceAction, VoiceError, VoiceMessage, VoiceState, SpeechRecognitionSupport } from './voiceTypes';
import { useVoiceController } from './useVoiceController';
import { WakeWordListener } from './wakeWordListener';
import { ApproveMicButton } from './ApproveMicButton';
import { ApproveSessionOverlay } from './ApproveSessionOverlay';
import { useAuth } from '../auth';
import { get } from '../api-client';

interface VoiceContextValue {
  voiceState: VoiceState;
  startSession: () => Promise<void>;
  stopSession: () => void;
  sendTextMessage: (text: string) => void;
  isSupported: SpeechRecognitionSupport;
  isOverlayOpen: boolean;
  openOverlay: () => void;
  closeOverlay: () => void;
}

const VoiceContext = createContext<VoiceContextValue | null>(null);

export function useVoice(): VoiceContextValue {
  const ctx = useContext(VoiceContext);
  if (!ctx) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return ctx;
}

interface VoiceProviderProps {
  children: React.ReactNode;
}

export function VoiceProvider({ children }: VoiceProviderProps): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id?: string; projectId?: string }>();
  const { accessToken, isAuthenticated } = useAuth();

  const [fallbackProjectId, setFallbackProjectId] = useState<string | undefined>(undefined);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [voiceError, setVoiceError] = useState<VoiceError | null>(null);

  // Resolve current active project ID from URL if available
  const activeProjectId =
    params.id ||
    params.projectId ||
    (location.pathname.startsWith('/projects/') ? location.pathname.split('/')[2] : undefined) ||
    fallbackProjectId;

  // Auto-fetch user's default project if logged in and not on a specific project route
  useEffect(() => {
    if (!isAuthenticated || !accessToken || fallbackProjectId) return;
    get<Array<{ id: string; name: string }>>('/projects', { token: accessToken })
      .then((projects) => {
        if (Array.isArray(projects) && projects.length > 0 && projects[0]?.id) {
          setFallbackProjectId(projects[0].id);
        }
      })
      .catch(() => {
        // Ignore fallback resolution failure
      });
  }, [isAuthenticated, accessToken, fallbackProjectId]);

  const handleAction = (action: VoiceAction) => {
    const projId = activeProjectId || 'd61fc91a-a194-48b5-baaa-cec694170359';
    switch (action.target) {
      case 'roadmap':
        navigate(activeProjectId ? `/projects/${projId}/roadmap` : '/projects');
        break;
      case 'schemes':
        navigate(activeProjectId ? `/projects/${projId}/schemes` : '/projects');
        break;
      case 'profile':
        navigate(activeProjectId ? `/projects/${projId}/profile` : '/projects');
        break;
      case 'vault':
        navigate(activeProjectId ? `/projects/${projId}/roadmap` : '/projects');
        break;
      case 'time-cost':
        navigate(activeProjectId ? `/projects/${projId}/bi/time-cost` : '/time-cost-prediction');
        break;
      case 'inspections':
        navigate(activeProjectId ? `/projects/${projId}/roadmap` : '/projects');
        break;
      case 'grievances':
        navigate(activeProjectId ? `/projects/${projId}/roadmap` : '/projects');
        break;
      default:
        navigate(activeProjectId ? `/projects/${projId}/roadmap` : '/projects');
    }
  };

  const {
    state: voiceState,
    startSession: startControllerSession,
    stopSession: stopControllerSession,
    startListening,
    sendTextMessage,
    isSupported,
  } = useVoiceController({
    projectId: activeProjectId,
    token: accessToken,
    onTranscript: (text) => {
      setVoiceTranscript(text);
    },
    onAnswer: (msg) => {
      setVoiceTranscript('');
      setVoiceMessages((prev) => [...prev, msg]);
    },
    onStateChange: (nextState) => {
      if (nextState !== 'idle') {
        setIsOverlayOpen(true);
      }
    },
    onError: (err) => {
      setVoiceError(err);
    },
    onAction: (act) => {
      handleAction(act);
    },
  });

  const openOverlay = () => {
    setIsOverlayOpen(true);
    if (voiceState === 'idle') {
      startControllerSession();
    }
  };

  const closeOverlay = () => {
    setIsOverlayOpen(false);
    stopControllerSession();
    setVoiceTranscript('');
  };

  const startSession = async () => {
    setIsOverlayOpen(true);
    setVoiceError(null);
    await startControllerSession();
  };

  const stopSession = () => {
    stopControllerSession();
  };

  const toggleMic = () => {
    if (voiceState === 'speaking') {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      startListening();
    } else if (voiceState === 'listening') {
      stopSession();
    } else {
      startSession();
    }
  };

  const wakeWordRef = useRef<WakeWordListener | null>(null);

  // Background Wake Word Listener ("Hey Approve")
  useEffect(() => {
    if (!isAuthenticated) {
      wakeWordRef.current?.stop();
      wakeWordRef.current = null;
      return;
    }

    const listener = new WakeWordListener({
      onDetected: () => {
        setIsOverlayOpen(true);
        startControllerSession();
      },
    });

    wakeWordRef.current = listener;
    listener.start();

    return () => {
      listener.stop();
      wakeWordRef.current = null;
    };
  }, [isAuthenticated, startControllerSession]);

  // Pause background wake word recognition whenever the voice assistant overlay is active
  useEffect(() => {
    if (!wakeWordRef.current) return;
    if (isOverlayOpen || voiceState !== 'idle') {
      wakeWordRef.current.pause();
    } else {
      wakeWordRef.current.resume();
    }
  }, [isOverlayOpen, voiceState]);

  const isDashboardRoute =
    location.pathname.startsWith('/projects') ||
    location.pathname.startsWith('/officer') ||
    location.pathname.startsWith('/profile');


  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        startSession,
        stopSession,
        sendTextMessage,
        isSupported,
        isOverlayOpen,
        openOverlay,
        closeOverlay,
      }}
    >
      {children}

      {/* Floating Microphone Trigger for Authenticated Dashboard Pages */}
      {isAuthenticated && isDashboardRoute && (
        <ApproveMicButton
          state={voiceState}
          onClick={toggleMic}
          floating
          isSupported={isSupported.stt}
        />
      )}

      {/* Full-Screen Siri-Style Voice Assistant Overlay */}
      <ApproveSessionOverlay
        state={voiceState}
        isVisible={isOverlayOpen}
        onDismiss={closeOverlay}
        onToggleMic={toggleMic}
        onSendText={sendTextMessage}
        onExecuteAction={handleAction}
        transcript={voiceTranscript}
        messages={voiceMessages}
        error={voiceError}
        projectName={activeProjectId ? 'Active Project' : 'ApprovalIQ'}
      />
    </VoiceContext.Provider>
  );
}


