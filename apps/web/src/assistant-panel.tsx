import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, X, SendHorizonal, Sparkles } from 'lucide-react';
import { get, post } from './api-client';
import { useAuth } from './auth';

/**
 * ApprovalIQ Assistant — floating side chat panel.
 *
 * A grounded assistant that knows the user's project (business profile,
 * applicable approvals, evaluation outcomes, time & cost prediction,
 * documents, clarifications) and ApprovalIQ itself. The panel slides in
 * from the right on any app page (not public marketing pages), keeps
 * per-project conversation state in memory, and clearly shows whether the
 * full LLM or the offline summary mode is answering.
 */

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

const PROJECT_ID_RE = /^\/projects\/([0-9a-fA-F-]{36})(\/|$)/;

/** Quick-start questions tailored to what the snapshot can answer. */
const SUGGESTIONS = [
  'How long until my business is legally ready?',
  'What will compliance cost me?',
  'What is the critical path?',
  'Explain what ApprovalIQ does',
];

export function AssistantPanel(): JSX.Element {
  const { accessToken } = useAuth();
  const location = useLocation();
  const match = PROJECT_ID_RE.exec(location.pathname);
  const projectId = match?.[1] ?? null;

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'llm' | 'offline' | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMsg[]>>({});
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Reset per-project transcript so each project chats from a clean slate.
  useEffect(() => {
    setError(null);
  }, [projectId]);

  useEffect(() => {
    if (open) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open, busy]);

  useEffect(() => {
    if (!open || mode !== null) return;
    get<{ mode: 'llm' | 'offline' }>('/assistant/status', { token: accessToken ?? '' })
      .then((r) => setMode(r.mode))
      .catch(() => setMode('offline'));
  }, [open, mode, accessToken]);

  const send = async (text: string): Promise<void> => {
    const message = text.trim();
    if (!message || !projectId || busy) return;
    const history = messages[projectId] ?? [];
    setMessages((m) => ({ ...m, [projectId]: [...history, { role: 'user', content: message }] }));
    setInput('');
    setBusy(true);
    setError(null);
    try {
      const res = await post<{ reply: string; mode: 'llm' | 'offline' }>(
        `/assistant/projects/${projectId}/chat`,
        { message, history: history.slice(-8) },
        { token: accessToken ?? '' },
      );
      setMode(res.mode);
      setMessages((m) => ({
        ...m,
        [projectId]: [...(m[projectId] ?? []), { role: 'assistant', content: res.reply }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The assistant is unavailable right now.');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  // Pages without a project context (dashboard, BI pages, regulatory changes…)
  // get a compact launcher that routes users into a project first.
  if (!projectId) {
    return (
      <>
        {open && (
          <div className="fixed bottom-24 right-5 z-50 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 text-sm font-black text-slate-800">
                <Bot className="h-4 w-4 text-blue-600" /> ApprovalIQ Assistant
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
                <X className="h-4 w-4 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              The assistant answers from a specific project's data (profile, approvals, timeline,
              cost, documents). Open a project, then ask anything — e.g. "How long until my
              business is legally ready?"
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Open assistant"
          className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          <Bot className="h-5 w-5" />
        </button>
      </>
    );
  }

  const convo = messages[projectId] ?? [];

  return (
    <>
      {/* Slide-in side panel */}
      <div
        className={`fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-slate-800">
              <Bot className="h-4 w-4 text-blue-600" /> ApprovalIQ Assistant
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
              <Sparkles className="h-3 w-3" />
              {mode === 'llm' ? 'AI mode · grounded in your project data' : 'Offline mode · project snapshot answers'}
            </div>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">
            <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {convo.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-500">
                Ask me anything about this project — its business profile, applicable approvals,
                estimated legal-readiness timeline, compliance cost, critical path, documents or
                clarifications — or about ApprovalIQ itself. I answer only from real project data.
              </p>
              <div className="grid gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {convo.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-slate-100 px-3.5 py-2.5 text-xs text-slate-400">
                Thinking…
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t border-slate-200 px-3 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={projectId ? 'Ask about this project…' : 'Ask ApprovalIQ…'}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <button
            type="submit"
            disabled={busy || input.trim().length === 0}
            aria-label="Send message"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
          >
            <SendHorizonal className="h-4 w-4" />
          </button>
        </form>
      </div>

      {/* Launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Hide assistant' : 'Show assistant'}
        className="fixed bottom-5 right-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
      </button>
    </>
  );
}
