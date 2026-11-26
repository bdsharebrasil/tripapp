/**
 * Toggle timings: on 180 ms ease-out, off 120 ms ease-in.
 * 180 ms sits between the shared tokens (fast 120, enter 220), so it lives here as a named constant.
 */
export const TOGGLE_MS = { on: 180, off: 120 } as const;

/** Largest thumb deformation at mid-travel (sheet: "squashes at most 3%"). */
export const SQUASH = 0.03;
