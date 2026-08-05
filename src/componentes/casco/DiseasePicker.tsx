import {
  type DiseaseDefinition,
  type DiseaseEntry,
  type LesionCode,
  type Severity,
} from "@/dominio/casco-store";
import { cn } from "@/dominio/utils";

interface Props {
  catalog: DiseaseDefinition[];
  diseases: DiseaseEntry[];
  onChange: (diseases: DiseaseEntry[]) => void;
}

const SEV_STYLES: Record<Severity, string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-warn/80 text-warn-foreground font-black",
  2: "bg-accent text-accent-foreground font-black",
  3: "bg-danger text-danger-foreground font-black ring-2 ring-danger/60",
};

function DiseaseRow({
  code,
  full,
  name,
  emoji,
  severity,
  onSet,
}: {
  code: LesionCode;
  full: string;
  name: string;
  emoji: string;
  severity: Severity;
  onSet: (s: Severity) => void;
}) {
  const isActive = severity > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 transition-colors",
        isActive ? "border-danger/50 bg-danger/5" : "border-border bg-surface",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-base font-black uppercase leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground leading-tight">{full}</p>
        </div>
        {isActive && (
          <span
            className={cn(
              "shrink-0 rounded-lg px-2 py-0.5 text-xs font-black uppercase",
              SEV_STYLES[severity],
            )}
          >
            Grau {severity}
          </span>
        )}
      </div>

      {/* Barra de gravidade 0-3 */}
      <div className="grid grid-cols-4 gap-1.5">
        {([0, 1, 2, 3] as Severity[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSet(s)}
            aria-label={`${full}: ${s === 0 ? "ausente" : `grau ${s}`}`}
            className={cn(
              "flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-2.5 transition-[transform,background-color,border-color,color] active:scale-95",
              severity === s
                ? cn("border-transparent scale-[1.06] stamp", SEV_STYLES[s])
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <div className="flex items-end gap-0.5 h-4">
              {s === 0 ? (
                <span className="text-xs font-bold leading-none">—</span>
              ) : (
                [1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      "w-1.5 rounded-sm",
                      n <= s
                        ? severity === s
                          ? "bg-current"
                          : "bg-foreground/50"
                        : "bg-foreground/10",
                    )}
                    style={{ height: `${n * 3 + 2}px` }}
                  />
                ))
              )}
            </div>
            <span className="font-display text-[11px] font-black leading-none">
              {s === 0 ? "Não" : `G${s}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function DiseasePicker({ catalog, diseases, onChange }: Props) {
  function getSeverity(code: LesionCode): Severity {
    return diseases.find((d) => d.code === code)?.severity ?? 0;
  }

  function setSeverity(code: LesionCode, s: Severity) {
    if (s === 0) {
      onChange([]);
    } else {
      const existing = diseases.find((d) => d.code === code);
      onChange([{ ...(existing ?? { code }), severity: s }]);
    }
  }

  const activeDiseases = diseases.filter((d) => d.severity > 0);
  const selectedDisease = activeDiseases.reduce<DiseaseEntry | undefined>(
    (selected, disease) => (!selected || disease.severity > selected.severity ? disease : selected),
    undefined,
  );
  const visibleCatalog = selectedDisease
    ? catalog.filter((disease) => disease.code === selectedDisease.code)
    : catalog;

  return (
    <div className="space-y-2">
      {catalog.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Nenhuma doença ativa. O gerente pode ativar ou cadastrar doenças em Configurações.
        </p>
      )}
      {selectedDisease ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/10 px-3 py-2">
          <p className="text-sm font-bold text-primary">1 lesão selecionada</p>
          <button
            type="button"
            onClick={() => onChange([])}
            className="min-h-10 rounded-lg border border-primary/30 bg-card px-3 font-display text-xs font-black uppercase text-primary"
          >
            Trocar lesão
          </button>
        </div>
      ) : (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
          Escolha uma lesão. Para evitar erro, somente uma pode ser registrada por casco.
        </p>
      )}
      {visibleCatalog.map((l) => (
        <DiseaseRow
          key={l.code}
          code={l.code}
          full={l.full}
          name={l.name}
          emoji={l.emoji}
          severity={getSeverity(l.code)}
          onSet={(s) => setSeverity(l.code, s)}
        />
      ))}
    </div>
  );
}
