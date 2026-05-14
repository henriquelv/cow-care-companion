import { useRef } from "react";
import { Camera, Bandage, Droplets, Square, Ban, X } from "lucide-react";
import {
  FOOT_LABEL,
  LESIONS,
  TREATMENTS,
  type FootEntry,
  type LesionCode,
  type Treatment,
} from "@/lib/casco-store";
import { SeverityPicker } from "./SeverityPicker";
import { cn } from "@/lib/utils";

const TREAT_ICON: Record<Treatment, React.ComponentType<{ className?: string }>> = {
  BLOCO: Square,
  CURATIVO: Bandage,
  SPRAY: Droplets,
  NADA: Ban,
};

export function FootDetail({
  entry,
  onChange,
  onClose,
}: {
  entry: FootEntry;
  onChange: (e: FootEntry) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  function pickPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => onChange({ ...entry, photo: String(r.result) });
    r.readAsDataURL(file);
  }

  return (
    <div className="space-y-5 rounded-2xl border-2 border-danger/40 bg-card p-4 stamp">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-danger">
            Pé com problema
          </p>
          <h3 className="font-display text-2xl">{FOOT_LABEL[entry.foot]}</h3>
        </div>
        <button
          onClick={onClose}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Lesão
        </p>
        <div className="grid grid-cols-3 gap-2">
          {LESIONS.map((l) => {
            const active = entry.lesion === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => onChange({ ...entry, lesion: l.code as LesionCode })}
                className={cn(
                  "tap rounded-xl border-2 p-2 font-display text-sm uppercase transition-all",
                  active
                    ? "border-foreground bg-foreground text-background stamp"
                    : "border-border bg-surface text-foreground hover:border-foreground/40",
                )}
              >
                <div className="text-base">{l.name}</div>
                <div className="text-[9px] font-sans normal-case opacity-70">{l.full}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Gravidade
        </p>
        <SeverityPicker
          value={entry.severity}
          onChange={(s) => onChange({ ...entry, severity: s })}
        />
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tratamento
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TREATMENTS.map((t) => {
            const Icon = TREAT_ICON[t.code];
            const active = entry.treatment === t.code;
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => onChange({ ...entry, treatment: t.code })}
                className={cn(
                  "tap-lg flex items-center gap-3 rounded-xl border-2 p-3 font-display uppercase transition-all",
                  active
                    ? "border-primary bg-primary text-primary-foreground stamp"
                    : "border-border bg-surface text-foreground hover:border-primary/40",
                )}
              >
                <Icon className="h-7 w-7" strokeWidth={2.2} />
                <span className="text-base">{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pickPhoto(e.target.files[0])}
        />
        {entry.photo ? (
          <div className="relative">
            <img
              src={entry.photo}
              alt="Casco"
              className="h-40 w-full rounded-xl object-cover"
            />
            <button
              onClick={() => onChange({ ...entry, photo: undefined })}
              className="absolute right-2 top-2 rounded-full bg-background/90 p-2"
              aria-label="Remover foto"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface font-display uppercase text-muted-foreground hover:border-foreground/40 hover:text-foreground"
          >
            <Camera className="h-6 w-6" />
            Foto do casco
          </button>
        )}
      </section>
    </div>
  );
}
