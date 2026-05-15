import type { Severity } from "@/lib/casco-store";
import { cn } from "@/lib/utils";

const items: { value: Severity; label: string; emoji: string; color: string; bg: string }[] = [
  { value: 0, label: "Bom",        emoji: "✅", color: "text-good-foreground",  bg: "bg-good" },
  { value: 1, label: "Leve",       emoji: "🟡", color: "text-warn-foreground",  bg: "bg-warn" },
  { value: 2, label: "Médio",      emoji: "🟠", color: "text-accent-foreground", bg: "bg-accent" },
  { value: 3, label: "Grave",      emoji: "🔴", color: "text-danger-foreground", bg: "bg-danger" },
  { value: 4, label: "Muito Grave",emoji: "🚨", color: "text-danger-foreground", bg: "bg-danger" },
];

export function SeverityPicker({
  value,
  onChange,
}: {
  value?: Severity;
  onChange: (s: Severity) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange(it.value)}
            className={cn(
              "tap flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2 font-display text-xs uppercase transition-all active:scale-95",
              active
                ? `${it.bg} ${it.color} border-transparent stamp scale-[1.05]`
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <span className="text-2xl leading-none">{it.emoji}</span>
            <span className="font-display text-[10px] font-black leading-tight text-center">
              {it.value}
            </span>
            <span className="text-[9px] font-sans normal-case leading-tight text-center">
              {it.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
