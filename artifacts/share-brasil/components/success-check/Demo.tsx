import { timeline as script } from "@/engine/timeline";
import { target } from "@/engine/geometry";
import { DURATION } from "@/engine/tokens";
import { Bar, Block, SETTINGS, type SceneProps } from "@/wireframe";
const REST = { x: 200, y: 252 };
const b = script({ cursor: REST, tracks: { open: 0, circle: 0, check: 0, press: 0 } })
  .wait(1000).moveTo(target(SETTINGS.targets.save), 680, { curve: .18 }).press({ key: "press", anchor: "success-check-save" });
const click = b.lastClick;
b.tween("open", 1, DURATION.enter, { at: click }).tween("circle", 1, 100, { at: click })
  .tween("check", 1, DURATION.fast, { at: click + 100 })
  .moveTo({ x: 272, y: 260 }, 460, { curve: -.3 }).mark("confirmed").wait(1500)
  .tween("open", 0, DURATION.exit, { advance: true, ease: "in" }).set("circle", 0).set("check", 0)
  .moveTo(REST, 600, { curve: .24 });
export const timeline = b.build();
export const poster = timeline.marks.confirmed!;
export default function SuccessScene({ frame }: SceneProps) {
  const { open = 0, circle = 0, check = 0, press = 0 } = frame.v;
  return <><SETTINGS.Page state={{ save: { press, anchor: "success-check-save" } }} />
    <Block x={28} y={188} w={292} h={128} tone="surface" style={{ opacity: open, border: "1px solid var(--mk-window-border)" }}>
      <svg width="56" height="56" viewBox="0 0 48 48" fill="none" stroke="var(--mk-accent)" strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", top: 18, left: 18, transform: `scale(${.98 + .02 * check})` }}><circle cx="24" cy="24" r="20" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - circle} /><path d="m14 24 7 7 13-14" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - check} /></svg>
      <Bar x={92} y={30} w={160} h={12} tone="strong" /><Bar x={92} y={52} w={120} h={6} /><Bar x={20} y={96} w={192} h={8} tone="title" />
    </Block></>;
}
