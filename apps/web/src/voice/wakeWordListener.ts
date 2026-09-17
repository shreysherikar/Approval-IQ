/**
 * Background Wake Word Listener for "Hey Approve".
 *
 * Runs non-continuous Web Speech API loops in the background.
 * Detects "hey approve" / "approve" and triggers onDetected().
 * Automatically pauses during active voice sessions to prevent microphone conflict.
 */

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: (e: { resultIndex: number; results: Array<Array<{ transcript: string }>> }) => void;
  onerror: (e: { error: string }) => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}

export class WakeWordListener {
  private recognition: SpeechRecognitionLike | null = null;
  private running = false;
  private paused = false;
  private readonly onDetected: () => void;
  private readonly wakePhrase: string;

  constructor(options: { onDetected: () => void; wakePhrase?: string }) {
    this.onDetected = options.onDetected;
    this.wakePhrase = (options.wakePhrase ?? 'hey approve').toLowerCase();
  }

  start(): void {
    if (this.running || typeof window === 'undefined') return;
    this.running = true;
    this._createAndStart();
    document.addEventListener('visibilitychange', this._onVisibilityChange);
  }

  pause(): void {
    this.paused = true;
    try {
      this.recognition?.stop();
    } catch {
      // Ignore
    }
    this.recognition = null;
  }

  resume(): void {
    this.paused = false;
    if (this.running) {
      this._createAndStart();
    }
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    try {
      this.recognition?.stop();
    } catch {
      // Ignore
    }
    this.recognition = null;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._onVisibilityChange);
    }
  }

  private readonly _onVisibilityChange = (): void => {
    if (document.hidden) {
      this.pause();
    } else if (this.running && !this.paused) {
      this.resume();
    }
  };

  private _createAndStart(): void {
    if (!this.running || this.paused || typeof window === 'undefined') return;

    const winObj = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = winObj.SpeechRecognition ?? winObj.webkitSpeechRecognition;
    if (!Ctor) return;

    try {
      const rec = new Ctor();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 3;

      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (!item) continue;
          for (let alt = 0; alt < item.length; alt++) {
            const entry = item[alt];
            if (!entry) continue;
            const transcript = entry.transcript.toLowerCase().trim();
            const isWake =
              transcript.includes(this.wakePhrase) ||
              transcript.includes('hey approve') ||
              transcript.includes('approve') ||
              transcript.includes('hey approved') ||
              transcript.includes('approve me') ||
              transcript.includes('hey proof');

            if (isWake) {
              this.pause();
              this.onDetected();
              return;
            }
          }
        }
      };

      rec.onend = () => {
        this.recognition = null;
        if (this.running && !this.paused) {
          setTimeout(() => this._createAndStart(), 150);
        }
      };

      rec.onerror = (event) => {
        if (event.error === 'not-allowed') {
          this.running = false;
          return;
        }
        if (event.error === 'aborted' || event.error === 'no-speech') {
          return;
        }
        if (this.running && !this.paused) {
          setTimeout(() => this._createAndStart(), 400);
        }
      };

      rec.start();
      this.recognition = rec;
    } catch {
      // Fallback restart
      if (this.running && !this.paused) {
        setTimeout(() => this._createAndStart(), 500);
      }
    }
  }
}
