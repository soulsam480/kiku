/**
 * Kokoro 82M ships 28 English voices. The repository also contains multilingual voices
 * for the 1.1 model; those are deliberately not listed here because this build loads
 * the English-only weights.
 */
/**
 * @typedef {{ id: string, name: string, group: string, label: string }} Voice
 */

/** @type {Array<{ label: string, voices: Array<[string, string]> }>} */
export const VOICE_GROUPS = [
  {
    label: "US female",
    voices: [
      ["af_heart", "Heart"],
      ["af_bella", "Bella"],
      ["af_nicole", "Nicole"],
      ["af_aoede", "Aoede"],
      ["af_kore", "Kore"],
      ["af_sarah", "Sarah"],
      ["af_nova", "Nova"],
      ["af_sky", "Sky"],
      ["af_alloy", "Alloy"],
      ["af_jessica", "Jessica"],
      ["af_river", "River"],
    ],
  },
  {
    label: "US male",
    voices: [
      ["am_michael", "Michael"],
      ["am_fenrir", "Fenrir"],
      ["am_puck", "Puck"],
      ["am_echo", "Echo"],
      ["am_eric", "Eric"],
      ["am_liam", "Liam"],
      ["am_onyx", "Onyx"],
      ["am_santa", "Santa"],
      ["am_adam", "Adam"],
    ],
  },
  {
    label: "UK female",
    voices: [
      ["bf_emma", "Emma"],
      ["bf_isabella", "Isabella"],
      ["bf_alice", "Alice"],
      ["bf_lily", "Lily"],
    ],
  },
  {
    label: "UK male",
    voices: [
      ["bm_george", "George"],
      ["bm_fable", "Fable"],
      ["bm_lewis", "Lewis"],
      ["bm_daniel", "Daniel"],
    ],
  },
];

/** @type {Voice[]} */
export const VOICES = VOICE_GROUPS.flatMap((group) =>
  group.voices.map(([id, name]) => ({ id, name, group: group.label, label: `${name} · ${group.label}` })),
);

export const DEFAULT_VOICE = "af_heart";

/** Human label for a stored voice id, falling back to the raw id. */
/**
 * @param {string} id
 * @returns {string} human label, or the id when unknown
 */
export function voiceLabel(id) {
  return VOICES.find((voice) => voice.id === id)?.label ?? id;
}
