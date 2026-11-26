import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { DURATION, EASING_POINTS } from "@/engine/tokens";
import { Button } from "@/ui/Button";
export interface SuccessCheckProps { show: boolean; message: string }
export function SuccessCheck({ show, message }: SuccessCheckProps) {
  const reduced = useReducedMotion();
  return <div role="status" className="min-h-20 text-ink" data-testid="success-check-panel">
    {show && <div className="flex items-center gap-3"><motion.svg aria-hidden="true" width="48" height="48" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={{ scale: reduced ? 1 : .98 }} animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : DURATION.enter / 1000, ease: [...EASING_POINTS.out] }}>
      <motion.circle cx="24" cy="24" r="20" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : .1, ease: [...EASING_POINTS.out] }} />
      <motion.path d="m14 24 7 7 13-14" initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ delay: reduced ? 0 : .1, duration: reduced ? 0 : .12, ease: [...EASING_POINTS.out] }} />
    </motion.svg><p className="m-0 text-base font-medium">{message}</p></div>}
  </div>;
}
export function Playground() {
  const [saved, setSaved] = useState(false);
  return <div data-testid="success-check-playground" className="w-full max-w-md space-y-4 text-ink"><p className="m-0 text-sm text-muted">Confirm your notification preferences.</p><div className="flex flex-wrap gap-2"><Button data-testid="success-check-trigger" onClick={() => setSaved(true)}>Save preferences</Button><Button variant="secondary" onClick={() => setSaved(false)}>Reset</Button></div><SuccessCheck show={saved} message="Preferences saved." /></div>;
}
