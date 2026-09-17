import React, { useEffect, useRef, useState } from 'react';
import { X, Mic, Send, Sparkles, Volume2, ArrowUpRight, ShieldCheck, AlertCircle } from 'lucide-react';
import type { VoiceAction, VoiceError, VoiceMessage, VoiceState } from './voiceTypes';

interface ApproveSessionOverlayProps {
  state: VoiceState;
  isVisible: boolean;
  onDismiss: () => void;
  onToggleMic: () => void;
  onSendText: (text: string) => void;
  onExecuteAction: (action: VoiceAction) => void;
  transcript: string;
  messages: VoiceMessage[];
  error?: VoiceError | null;
  projectName?: string;
}

const QUICK_PROMPTS = [
  'What is pending on my dashboard?',
  'Why are my approvals blocked?',
  'What schemes am I eligible for?',
  'Which documents are missing from the vault?',
  'What is my statutory RTS SLA timeline?',
];

export function ApproveSessionOverlay({
  state,
  isVisible,
  onDismiss,
  onToggleMic,
  onSendText,
  onExecuteAction,
  transcript,
  messages,
  error,
  projectName = 'Enterprise Docket',
}: ApproveSessionOverlayProps): JSX.Element | null {
  const [textInput, setTextInput] = useState('');
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, transcript]);

  if (!isVisible) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onSendText(textInput.trim());
    setTextInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xl animate-fade-in">
      <div className="relative w-full max-w-2xl h-[90vh] max-h-[750px] bg-slate-900/95 border border-amber-500/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-amber-500/15 via-transparent to-transparent pointer-events-none" />

        {/* Header */}
        <div className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-editorial text-lg font-bold text-white tracking-wide">
                  Approve
                </h3>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold uppercase tracking-wider border border-amber-500/30">
                  Voice Assistant
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {projectName} • Live Grounded Intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close Assistant"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Central Dynamic Orb Visualizer */}
        <div className="relative py-6 flex flex-col items-center justify-center shrink-0 border-b border-slate-800/60 bg-gradient-to-b from-slate-900/40 to-slate-950/60">
          <div className="relative flex items-center justify-center w-28 h-28">
            {/* Concentric Orb Rings */}
            {state === 'listening' && (
              <>
                <span className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                <span className="absolute -inset-3 rounded-full border border-blue-400/40 animate-[spin_4s_linear_infinite]" />
                <span className="absolute -inset-6 rounded-full border border-blue-500/20 animate-pulse" />
              </>
            )}

            {state === 'processing' && (
              <>
                <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-pulse" />
                <span className="absolute -inset-4 rounded-full border-2 border-dashed border-amber-400/50 animate-[spin_3s_linear_infinite]" />
              </>
            )}

            {state === 'speaking' && (
              <>
                <span className="absolute inset-0 rounded-full bg-emerald-500/25 animate-ping" />
                <span className="absolute -inset-4 rounded-full border border-emerald-400/50 animate-[pulse_1s_ease-in-out_infinite]" />
                <span className="absolute -inset-8 rounded-full border border-emerald-500/20 animate-pulse" />
              </>
            )}

            {/* Core Orb Center */}
            <button
              type="button"
              onClick={onToggleMic}
              className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-2xl ${
                state === 'listening'
                  ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/50 scale-105'
                  : state === 'processing'
                  ? 'bg-gradient-to-br from-amber-500 to-amber-700 text-slate-950 shadow-amber-500/50'
                  : state === 'speaking'
                  ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/50'
                  : 'bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 text-amber-400 hover:border-amber-500/50 shadow-slate-950/80 hover:scale-105'
              }`}
            >
              {state === 'listening' ? (
                <Mic className="w-8 h-8 animate-bounce" />
              ) : state === 'processing' ? (
                <Sparkles className="w-8 h-8 text-slate-950 animate-spin" />
              ) : state === 'speaking' ? (
                <Volume2 className="w-8 h-8 animate-pulse" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </button>
          </div>

          {/* State Status Text */}
          <div className="mt-3 text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] font-mono uppercase tracking-wider font-semibold">
              <span
                className={`w-2 h-2 rounded-full ${
                  state === 'listening'
                    ? 'bg-blue-400 animate-ping'
                    : state === 'processing'
                    ? 'bg-amber-400 animate-pulse'
                    : state === 'speaking'
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-500'
                }`}
              />
              <span className="text-slate-300">
                {state === 'listening'
                  ? 'Listening… speak naturally'
                  : state === 'processing'
                  ? 'Analyzing project data…'
                  : state === 'speaking'
                  ? 'Approve is speaking…'
                  : 'Tap microphone or ask a question'}
              </span>
            </span>
          </div>
        </div>

        {/* Conversation History & Live Transcript */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">{error.code === 'MIC_DENIED' ? 'Microphone Permission Required' : 'Voice Assistant Notice'}</span>
                <span className="text-rose-300/90">{error.message}</span>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed shadow-md ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-none'
                }`}
              >
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400 font-bold mb-1 uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>Approve</span>
                  </div>
                )}
                <p className="whitespace-pre-line font-sans">{m.text}</p>

                {/* Structured Action Buttons */}
                {m.actions && m.actions.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-700/60 flex flex-wrap gap-2">
                    {m.actions.map((act, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          onExecuteAction(act);
                          onDismiss();
                        }}
                        className="tactile-btn mustard-btn-primary px-3 py-1.5 text-[11px] font-bold rounded-lg inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <span>{act.label || `Open ${act.target}`}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 mt-1 px-1">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {/* Live Interim Transcript */}
          {transcript && (
            <div className="flex flex-col items-end animate-fade-in">
              <div className="max-w-[85%] rounded-2xl px-4 py-3 text-xs sm:text-sm bg-blue-600/60 text-blue-100 border border-blue-400/40 italic flex items-center gap-2">
                <span>{transcript}</span>
                <span className="w-1.5 h-4 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* Suggested Quick Questions if only greeting is present */}
          {messages.length <= 1 && (
            <div className="pt-2 space-y-2">
              <span className="text-[11px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Suggested Questions for Your Project:</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_PROMPTS.map((prompt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onSendText(prompt)}
                    className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 text-left text-xs text-slate-200 transition-all hover:translate-x-0.5 flex items-center justify-between group"
                  >
                    <span>{prompt}</span>
                    <ArrowUpRight className="w-3 h-3 text-slate-400 group-hover:text-amber-400 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Text Input Fallback Bar */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-900/80">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleMic}
              className={`p-2.5 rounded-xl border transition-all ${
                state === 'listening'
                  ? 'bg-blue-600 border-blue-500 text-white animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-amber-400 hover:text-amber-300 hover:border-slate-600'
              }`}
              title={state === 'listening' ? 'Stop Listening' : 'Speak'}
            >
              <Mic className="w-4 h-4" />
            </button>

            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ask Approve about pending approvals, blockers, documents, or schemes…"
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/50"
            />

            <button
              type="submit"
              disabled={!textInput.trim() || state === 'processing'}
              className="tactile-btn mustard-btn-primary p-2.5 rounded-xl font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
