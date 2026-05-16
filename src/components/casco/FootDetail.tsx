import { useRef } from "react";
import { Camera, X, Clock, CheckCircle2 } from "lucide-react";
import {
  FOOT_LABEL,
  TREATMENTS,
  COMMENTS,
  footWorstSeverity,
  type CommentCode,
  type DiseaseEntry,
  type FootEntry,
  type TreatmentCode,
  type Zone,
} from "@/lib/casco-store";
import { DiseasePicker } from "./DiseasePicker";
import { HoofZoneMap } from "./HoofZoneMap";
import { cn } from "@/lib/utils";

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

  const diseases = entry.diseases ?? [];
  const zones = entry.zones ?? [];
  const treatments = entry.treatments ?? [];
  const comments = entry.comments ?? [];
  const worstSev = footWorstSeverity(entry);

  function pickPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => onChange({ ...entry, photo: String(r.result) });
    r.readAsDataURL(file);
  }

  function toggleTreatment(code: TreatmentCode) {
    if (code === "NADA") {
      onChange({ ...entry, treatments: ["NADA"] });
      return;
    }
    const cur = treatments.filter((c) => c !== "NADA");
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    onChange({ ...entry, treatments: next });
  }

  function toggleComment(code: CommentCode) {
    const next = comments.includes(code)
      ? comments.filter((c) => c !== code)
      : [...comments, code];
    onChange({ ...entry, comments: next });
  }

  function toggleZone(z: Zone) {
    const next = zones.includes(z) ? zones.filter((x) => x !== z) : [...zones, z];
    onChange({ ...entry, zones: next });
  }

  return (
    <div className="space-y-4 rounded-2xl border-2 border-danger/40 bg-card p-4 stamp">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-danger">
            {entry.resolved ? "✅ Curado" : "Com problema"}
          </p>
          <h3 className="font-display text-2xl">{FOOT_LABEL[entry.foot]}</h3>
        </div>
        <button
          onClick={onClose}
          className="tap flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Fechar"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* CURADO / AINDA TRATANDO */}
      <button
        type="button"
        onClick={() => onChange({ ...entry, resolved: !entry.resolved })}
        className={cn(
          "tap-lg flex w-full items-center justify-center gap-3 rounded-2xl border-2 font-display text-lg uppercase transition-all",
          entry.resolved
            ? "border-good bg-good text-good-foreground stamp"
            : "border-border bg-surface text-muted-foreground",
        )}
      >
        <CheckCircle2 className="h-7 w-7" />
        {entry.resolved ? "✅ Marcado como CURADO" : "Marcar como CURADO"}
      </button>

      {/* ZONA DO CASCO — sempre visível */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Zona do casco{zones.length > 0 ? ` · ${zones.length} selecionada(s)` : " · toque para marcar"}
        </p>
        <div className="rounded-2xl bg-surface p-3">
          <HoofZoneMap
            selectedZones={zones}
            onToggleZone={toggleZone}
            foot={entry.foot}
            severity={worstSev}
          />
        </div>
      </section>

      {/* DOENÇAS — uma linha por doença com barra 0-4 */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Doenças e Gravidade
        </p>
        <DiseasePicker
          diseases={diseases}
          onChange={(d: DiseaseEntry[]) => onChange({ ...entry, diseases: d })}
        />
      </section>

      {/* TRATAMENTO — seleção múltipla */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tratamento (pode marcar vários)
        </p>
        <div className="flex flex-col gap-1.5">
          {TREATMENTS.map((t) => {
            const active = treatments.includes(t.code);
            return (
              <button
                key={t.code}
                type="button"
                onClick={() => toggleTreatment(t.code)}
                className={cn(
                  "tap flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2 font-display uppercase transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary text-primary-foreground stamp"
                    : "border-border bg-surface text-foreground",
                )}
              >
                <span className="text-xl leading-none">{t.emoji}</span>
                <span className="text-sm">{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* COMENTÁRIOS D1–D6 */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Observações (D1–D6)
        </p>
        <div className="flex flex-col gap-1.5">
          {COMMENTS.map((c) => {
            const active = comments.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => toggleComment(c.code)}
                className={cn(
                  "tap flex w-full items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-display transition-all active:scale-95",
                  active
                    ? "border-primary bg-primary text-primary-foreground stamp"
                    : "border-border bg-surface text-foreground",
                )}
              >
                <span className="shrink-0 text-sm font-black">{c.code}</span>
                <span className="text-sm">{c.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* RECHECK */}
      <button
        type="button"
        onClick={() => onChange({ ...entry, recheck: !entry.recheck })}
        className={cn(
          "tap-lg flex w-full items-center justify-center gap-3 rounded-xl border-2 font-display text-base uppercase transition-all",
          entry.recheck
            ? "border-warn bg-warn text-warn-foreground stamp"
            : "border-border bg-surface text-muted-foreground",
        )}
      >
        <Clock className="h-6 w-6" />
        {entry.recheck ? "⏰ Precisa revisão" : "Marcar revisão futura"}
      </button>

      {/* FOTO */}
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
            <img src={entry.photo} alt="Casco" className="h-40 w-full rounded-xl object-cover" />
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
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface font-display uppercase text-muted-foreground"
          >
            <Camera className="h-6 w-6" />
            Tirar Foto do Casco
          </button>
        )}
      </section>
    </div>
  );
}
