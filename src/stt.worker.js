import { pipeline, env } from "@huggingface/transformers";
import { routeModelWeights } from "./model-fetch.js";

// Model weights are served from our own origin; see worker/models.js for why.
env.remoteHost = `${self.location.origin}/hf`;
routeModelWeights();

const MODEL_ID = "Xenova/whisper-tiny.en";

let transcriber = null;

function load() {
  transcriber ??= pipeline("automatic-speech-recognition", MODEL_ID, {
    dtype: "q8",
    device: "wasm",
    progress_callback: (progress) => {
      if (progress.status === "progress" && progress.total) {
        self.postMessage({ type: "progress", loaded: progress.loaded, total: progress.total });
      }
    },
  });

  return transcriber;
}

self.onmessage = async ({ data }) => {
  const { id, audio } = data;

  try {
    const model = await load();
    const { text } = await model(audio);
    self.postMessage({ type: "text", id, text: text.trim() });
  } catch (error) {
    self.postMessage({ type: "error", id, message: error?.message ?? String(error) });
  }
};
