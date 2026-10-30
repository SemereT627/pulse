"use client";

import { useOptimistic, useTransition } from "react";
import { setToggleAction, type SettingToggle } from "./actions";

export function Toggle({ name, label, checked }: { name: SettingToggle; label: string; checked: boolean }) {
  const [, startTransition] = useTransition();
  const [on, setOn] = useOptimistic(checked);

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() =>
        startTransition(async () => {
          setOn(!on);
          await setToggleAction(name, !on);
        })
      }
      className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
        on ? "border-accent bg-accent" : "border-border bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-0.5 size-[18px] rounded-full transition-all ${
          on ? "left-[22px] bg-accent-foreground" : "left-0.5 bg-muted"
        }`}
      />
    </button>
  );
}
