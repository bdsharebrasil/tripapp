/**
 * Checkbox and radio timings: select 180 ms ease-out (tick
 * draws, dot scales in), clear 120 ms ease-in. 180 ms sits between the shared tokens (fast 120,
 * enter 220), so it lives here. checkbox-radio.css repeats the two values for the CSS transitions;
 * keep both in sync.
 */
export const CHOICE_MS = { enter: 180, exit: 120 } as const;
