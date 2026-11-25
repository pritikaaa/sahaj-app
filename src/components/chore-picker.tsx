"use client";
import { CHORES } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Multi-select chips (M5: a booking can include several chores). */
export function ChorePicker({
  value,
  onChange,
  options = CHORES,
  legend = "Chores",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options?: readonly string[];
  legend?: string;
}) {
  const toggle = (c: string) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((c) => {
          const on = value.includes(c);
          return (
            <button
              key={c}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
                on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
              )}
            >
              {c}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
