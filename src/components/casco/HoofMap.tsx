import { Check, AlertTriangle } from "lucide-react";
import type { FootKey } from "@/lib/casco-store";
import { cn } from "@/lib/utils";

interface Props {
  status: Record<FootKey, "ok" | "bad" | null>;
  active?: FootKey | null;
  onSelect?: (foot: FootKey) => void;
}

const positions: { key: FootKey; label: string; row: 1 | 2; side: "L" | "R" }[] = [
  { key: "FE", label: "Frente Esq.", row: 1, side: "L" },
  { key: "FD", label: "Frente Dir.", row: 1, side: "R" },
  { key: "TE", label: "Trás Esq.", row: 2, side: "L" },
  { key: "TD", label: "Trás Dir.", row: 2, side: "R" },
];

export function HoofMap({ status, active, onSelect }: Props) {
  return (
    <div className="relative mx-auto w-full max-w-sm">
      {/* silhueta esquemática */}
      <div className="relative grid grid-cols-2 gap-x-10 gap-y-4 rounded-2xl bg-surface p-5">
        <div className="pointer-events-none absolute inset-x-10 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-border" />
        <div className="pointer-events-none absolute left-1/2 inset-y-6 w-0.5 -translate-x-1/2 rounded bg-border" />
        {positions.map((p) => {
          const s = status[p.key];
          const isOk = s === "ok";
          const isBad = s === "bad";
          const isActive = active === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => onSelect?.(p.key)}
              className={cn(
                "tap-lg relative flex flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card p-3 font-display text-sm uppercase transition-all",
                "hover:scale-[1.02] active:scale-[0.98]",
                isOk && "border-good bg-good/10 text-good",
                isBad && "border-danger bg-danger/10 text-danger",
                !isOk && !isBad && "border-border text-muted-foreground",
                isActive && "ring-4 ring-ring ring-offset-2 ring-offset-background",
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full",
                  isOk && "bg-good text-good-foreground",
                  isBad && "bg-danger text-danger-foreground animate-pulse",
                  !isOk && !isBad && "bg-muted text-muted-foreground",
                )}
              >
                {isOk ? (
                  <Check className="h-5 w-5" strokeWidth={3} />
                ) : isBad ? (
                  <AlertTriangle className="h-5 w-5" strokeWidth={2.5} />
                ) : (
                  <span className="text-xs">?</span>
                )}
              </div>
              <span className="text-[11px] leading-tight">{p.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span>← Esquerdo</span>
        <span>Direito →</span>
      </div>
    </div>
  );
}
