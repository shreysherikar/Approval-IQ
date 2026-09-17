/**
 * Voice Subsystem Utilities for "Approve" Voice Assistant.
 */

const DONE_PHRASES = new Set([
  'yes', 'yeah', 'done', 'bye', 'goodbye', 'stop', 'end', 'exit', 'quit', 'close',
  'thank you', 'thanks', 'all set', "i'm done", 'im done', 'nothing else',
  "that's all", "that's it", "i'm good", 'all good', 'no thanks', 'no thank you',
]);

/**
 * Normalizes user speech transcript and detects conversational session-end intent.
 */
export function isDone(text: string): boolean {
  const normalized = text.toLowerCase().trim().replace(/[.,!?;:]+$/, '');
  if (DONE_PHRASES.has(normalized)) return true;
  // Prefixed variants: "ok thank you", "alright bye", "great thanks", "that is all"
  return /\b(thank\s*you|thanks|bye|goodbye|that'?s?\s*(all|it)|all\s*(good|set)|i'?m?\s*(done|good))\b/i.test(normalized);
}

/**
 * Strips markdown and special symbols so the text reads naturally through Text-to-Speech.
 */
export function cleanForSpeech(text: string): string {
  if (!text) return '';
  let t = text;

  // Handle JSON output strings
  try {
    const parsed = JSON.parse(t);
    if (typeof parsed === 'object' && parsed !== null) {
      t = parsed.spokenText ?? parsed.spoken_answer ?? parsed.reply ?? parsed.answer ?? parsed.text ?? t;
    }
  } catch {
    // Not raw JSON
  }

  return t
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // strip reasoning blocks
    .replace(/#{1,6}\s*/g, '')                 // markdown headers
    .replace(/[*_]{1,3}/g, '')                 // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')         // code spans/blocks
    .replace(/^\s*>\s*/gm, '')                 // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // [label](url) -> label
    .replace(/https?:\/\/\S+/g, '')            // bare URLs
    .replace(/\|/g, '')                        // table pipes
    .replace(/^\s*\d+\.\s+/gm, '')             // numbered list markers
    .replace(/^\s*[-~•*]\s+/gm, '')            // bullet points
    .replace(/[[\]()]/g, '')                   // brackets
    .replace(/[—–]/g, ', ')                    // em/en dashes -> commas
    .replace(/\s{2,}/g, ' ')                   // collapse multiple whitespace
    .trim();
}

/**
 * Limits maximum words sent to TTS to avoid speech buffer overflows.
 */
export function truncateToWords(text: string, maxWords = 500): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
}

/**
 * Selects the warmest, most natural sounding English voice available in the browser.
 */
export function pickFemaleVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  return (
    voices.find((v) => v.name === 'Google UK English Female') ??
    voices.find((v) => v.name === 'Samantha') ??
    voices.find((v) => v.name === 'Karen') ??
    voices.find((v) => v.name === 'Victoria') ??
    voices.find((v) => v.name.toLowerCase().includes('female')) ??
    voices.find((v) => /zira|hazel|susan|catherine|veena/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-IN') ??
    voices.find((v) => v.lang === 'en-GB') ??
    voices.find((v) => v.lang.startsWith('en')) ??
    null
  );
}

/**
 * Detects if a captured STT transcript is merely an acoustic feedback echo of the assistant's own voice.
 */
export function isSelfSpeechEcho(
  userTranscript: string,
  lastAssistantText?: string | null,
  timeSinceSpeechMs?: number
): boolean {
  if (!userTranscript || !lastAssistantText) return false;

  const normUser = userTranscript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const normAssistant = lastAssistantText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normUser || !normAssistant) return false;

  // Common assistant closing / prompt phrases that often get picked up by microphone
  const commonEchoSnippets = [
    'how can i help you today',
    'how do you want me to help you',
    'hey im approve',
    'im approve',
    'im approve your voice assistant',
    'your voice assistant',
    'happy to help with your approvals',
    'have a great day',
  ];

  for (const snippet of commonEchoSnippets) {
    if (normUser === snippet || normUser.endsWith(snippet) || normUser.startsWith(snippet)) {
      if (normAssistant.includes(snippet)) {
        return true;
      }
    }
  }

  // If the speech recognition triggered right after TTS stopped (< 3500ms)
  if (timeSinceSpeechMs != null && timeSinceSpeechMs < 3500) {
    // 1. Direct substring match inside the full assistant response
    if (normAssistant.includes(normUser)) {
      return true;
    }

    // 2. Direct match with the tail end (last 10 words) of the assistant's speech
    const assistantWords = normAssistant.split(' ');
    const tailWords = assistantWords.slice(-12).join(' ');
    if (tailWords.includes(normUser) || normUser.includes(tailWords)) {
      return true;
    }
  }

  return false;
}

