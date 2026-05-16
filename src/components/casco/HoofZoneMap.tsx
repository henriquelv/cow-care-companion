import { cn } from "@/lib/utils";
import { ZONE_LABEL, ZONE_SEVERITY_COLOR, type Zone, type Severity, type DiseaseEntry } from "@/lib/casco-store";

interface Props {
  selectedZones: Zone[];
  onToggleZone: (z: Zone) => void;
  foot: "FE" | "FD" | "TE" | "TD";
  severity?: Severity;
  diseases?: DiseaseEntry[];  // para colorir zona pela pior doença nela
}

// ViewBox: 0 0 110 162
// Visão plantar (sola para cima) — forma orgânica real de casco bovino
// Ponta (toe) no topo, talão (heel) na base com bulbos arredondados

const HOOF_PATH =
  "M 55,6 C 80,6 100,20 102,48 C 104,68 106,90 103,112 Q 100,142 80,148 Q 55,158 30,148 Q 10,142 7,112 C 4,90 6,68 8,48 C 10,20 30,6 55,6 Z";

const ZONES: {
  id: Zone;
  x: number; y: number; w: number; h: number;
  lx: number; ly: number;
  fs?: number;
}[] = [
  // ── Linha 1: Ponta ───────────────────────────────────────────
  { id:  1, x:  7, y:  6, w: 96, h: 30, lx: 55, ly: 24 },

  // ── Linha 2: Parede frontal esq / dir ────────────────────────
  { id:  2, x:  7, y: 36, w: 46, h: 28, lx: 30, ly: 52 },
  { id:  3, x: 57, y: 36, w: 46, h: 28, lx: 80, ly: 52 },

  // ── Linha 3: Paredes laterais + Sola central ─────────────────
  { id:  7, x:  7, y: 64, w: 16, h: 40, lx: 15, ly: 86, fs: 6.5 },
  { id:  0, x: 23, y: 64, w: 64, h: 40, lx: 55, ly: 86 },
  { id:  9, x: 87, y: 64, w: 16, h: 40, lx: 96, ly: 86, fs: 6.5 },

  // ── Linha 4: Sola posterior esq / dir ────────────────────────
  { id:  4, x:  7, y:104, w: 46, h: 20, lx: 30, ly: 116 },
  { id:  5, x: 57, y:104, w: 46, h: 20, lx: 80, ly: 116 },

  // ── Linha 5: Talão esq / centro / dir ────────────────────────
  { id:  6, x:  7, y:124, w: 30, h: 18, lx: 22, ly: 135 },
  { id: 11, x: 37, y:124, w: 36, h: 18, lx: 55, ly: 135 },
  { id:  8, x: 73, y:124, w: 30, h: 18, lx: 88, ly: 135 },

  // ── Linha 6: Bulbo do talão esq / dir ────────────────────────
  { id: 10, x:  7, y:142, w: 46, h: 16, lx: 30, ly: 152 },
  { id: 12, x: 57, y:142, w: 46, h: 16, lx: 80, ly: 152 },
];

const DIVIDERS = [
  // horizontais
  "M7,36 H103", "M7,64 H103", "M7,104 H103", "M7,124 H103", "M7,142 H103",
  // linha 2: vertical centro
  "M55,36 V64",
  // linha 3: paredes laterais
  "M23,64 V104", "M87,64 V104",
  // linha 4: vertical centro
  "M55,104 V124",
  // linha 5: dois terços
  "M37,124 V142", "M73,124 V142",
  // linha 6: vertical centro
  "M55,142 V158",
];

const NEUTRAL_FILL = "oklch(0.90 0.025 80)";
const NEUTRAL_TEXT = "#5c4a2a";

// Calcula a pior severidade de um conjunto de doenças numa zona específica
function worstSeverityForZone(zone: Zone, diseases: DiseaseEntry[]): Severity {
  let worst: Severity = 0;
  for (const d of diseases) {
    if (d.severity > 0 && d.zones?.includes(zone)) {
      if (d.severity > worst) worst = d.severity as Severity;
    }
  }
  return worst;
}

