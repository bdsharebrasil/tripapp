import { target, type Rect } from "@/engine/geometry";
import { lerp, timeline as script } from "@/engine/timeline";
import { DURATION } from "@/engine/tokens";
import { Bar, Block, pct, SETTINGS, type SceneProps } from "@/wireframe";
import { SQUASH, TOGGLE_MS } from "./timing";

/**
 * Settings page, first row ("Email notifications"). The template's small switch is covered by the
 * piece's own 44x24 switch so the thumb can squash; the row label gets an invisible hit box so the
 * second click can land on the label text and still toggle the switch.
 */
const SWITCH: Rect = { x: 488, y: 117, w: 44, h: 24 };
const THUMB = 18;
const INSET = (SWITCH.h - THUMB) / 2;
const TRAVEL = SWITCH.w - THUMB - INSET * 2;
/** Row 0 of the settings template: label bar at (28, 120) 104x8, description at (28, 134) 180x6. */
const ROW: Rect = { x: 16, y: 110, w: 528, h: 40 };
const LABEL_HIT: Rect = { x: 24, y: 114, w: 114, h: 24 };

/** Cursor rest point (stage px): low on the page, left of the rows' controls. */
const REST = { x: 196, y: 300 };

/*
 * Choreography: idle; travel up-right to the switch and click it, the thumb slides right with a
 * slight squash and the track fills dark; the cursor sweeps left along the row to the label text
 * and clicks it, the switch turns off with the faster exit curve; the cursor drops back to rest.
 */
const b = script({
  cursor: REST,
  tracks: { on: 0, hoverSwitch: 0, pressSwitch: 0, hoverRow: 0, pressLabel: 0 },
})
  .wait(900)
  .moveTo(target(SWITCH, { fx: 0.55, fy: 0.6 }), 650, { curve: 0.14 })
  .tween("hoverSwitch", 1, DURATION.fast)
  .wait(120)
  .mark("switchPress")
  .press({ key: "pressSwitch", anchor: "toggle-switch" });

b.tween("on", 1, TOGGLE_MS.on, { at: b.lastClick, ease: "out" })
  .wait(700)
  .tween("hoverSwitch", 0, DURATION.fast)
  .moveTo(target(LABEL_HIT, { fx: 0.42, fy: 0.5 }), 750, { curve: -0.08 })
  .tween("hoverRow", 1, DURATION.fast)
  .wait(160)
  .mark("labelPress")
  .press({ key: "pressLabel", anchor: "toggle-label" });

b.tween("on", 0, TOGGLE_MS.off, { at: b.lastClick, ease: "in" })
  .wait(400)
  .tween("hoverRow", 0, DURATION.fast)
  .moveTo(REST, 700, { curve: 0.12 });

export const timeline = b.build();

/** Switch on, cursor resting on the row label just before it clicks: shown under reduced motion. */
export const poster = timeline.marks.labelPress ?? 0;

export default function ToggleSwitchScene({ frame }: SceneProps) {
  const { on, hoverSwitch, pressSwitch, hoverRow, pressLabel } = frame.v as Record<
    "on" | "hoverSwitch" | "pressSwitch" | "hoverRow" | "pressLabel",
    number
  >;
  // Deformation peaks at mid-travel and is back to 0 at both ends (no spring, no overshoot).
  const squash = SQUASH * Math.sin(Math.PI * Math.min(Math.max(on, 0), 1));
  return (
    <>
      <SETTINGS.Page state={{ toggle0: { on } }} />
      {/* Row hover: the whole row is the label's hit area, so it highlights as one target. */}
      <Block {...ROW} r={8} tone="panel" style={{ opacity: hoverRow }} />
      <Bar x={28} y={120} w={104} h={8} tone={hoverRow > 0.5 ? "strong" : "title"} />
      <Bar x={28} y={134} w={180} h={6} tone="base" />
      <div
        data-anchor="toggle-label"
        style={{
          position: "absolute",
          left: LABEL_HIT.x,
          top: LABEL_HIT.y,
          width: LABEL_HIT.w,
          height: LABEL_HIT.h,
          transform: pressLabel > 0 ? `scale(${1 - 0.02 * pressLabel})` : undefined,
        }}
      />
      <div
        data-anchor="toggle-switch"
        style={{
          position: "absolute",
          left: SWITCH.x,
          top: SWITCH.y,
          width: SWITCH.w,
          height: SWITCH.h,
          borderRadius: 12,
          background: `color-mix(in srgb, var(--mk-accent) ${pct(on)}%, var(--mk-wire-strong))`,
          boxShadow: `0 0 0 ${3 * hoverSwitch}px color-mix(in srgb, var(--mk-accent) 10%, transparent)`,
          transform: pressSwitch > 0 ? `scale(${1 - 0.04 * pressSwitch})` : undefined,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: INSET,
            top: INSET,
            width: THUMB,
            height: THUMB,
            borderRadius: 9,
            background: "var(--mk-surface)",
            boxShadow: "0 1px 2px rgb(10 12 16 / 0.22)",
            transform: `translateX(${lerp(0, TRAVEL, on)}px) scale(${1 + squash}, ${1 - squash})`,
          }}
        />
      </div>
    </>
  );
}
