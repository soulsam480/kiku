/** Play a short synthesized sample without touching the narration player. */
export function playSample({ samples, sampleRate }) {
  const context = new AudioContext();
  const buffer = context.createBuffer(1, samples.length, sampleRate);
  buffer.copyToChannel(samples, 0);

  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.onended = () => context.close();
  source.start();
}
