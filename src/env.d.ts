/** Build-time constant injected by Vite's `define`. */
declare const __BUILD_TIME__: string;

declare module "*.json" {
  const value: Record<string, string>;
  export default value;
}

declare module "*.css" {
  const value: string;
  export default value;
}

interface ImportMeta {
  readonly env: { readonly DEV: boolean; readonly PROD: boolean };
}

/** Types shared across modules. */

/** A saved document, as stored in IndexedDB. */
type DocumentRecord = {
  id: string;
  title: string;
  markdown: string;
  /** Index of the sentence narration should resume at. */
  position: number;
  log: Interruption[];
  createdAt: number;
  updatedAt: number;
};

type Interruption = {
  at: number;
  /** Sentence index the question was asked from. */
  chunk: number;
  question: string;
  answer: string;
};

/** One synthesized piece of speech, ready for the player. */
type AudioChunk = {
  samples: Float32Array<ArrayBuffer>;
  sampleRate: number;
};

/** Where narration currently is, captured when it is interrupted. */
type PlaybackSnapshot = {
  index: number;
  buffer: AudioBuffer;
  offset: number;
};

type TtsSettings = {
  baseUrl: string;
  apiKey: string;
  model: string;
  voice: string;
  speed: number;
  speakAnswers: boolean;
};

interface Window {
  /** Debug handle exposed by the dev build only. */
  listener?: Record<string, any>;
}

interface HTMLElement {
  /** Alpine attaches its component data here. */
  _x_dataStack?: any[];
}

/** An answer that is being streamed and spoken. */
type AnswerState = {
  text: string;
  /** Streamed text not yet turned into sentences. */
  pending: string;
  /** Sentences currently being synthesized. */
  inflight: number;
  streamDone: boolean;
};
