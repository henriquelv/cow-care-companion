import type { Severity } from "@/lib/casco-store";
import { cn } from "@/lib/utils";

const items: { value: Severity; label: string; color: string }[] = [
  { value: 1, label: "Leve", color: "bg-good text-good-foreground" },
  { value: 2, label: "Médio", color: "bg-warn text-warn-foreground" },
  { value: 3, label: "Grave", color: "bg-accent text-accent-foreground" },
  { value: 4, label: "Muito grave", color: "bg-danger text-danger-foreground" },
];

export function SeverityPicker({
  value,
  onChange,
}: {
  value?: Severity;
  onChange: (s: Severity) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "tap flex flex-col items-center justify-center gap-1 rounded-xl border-2 p-2 font-display text-xs uppercase transition-all",
              active
                ? `${it.color} border-transparent stamp scale-[1.03]`
                : "border-border bg-card text-muted-foreground hover:border-foreground/30",
            )}
          >
            <div className="flex items-end gap-0.5 h-5">
              {[1, 2, 3, 4].map((n) => (
                <span
                  key={n}
                  className={cn(
                    "w-1.5 rounded-sm",
                    n <= it.value
                      ? active
                        ? "bg-current"
                        : "bg-foreground/60"
                      : "bg-foreground/15",
                  )}
                  style={{ height: `${n * 4 + 4}px` }}
                />
              ))}
            </div>
            <span className="text-[10px] leading-tight">{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}
