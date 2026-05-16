import { LESIONS, ZONE_LABEL, type DiseaseEntry, type LesionCode, type Severity, type Zone } from "@/lib/casco-store";
import { cn } from "@/lib/utils";

interface Props {
  diseases: DiseaseEntry[];
  onChange: (diseases: DiseaseEntry[]) => void;
}

const SEV_STYLES: Record<Severity, string> = {
  0: "bg-muted text-muted-foreground",
  1: "bg-warn/80 text-warn-foreground font-black",
  2: "bg-accent text-accent-foreground font-black",
  3: "bg-danger/80 text-danger-foreground font-black",
  4: "bg-danger text-danger-foreground font-black ring-2 ring-danger/60",
};

const SEV_LABEL: Record<Severity, string> = { 0: "—", 1: "1", 2: "2", 3: "3", 4: "4" };

const ALL_ZONES = Array.from({ length: 13 }, (_, i) => i) as Zone[];

function ZoneChips({
  selected,
  onToggle,
}: {
  selected: Zone[];
  onToggle: (z: Zone) => void;
}) {
  return (
    <div className="mt-2">
      <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
        Zonas afetadas por esta doença (opcional)
      </p>
      <div className="grid grid-cols-7 gap-1">
        {ALL_ZONES.map((z) => {
          const active = selected.includes(z);
          return (
            <button
              key={z}
              type="button"
              onClick={() => onToggle(z)}
              title={ZONE_LABEL[z]}
              className={cn(
                "flex aspect-square items-center justify-center rounded-lg border-2 text-xs font-black transition-all active:scale-90",
                active
                  ? "border-danger bg-danger/20 text-danger"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              {z}
            </button>
          );
        })}
      </div>
      {selected.length > 0 && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          {selected.sort((a, b) => a - b).map((z) => `Z${z}`).join(" · ")}
        </p>
      )}
    </div>
  );
}

function DiseaseRow({
  code,
  full,
  emoji,
  severity,
  zones,
  onSet,
  onToggleZone,
}: {
  code: LesionCode;
  full: string;
  emoji: string;
  severity: Severity;
  zones: Zone[];
  onSet: (s: Severity) => void;
  onToggleZone: (z: Zone) => void;
}) {
  const isActive = severity > 0;

  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 transition-all",
        isActive ? "border-danger/50 bg-danger/5" : "border-border bg-surface",
      )}
    >
      {/* Cabeçalho da doença */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl leading-none">{emoji}</span>
        <div className="flex-1 min-w-0">
          <span className="font-display text-lg font-black uppercase tracking-wide">{code}</span>
          <span className="ml-2 text-xs text-muted-foreground leading-tight">{full}</span>
        </div>
        {isActive && (
          <span className={cn("shrink-0 rounded-lg px-2 py-0.5 text-xs font-black uppercase", SEV_STYLES[severity])}>
            Grav. {severity}
          </span>
        )}
      </div>

      {/* Barra de gravidade 0–4 */}
      <div className="grid grid-cols-5 gap-1.5">
        {([0, 1, 2, 3, 4] as Severity[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSet(s)}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-2 transition-all active:scale-95",
              severity === s
                ? cn("border-transparent scale-[1.06] stamp", SEV_STYLES[s])
                : "border-border bg-card text-muted-foreground",
            )}
          >
            <div className="flex items-end gap-0.5 h-4">
              {s === 0 ? (
                <span className="text-xs font-bold leading-none">—</span>
              ) : (
                [1, 2, 3, 4].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      "w-1 rounded-sm",
                      n <= s
                        ? severity === s ? "bg-current" : "bg-foreground/50"
                        : "bg-foreground/10",
                    )}
                    style={{ height: `${n * 3 + 1}px` }}
                  />
                ))
              )}
            </div>
            <span className="font-display text-[11px] font-black">{SEV_LABEL[s]}</span>
          </button>
        ))}
      </div>

      {/* Seletor de zonas (só quando ativa) */}
      {isActive && (
        <ZoneChips selected={zones} onToggle={onToggleZone} />
      )}
    </div>
  );
}

export function DiseasePicker({ diseases, onChange }: Props) {
  function getSeverity(code: LesionCode): Severity {
    return diseases.find((d) => d.code === code)?.severity ?? 0;
  }

  function getZones(code: LesionCode): Zone[] {
    return diseases.find((d) => d.code === code)?.zones ?? [];
  }

  function setSeverity(code: LesionCode, s: Severity) {
    if (s === 0) {
      onChange(diseases.filter((d) => d.code !== code));
    } else {
      const existing = diseases.find((d) => d.code === code);
      if (existing) {
        onChange(diseases.map((d) => (d.code === code ? { ...d, severity: s } : d)));
      } else {
        onChange([...diseases, { code, severity: s, zones: [] }]);
      }
    }
  }

  function toggleZone(code: LesionCode, z: Zone) {
    const existing = diseases.find((d) => d.code === code);
    if (!existing) return;
    const cur = existing.zones ?? [];
    const next = cur.includes(z) ? cur.filter((x) => x !== z) : [...cur, z];
    onChange(diseases.map((d) => (d.code === code ? { ...d, zones: next } : d)));
  }

  const activeDiseases = diseases.filter((d) => d.severity > 0);

  return (
    <div className="space-y-2">
      {activeDiseases.length > 0 && (
        <p className="text-xs font-bold text-danger">
          {activeDiseases.length} doença(s) marcada(s)
        </p>
      )}
      {LESIONS.map((l) => (
        <DiseaseRow
          key={l.code}
          code={l.code}
          full={l.full}
          emoji={l.emoji}
          severity={getSeverity(l.code)}
          zones={getZones(l.code)}
          onSet={(s) => setSeverity(l.code, s)}
          onToggleZone={(z) => toggleZone(l.code, z)}
        />
      ))}
    </div>
  );
}
