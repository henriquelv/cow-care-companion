import { AlertTriangle, CheckCircle2, Info, XCircle, X } from "lucide-react";
import { cn } from "@/dominio/utils";

export type ActionToastData = {
  title: string;
  message?: string;
  tone?: "success" | "error" | "warning" | "info";
};

export function ActionToast({ toast, onClose }: { toast: ActionToastData; onClose: () => void }) {
  const tone = toast.tone ?? "success";
  const Icon =
    tone === "error"
      ? XCircle
      : tone === "warning"
        ? AlertTriangle
        : tone === "info"
          ? Info
          : CheckCircle2;

  return (
    <aside
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-3 right-3 z-[70] mx-auto flex w-auto max-w-md items-start gap-3 rounded-lg border-2 bg-card p-3 text-foreground shadow-2xl sm:left-auto sm:right-5 sm:mx-0 sm:min-w-80",
        tone === "success" && "border-good/50",
        tone === "error" && "border-danger/60",
        tone === "warning" && "border-warn/70",
        tone === "info" && "border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          tone === "success" && "bg-good/10 text-good",
          tone === "error" && "bg-danger/10 text-danger",
          tone === "warning" && "bg-warn/15 text-warn-foreground",
          tone === "info" && "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 py-0.5">
        <strong className="block break-words font-display text-sm font-black uppercase">
          {toast.title}
        </strong>
        {toast.message ? (
          <span className="mt-0.5 block break-words text-xs leading-relaxed text-muted-foreground">
            {toast.message}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        onClick={onClose}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        aria-label="Fechar aviso"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </aside>
  );
}
