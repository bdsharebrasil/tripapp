import { target, type Rect } from "@/engine/geometry";
import { timeline as script } from "@/engine/timeline";
import { DURATION } from "@/engine/tokens";
import { Bar, Block, Button, DASHBOARD, pct, type SceneProps } from "@/wireframe";
import { CHOICE_MS } from "./timing";

/**
 * Dashboard template with a "Filters" card over the chart: a checklist on the left and a radio
 * group on the right, split by a hairline, and a quiet Reset button in the card header.
 */
const CARD: Rect = DASHBOARD.targets.chart;
const ROW_Y = [72, 100, 128] as const;
const CHECK_X = 16;
const RADIO_X = 206;
const BOX = 16;
const CHECK_LABEL_W = [72, 96, 64] as const;
const RADIO_LABEL_W = [56, 84, 68] as const;
const RESET: Rect = { x: 300, y: 12, w: 64, h: 24 };

const inPage = (r: Rect): Rect => ({ ...r, x: CARD.x + r.x, y: CARD.y + r.y });
const box = (x: number, i: number): Rect => ({ x, y: ROW_Y[i]!, w: BOX, h: BOX });

/** Cursor rest point (stage px): on the right KPI tile, above the card. */
const REST = { x: 470, y: 128 };

/*
 * Choreography: idle on the KPI row; swoop down-left to the second checkbox and check it (the
 * box fills, the tick draws); glide right to the second radio and pick it (the old dot shrinks
 * out, the new one scales in); climb to Reset in the card header and press it (everything
 * reverses with the exit curve); return to the KPI tile.
 */
const b = script({
  cursor: REST,
  tracks: { check: 0, radioA: 1, radioB: 0, pressBox: 0, pressRadio: 0, hoverReset: 0, pressReset: 0 },
})
  .wait(1000)
  .moveTo(target(inPage(box(CHECK_X, 1)), { fx: 0.5, fy: 0.55 }), 650, { curve: 0.18 })
  .wait(100)
  .mark("boxPress")
  .press({ key: "pressBox", anchor: "checkbox-box" });

b.tween("check", 1, CHOICE_MS.enter, { at: b.lastClick, ease: "out" })
  .wait(150)
  .moveTo(target(inPage(box(RADIO_X, 1)), { fx: 0.5, fy: 0.55 }), 520, { curve: -0.12 })
  .wait(90)
  .press({ key: "pressRadio", anchor: "radio-b" });

b.tween("radioA", 0, CHOICE_MS.exit, { at: b.lastClick, ease: "in" })
  .tween("radioB", 1, CHOICE_MS.enter, { at: b.lastClick, ease: "out" })
  .wait(350)
  .moveTo(target(inPage(RESET), { fx: 0.5, fy: 0.6 }), 500, { curve: 0.15 })
  .tween("hoverReset", 1, DURATION.fast)
  .wait(100)
  .mark("resetPress")
  .press({ key: "pressReset", anchor: "checkbox-reset" });

const reset = b.lastClick;
b.tween("check", 0, CHOICE_MS.exit, { at: reset, ease: "in" })
  .tween("radioB", 0, CHOICE_MS.exit, { at: reset, ease: "in" })
  .tween("radioA", 1, CHOICE_MS.enter, { at: reset, ease: "out" })
  .tween("hoverReset", 0, DURATION.fast)
  .moveTo(REST, 600, { curve: -0.1 });

export const timeline = b.build();

/** Second box checked and the second radio picked, cursor on Reset: shown under reduced motion. */
export const poster = timeline.marks.resetPress ?? 0;

/** Tick inside a 16 px box, drawn from 0 to 1 with stroke-dashoffset (pathLength 1). */
function Tick({ draw }: { draw: number }) {
  return (
    <svg width={BOX} height={BOX} viewBox="0 0 16 16" style={{ position: "absolute", inset: 0 }}>
      <path
        d="M4 8.4 L6.9 11.2 L12 5.4"
        pathLength={1}
        fill="none"
        stroke="var(--mk-surface)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={1}
        strokeDashoffset={Math.round((1 - draw) * 1000) / 1000}
      />
    </svg>
  );
}

function CheckBox({ on, press = 0, anchor, ...r }: Rect & { on: number; press?: number; anchor?: string }) {
  return (
    <div
      data-anchor={anchor}
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: 4,
        background: `color-mix(in srgb, var(--mk-accent) ${pct(on)}%, var(--mk-surface))`,
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, var(--mk-accent) ${pct(on)}%, var(--mk-wire-strong))`,
        transform: press > 0 ? `scale(${1 - 0.08 * press})` : undefined,
      }}
    >
      {on > 0 ? <Tick draw={on} /> : null}
    </div>
  );
}

function RadioDot({ on, press = 0, anchor, ...r }: Rect & { on: number; press?: number; anchor?: string }) {
  return (
    <div
      data-anchor={anchor}
      style={{
        position: "absolute",
        left: r.x,
        top: r.y,
        width: r.w,
        height: r.h,
        borderRadius: 8,
        background: "var(--mk-surface)",
        boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, var(--mk-accent) ${pct(on)}%, var(--mk-wire-strong))`,
        transform: press > 0 ? `scale(${1 - 0.08 * press})` : undefined,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 4,
          top: 4,
          width: 8,
          height: 8,
          borderRadius: 4,
          background: "var(--mk-accent)",
          transform: `scale(${Math.round(on * 1000) / 1000})`,
        }}
      />
    </div>
  );
}

export default function CheckboxRadioScene({ frame }: SceneProps) {
  const { check, radioA, radioB, pressBox, pressRadio, hoverReset, pressReset } = frame.v as Record<
    "check" | "radioA" | "radioB" | "pressBox" | "pressRadio" | "hoverReset" | "pressReset",
    number
  >;
  const radios = [radioA, radioB, 0];
  return (
    <>
      <DASHBOARD.Page />
      <Block {...CARD} r={12} tone="surface" style={{ boxShadow: "inset 0 0 0 1px var(--mk-wire)" }}>
        <Bar x={16} y={16} w={96} h={8} tone="title" />
        <Bar x={16} y={30} w={150} h={6} tone="base" />
        <Button {...RESET} variant="secondary" hover={hoverReset} press={pressReset} anchor="checkbox-reset" r={6}>
          <Bar x={16} y={9} w={32} h={6} tone="strong" />
        </Button>
        <Bar x={CHECK_X} y={54} w={60} h={6} tone="strong" />
        <Bar x={RADIO_X} y={54} w={52} h={6} tone="strong" />
        <Block x={190} y={52} w={1} h={96} r={0} tone="base" />
        {ROW_Y.map((y, i) => (
          <div key={y}>
            <CheckBox
              {...box(CHECK_X, i)}
              on={i === 0 ? 1 : i === 1 ? check : 0}
              press={i === 1 ? pressBox : 0}
              anchor={i === 1 ? "checkbox-box" : undefined}
            />
            <Bar x={CHECK_X + 26} y={y + 4} w={CHECK_LABEL_W[i]} h={8} tone={i === 1 && check > 0.5 ? "strong" : "title"} />
            <RadioDot
              {...box(RADIO_X, i)}
              on={radios[i]!}
              press={i === 1 ? pressRadio : 0}
              anchor={i === 1 ? "radio-b" : undefined}
            />
            <Bar x={RADIO_X + 26} y={y + 4} w={RADIO_LABEL_W[i]} h={8} tone={radios[i]! > 0.5 ? "strong" : "title"} />
          </div>
        ))}
      </Block>
    </>
  );
}
