import { easingCss } from "@/engine/tokens";
import { defineMeta } from "@/kit/types";
import { CHOICE_MS } from "./timing";

export default defineMeta({
  slug: "checkbox-radio",
  name: "Checkbox and radio",
  family: "inputs",
  summary: "Native selection inputs with animated checkmarks and radio dots.",
  whenToUse: [
    "Choose multiple independent options with checkboxes.",
    "Choose exactly one value within a named radio group; use segmented-control for a compact visual group.",
  ],
  avoidWhen: [
    "An immediately applied binary preference better expressed as on/off: use toggle-switch.",
    "Many searchable choices: use combobox.",
  ],
  promptTerm: "native animated checkbox and radio group",
  promptExample:
    "Use the “native animated checkbox and radio group” pattern to build native labeled checkboxes with an indeterminate state and a same-name radio group, animating the check stroke and selected radio dot without replacing native keyboard semantics. Keep real <input>s with appearance: none; draw the tick with stroke-dashoffset and scale the dot from 0 in 180 ms ease-out, clear in 120 ms ease-in, and switch instantly under reduced motion.",
  aliases: ["Checkbox", "Radio button", "Radio group"],
  timing: [
    { phase: "select (box fills, tick draws, dot scales 0 to 1)", ms: CHOICE_MS.enter, easing: easingCss("out") },
    { phase: "clear (tick erases, dot scales to 0)", ms: CHOICE_MS.exit, easing: easingCss("in") },
    { phase: "reduced motion", ms: 0, easing: "linear" },
  ],
  loopMs: 5000,
  a11y: [
    "Associate labels; use fieldset/legend for the radio group and a shared name for its inputs.",
    "Space toggles checkboxes; native radio arrow navigation changes the selected option.",
    "Set the native checkbox indeterminate property for mixed state; never put mixed state on a radio.",
    "Keep native inputs in the accessibility tree and maintain visible focus, disabled, and checked states.",
    "Reduced motion: Show/hide check and dot in 0 ms; retain native selection feedback.",
  ],
  primitives: ["Native <input type=\"checkbox\"> and <input type=\"radio\"> (no third-party primitive); CSS transitions in checkbox-radio.css"],
  status: "ready",
});