export function HoofZoneMap({ selectedZones, onToggleZone, foot, severity = 0, diseases = [] }: Props) {
  const isRight = foot === "FD" || foot === "TD";
  const clipId = `hc-${foot}`;
  const defaultCol = ZONE_SEVERITY_COLOR[severity];

  function zoneColor(id: Zone) {
    // Se houver doenças com zonas mapeadas, usar a pior severidade dessa zona
    const zoneSev = worstSeverityForZone(id, diseases);
    if (zoneSev > 0) return ZONE_SEVERITY_COLOR[zoneSev];
    return defaultCol;
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Rótulo de orientação */}
      <div className="flex w-full max-w-[280px] justify-between px-1 text-[10px] font-bold uppercase text-muted-foreground">
        <span>{isRight ? "← Int." : "← Ext."}</span>
        <span>↑ Ponta</span>
        <span>{isRight ? "Ext. →" : "Int. →"}</span>
      </div>

      {/* SVG do casco */}
      <svg
        viewBox="0 0 110 162"
        className={cn(
          "w-full max-w-[280px] drop-shadow-lg",
          isRight && "-scale-x-100",
        )}
        style={{ touchAction: "none" }}
      >
        <defs>
          <clipPath id={clipId}>
            <path d={HOOF_PATH} />
          </clipPath>
        </defs>

        {/* Fundo do casco */}
        <path d={HOOF_PATH} fill={NEUTRAL_FILL} stroke="#8b7355" strokeWidth="2" />

        {/* Zonas (preenchimento), clipadas */}
        <g clipPath={`url(#${clipId})`}>
          {ZONES.map((z) => {
            const sel = selectedZones.includes(z.id);
            const col = zoneColor(z.id);
            return (
              <rect
                key={z.id}
                x={z.x} y={z.y}
                width={z.w} height={z.h}
                fill={sel ? col.fill : NEUTRAL_FILL}
                opacity={sel ? 1 : 0.55}
              />
            );
          })}
        </g>

        {/* Divisórias, clipadas */}
        <g clipPath={`url(#${clipId})`} stroke="#8b7355" strokeWidth="1.3" fill="none">
          {DIVIDERS.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* Contorno por cima */}
        <path d={HOOF_PATH} fill="none" stroke="#5c4a2a" strokeWidth="2" />

        {/* Borda de seleção (highlight interno) */}
        <g clipPath={`url(#${clipId})`}>
          {ZONES.filter((z) => selectedZones.includes(z.id)).map((z) => {
            const col = zoneColor(z.id);
            return (
              <rect
                key={`sel-${z.id}`}
                x={z.x + 1} y={z.y + 1}
                width={z.w - 2} height={z.h - 2}
                fill="none"
                stroke={col.stroke}
                strokeWidth="2.5"
              />
            );
          })}
        </g>

        {/* Labels + área de toque */}
        {ZONES.map((z) => {
          const sel = selectedZones.includes(z.id);
          const col = zoneColor(z.id);
          const textColor = sel ? col.text : NEUTRAL_TEXT;
          return (
            <g
              key={`lbl-${z.id}`}
              onClick={() => onToggleZone(z.id)}
              style={{ cursor: "pointer" }}
            >
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="transparent" />
              <text
                x={z.lx} y={z.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={z.fs ?? 8}
                fontWeight="900"
                fill={textColor}
                transform={isRight ? `translate(${2 * z.lx},0) scale(-1,1)` : undefined}
                style={{ userSelect: "none", pointerEvents: "none", fontFamily: "Archivo Black, sans-serif" }}
              >
                {z.id}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-[10px] font-bold uppercase text-muted-foreground">Talão ↓</p>

      {/* Legenda das zonas selecionadas */}
      {selectedZones.length > 0 && (
        <div
          className="w-full max-w-[280px] rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all"
          style={{
            backgroundColor: defaultCol.fill + "dd",
            color: defaultCol.text,
            borderLeft: `4px solid ${defaultCol.stroke}`,
          }}
        >
          {selectedZones.length === 1
            ? `Zona ${selectedZones[0]} — ${ZONE_LABEL[selectedZones[0]]}`
            : `Zonas: ${[...selectedZones].sort((a, b) => a - b).join(", ")}`}
        </div>
      )}

      {/* Grade numérica rápida */}
      <div className="w-full max-w-[280px]">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Atalho — toque no número
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {(Array.from({ length: 13 }, (_, i) => i) as Zone[]).map((z) => {
            const sel = selectedZones.includes(z);
            const col = zoneColor(z);
            return (
              <button
                key={z}
                type="button"
                onClick={() => onToggleZone(z)}
                style={
                  sel
                    ? { backgroundColor: col.fill, borderColor: col.stroke, color: col.text }
                    : undefined
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded-xl border-2 font-display text-sm font-black transition-all active:scale-90",
                  sel ? "" : "border-border bg-surface text-foreground",
                )}
              >
                {z}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
