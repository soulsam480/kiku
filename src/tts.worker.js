import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";
import { routeModelWeights } from "./model-fetch.js";

// Model weights are served from our own origin; see worker/models.js for why.
env.remoteHost = `${self.location.origin}/hf`;
routeModelWeights();

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
const VOICE = "af_heart";

let model = null;
let loading = null;

function load() {
  loading ??= KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (progress) => {
      if (progress.status === "progress" && progress.total) {
        self.postMessage({ type: "progress", loaded: progress.loaded, total: progress.total });
      }
    },
  }).then((loaded) => {
    model = loaded;
    self.postMessage({ type: "ready" });
    return loaded;
  });

  return loading;
}

self.onmessage = async ({ data }) => {
  const { id, type, text, voice = VOICE, speed = 1 } = data;

  try {
    await load();
    if (type === "warm") {
      self.postMessage({ type: "warmed", id });
      return;
    }

    const audio = await model.generate(text, { voice, speed });
    const samples = audio.audio;
    /** @type {any} */ (self).postMessage(
      { type: "audio", id, samples, sampleRate: audio.sampling_rate },
      [samples.buffer],
    );
  } catch (error) {
    self.postMessage({ type: "error", id: id ?? null, message: error?.message ?? String(error) });
  }
};
