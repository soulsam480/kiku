/**
 * Alpine ships no types, and `checkJs` would otherwise walk its untyped bundles.
 * `ThisType` makes `this` inside the component object resolve to that object plus
 * Alpine's magics, so methods and getters type-check against each other.
 */
type AlpineMagics = {
  $refs: Record<string, any>;
  $nextTick: (callback?: () => void) => Promise<void>;
  $watch: (path: string, callback: (value: any) => void) => void;
};

declare const Alpine: {
  data<T extends object>(name: string, callback: () => T & ThisType<T & AlpineMagics>): void;
  start(): void;
};

export default Alpine;
