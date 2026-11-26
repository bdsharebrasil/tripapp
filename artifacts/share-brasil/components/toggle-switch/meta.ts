import { easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";
import { SQUASH, TOGGLE_MS } from "./timing";

export default defineMeta({
  slug: "toggle-switch",
  name: "Toggle switch",
  family: "inputs",
  summary: "A labeled binary setting shown as a sliding thumb within a track.",
  whenToUse: [
    "Turn one setting on or off with an immediate effect.",
    "Keep a simple preference explicit; use checkbox-radio for a submitted checklist.",
  ],
  avoidWhen: [
    "Choosing one of several named values: use segmented-control.",
    "A momentary action rather than a persistent state: use button-press.",
  ],
  promptTerm: "accessible toggle switch",
  promptExample:
    "Use the “accessible toggle switch” pattern to build a labeled switch with a sliding, subtly squashing thumb, a dark checked track, Space-key toggling, and correct checked state. Make the whole row (label and description) clickable, name the switch by its label and describe it by the description. Thumb travels in 180 ms ease-out when turning on and 120 ms ease-in when turning off, squashing at most 3% at mid-travel; no movement under reduced motion.",
  aliases: ["Toggle switch", "Switch"],
  timing: [
    { phase: `on (thumb slides, squash ${SQUASH * 100}% at mid-travel, track fills dark)`, ms: TOGGLE_MS.on, easing: easingCss("out") },
    { phase: "off (thumb returns, track clears)", ms: TOGGLE_MS.off, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Expose role=switch and aria-checked through the primitive, with a persistent associated label.",
    "Space toggles; the label is clickable and the switch has a visible focus indicator.",
    "Do not change the accessible label when state changes; checked state conveys on/off.",
    "Honor disabled state and form integration; preserve focus when external controlled state updates.",
    "Reduced motion: Set checked position and track color immediately (0 ms), without travel or squash.",
  ],
  primitives: ["@base-ui/react 1.9.0 Switch (MIT), behind src/primitives/switch.tsx", "motion 14.8.0 (MIT)"],
  status: "ready",
});
