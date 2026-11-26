import { defineMeta } from "@/kit/types";
export default defineMeta({
  "slug": "success-check",
  "name": "Success check",
  "family": "feedback",
  "summary": "A one-time visual checkmark confirming that an action succeeded.",
  "whenToUse": [
    "Confirm a completed submission close to its trigger.",
    "Pair success text with an unmistakable icon; use toast when feedback must sit outside the layout."
  ],
  "avoidWhen": [
    "Pending work: use spinner or progress-bar.",
    "A persistent toggled preference: use checkbox-radio."
  ],
  "promptTerm": "animated success checkmark",
  "promptExample": "Use the \u201canimated success checkmark\u201d pattern to build a success indicator that draws a circle and check stroke, adds a restrained scale emphasis, and announces completion once.",
  "aliases": [
    "Success check",
    "Completion checkmark",
    "Success tick"
  ],
  "timing": [
    {
      "phase": "enter",
      "ms": 220,
      "easing": "cubic-bezier(0.2,0.8,0.2,1)"
    },
    {
      "phase": "exit",
      "ms": 160,
      "easing": "cubic-bezier(0.4,0,1,1)"
    },
    {
      "phase": "reduced-motion",
      "ms": 0,
      "easing": "linear"
    }
  ],
  "loopMs": 5000,
  "a11y": [
    "Announce the successful result once through role=status/aria-live=polite.",
    "Keep the SVG decorative when text already names the outcome.",
    "Do not signal success by icon or color alone; include a short message.",
    "Do not move focus or remove the initiating control just to show the animation.",
    "Reduced motion: Display the complete check and success text in 0 ms; no path drawing or scale."
  ],
  "primitives": [
    "motion 14.8.0 (MIT)"
  ],
  "status": "ready"
});
