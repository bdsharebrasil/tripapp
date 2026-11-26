import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Button } from "@/ui/Button";
import "./checkbox-radio.css";

/**
 * Checkbox and radio: native <input type="checkbox"> and <input type="radio"> with an animated
 * skin (checkbox-radio.css). No headless library: the browser already gives labels, Space to
 * toggle, arrow keys inside a same-name radio group, form submission and reset, the
 * :indeterminate state and the accessibility tree, so the inputs stay native and only their
 * paint changes (appearance: none plus an SVG tick or a dot drawn on top).
 * Motion: select 180 ms ease-out (box fills, tick draws with stroke-dashoffset, dot scales in);
 * clear 120 ms ease-in. Reduced motion: no transitions, state changes at once.
 */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "children"> {
  label: ReactNode;
  /** Mixed state (some children checked). Sets the native `indeterminate` property. */
  indeterminate?: boolean;
}

export function Checkbox({ label, indeterminate = false, className = "", ...input }: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className={`flex min-h-10 cursor-pointer items-center gap-3 text-[15px] leading-snug text-ink select-none has-[:disabled]:cursor-not-allowed ${className}`}>
      <span className="mk-choice mk-checkbox">
        <input ref={ref} type="checkbox" {...input} />
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path className="mk-tick" pathLength={1} d="M3.5 8.4 6.6 11.4 12.5 5" />
          <path className="mk-dash" d="M4 8h8" />
        </svg>
      </span>
      <span>{label}</span>
    </label>
  );
}

export interface RadioOption {
  value: string;
  label: ReactNode;
}

export interface RadioGroupProps {
  legend: ReactNode;
  /** Shared native name: arrow keys move between options with the same name. */
  name: string;
  options: RadioOption[];
  value: string;
  onValueChange(value: string): void;
  className?: string;
}

/** fieldset + legend around same-name native radios. */
export function RadioGroup({ legend, name, options, value, onValueChange, className = "" }: RadioGroupProps) {
  return (
    <fieldset className={`m-0 min-w-0 border-0 p-0 ${className}`}>
      <legend className="mb-1 p-0 text-sm font-semibold text-ink">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex min-h-10 cursor-pointer items-center gap-3 text-[15px] leading-snug text-ink select-none">
          <span className="mk-choice mk-radio">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onValueChange(o.value)} />
            <span aria-hidden="true" className="mk-dot" />
          </span>
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

const TOPICS = [
  { id: "mentions", label: "Mentions" },
  { id: "comments", label: "Comments" },
  { id: "digest", label: "Weekly digest" },
] as const;
type Topic = (typeof TOPICS)[number]["id"];

const DELIVERY: RadioOption[] = [
  { value: "instant", label: "Instantly" },
  { value: "daily", label: "Daily summary" },
  { value: "weekly", label: "Weekly summary" },
];

const INITIAL: Record<Topic, boolean> = { mentions: true, comments: false, digest: false };

/**
 * Live example for /kit/checkbox-radio: a "Select all" parent with three topics (mixed state when
 * only some are on), a delivery radio group and Reset, the same card the demo shows.
 */
export function Playground() {
  const [topics, setTopics] = useState(INITIAL);
  const [delivery, setDelivery] = useState("daily");
  const on = TOPICS.filter((t) => topics[t.id]).length;
  const all = on === TOPICS.length;
  const some = on > 0 && !all;

  return (
    <div className="w-full max-w-[520px] rounded-panel border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="m-0 text-base font-semibold text-ink">Notifications</p>
          <p className="m-0 mt-0.5 text-sm text-muted">Choose topics and how often they arrive.</p>
        </div>
        <Button
          variant="secondary"
          data-testid="choice-reset"
          onClick={() => {
            setTopics(INITIAL);
            setDelivery("daily");
          }}
        >
          Reset
        </Button>
      </div>
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <fieldset className="m-0 min-w-0 border-0 p-0">
          <legend className="mb-1 p-0 text-sm font-semibold text-ink">Topics</legend>
          <Checkbox
            label="Select all"
            checked={all}
            indeterminate={some}
            aria-controls={TOPICS.map((t) => `topic-${t.id}`).join(" ")}
            onChange={() => setTopics({ mentions: !all, comments: !all, digest: !all })}
          />
          <div className="pl-8">
            {TOPICS.map((t) => (
              <Checkbox
                key={t.id}
                id={`topic-${t.id}`}
                name="topics"
                value={t.id}
                label={t.label}
                checked={topics[t.id]}
                onChange={(e) => {
                  // Read the value now: React clears currentTarget before a deferred updater runs.
                  const checked = e.currentTarget.checked;
                  setTopics((prev) => ({ ...prev, [t.id]: checked }));
                }}
              />
            ))}
          </div>
        </fieldset>
        <RadioGroup legend="Delivery" name="delivery" options={DELIVERY} value={delivery} onValueChange={setDelivery} />
      </div>
    </div>
  );
}
