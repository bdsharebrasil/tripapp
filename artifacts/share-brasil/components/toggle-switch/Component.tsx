import { useId, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Switch } from "@/primitives/switch";
import { EASING_POINTS } from "@/engine/tokens";
import { SQUASH, TOGGLE_MS } from "./timing";

/**
 * Toggle switch: one labeled on/off setting with an immediate effect. The whole row (label text,
 * description and switch) is a native <label>, so a press on the text toggles it too.
 *
 * Behavior comes from the switch primitive (src/primitives/switch.tsx, Base UI): role="switch",
 * aria-checked, Space toggles, a hidden native checkbox for forms (`name`), disabled state.
 * The switch is also named and described by id (aria-labelledby, aria-describedby), because a
 * span with role="switch" does not take its name from a wrapping <label>.
 * Motion: the thumb travels 20 px; on 180 ms ease-out, off 120 ms ease-in, with a scale squash of
 * at most 3% at mid-travel that returns to 1 (keyframes, no spring). The track color uses the same
 * durations in CSS. Reduced motion: position and color change at once, no squash.
 */

function bezier(points: readonly [number, number, number, number]): [number, number, number, number] {
  return [points[0], points[1], points[2], points[3]];
}

const TRAVEL = 20;

export interface ToggleSwitchProps {
  label: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?(checked: boolean): void;
  disabled?: boolean;
  /** Form field name for the hidden checkbox. */
  name?: string;
  "data-testid"?: string;
}

export function ToggleSwitch({
  label,
  description,
  checked: controlled,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  name,
  "data-testid": testId,
}: ToggleSwitchProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultChecked);
  const checked = controlled ?? uncontrolled;
  const reduced = useReducedMotion() ?? false;
  const labelId = useId();
  const descriptionId = useId();

  const setChecked = (next: boolean) => {
    if (controlled === undefined) setUncontrolled(next);
    onCheckedChange?.(next);
  };

  const squash = reduced ? { scaleX: 1, scaleY: 1 } : { scaleX: [1, 1 + SQUASH, 1], scaleY: [1, 1 - SQUASH, 1] };
  const thumb = {
    on: { x: TRAVEL, ...squash, transition: { duration: reduced ? 0 : TOGGLE_MS.on / 1000, ease: bezier(EASING_POINTS.out) } },
    off: { x: 0, ...squash, transition: { duration: reduced ? 0 : TOGGLE_MS.off / 1000, ease: bezier(EASING_POINTS.in) } },
  };

  return (
    <label
      data-testid={testId}
      data-disabled={disabled ? "" : undefined}
      className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 select-none data-[disabled]:cursor-not-allowed"
    >
      <span className="min-w-0">
        <span id={labelId} className="block text-[15px] leading-snug font-medium text-ink">
          {label}
        </span>
        {description ? (
          <span id={descriptionId} className="mt-0.5 block text-sm leading-snug text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={setChecked}
        disabled={disabled}
        name={name}
        aria-labelledby={labelId}
        aria-describedby={description ? descriptionId : undefined}
        className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-control-line p-[3px] transition-colors duration-120 ease-kit-in outline-offset-2 data-[checked]:bg-accent data-[checked]:duration-180 data-[checked]:ease-kit-out data-[disabled]:opacity-50 motion-reduce:transition-none"
      >
        <Switch.Thumb
          render={
            <motion.span
              data-toggle-thumb
              className="block size-[18px] rounded-full bg-surface shadow-[0_1px_2px_rgb(10_12_16_/_0.24)]"
              initial={false}
              variants={thumb}
              animate={checked ? "on" : "off"}
            />
          }
        />
      </Switch.Root>
    </label>
  );
}

/** Live example for /kit/toggle-switch: three notification settings, one locked by policy. */
export function Playground() {
  const [email, setEmail] = useState(true);
  return (
    <div className="w-full max-w-[440px] rounded-panel border border-line bg-surface px-5 py-1">
      <div className="divide-y divide-[var(--mk-border)]">
        <ToggleSwitch
          data-testid="toggle-email"
          label="Email notifications"
          description="A message when someone mentions you."
          checked={email}
          onCheckedChange={setEmail}
          name="email"
        />
        <ToggleSwitch
          data-testid="toggle-updates"
          label="Product updates"
          description="Monthly news about new features."
          name="updates"
        />
        <ToggleSwitch
          data-testid="toggle-security"
          label="Security alerts"
          description="Always on for admin accounts."
          defaultChecked
          disabled
          name="security"
        />
      </div>
    </div>
  );
}
