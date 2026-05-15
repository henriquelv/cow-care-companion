import { cn } from "@/lib/utils";
import { ZONE_LABEL, ZONE_SEVERITY_COLOR, type Zone, type Severity } from "@/lib/casco-store";

interface Props {
  selectedZones: Zone[];
  onToggleZone: (z: Zone) => void;
  foot: "FE" | "FD" | "TE" | "TD";
  severity?: Severity;
}

// ViewBox: 0 0 110 148
// Layout: Ponta (toe) no topo, Talão (heel) na base
// 6 linhas de zonas clipadas ao contorno do casco

const HOOF_PATH =
  "M 55,5 C 84,5 102,22 102,54 L 102,97 Q 102,134 80,141 Q 55,148 30,141 Q 8,134 8,97 L 8,54 C 8,22 26,5 55,5 Z";

// Cada zona: retângulo que será clipado ao contorno
const ZONES: {
  id: Zone;
  x: number; y: number; w: number; h: number;
  lx: number; ly: number;
  fs?: number;
}[] = [
  // ── Linha 1: Ponta ──────────────────────────────────────────
  { id:  1, x:  8, y:  5, w: 94, h: 27, lx: 55, ly: 22 },

  // ── Linha 2: Parede frontal esq / dir ───────────────────────
  { id:  2, x:  8, y: 32, w: 44, h: 26, lx: 30, ly: 48 },
  { id:  3, x: 57, y: 32, w: 45, h: 26, lx: 79, ly: 48 },

  // ── Linha 3: Paredes laterais + Sola central ────────────────
  { id:  7, x:  8, y: 58, w: 15, h: 38, lx: 15, ly: 80, fs: 6.5 },
  { id:  0, x: 23, y: 58, w: 64, h: 38, lx: 55, ly: 80 },
  { id:  9, x: 87, y: 58, w: 15, h: 38, lx: 95, ly: 80, fs: 6.5 },

  // ── Linha 4: Sola posterior esq / dir ───────────────────────
  { id:  4, x:  8, y: 96, w: 44, h: 18, lx: 30, ly: 108 },
  { id:  5, x: 57, y: 96, w: 45, h: 18, lx: 79, ly: 108 },

  // ── Linha 5: Talão esq / centro / dir ───────────────────────
  { id:  6, x:  8, y:114, w: 29, h: 17, lx: 22, ly: 126 },
  { id: 11, x: 37, y:114, w: 36, h: 17, lx: 55, ly: 126 },
  { id:  8, x: 73, y:114, w: 29, h: 17, lx: 88, ly: 126 },

  // ── Linha 6: Bulbo do talão esq / dir ───────────────────────
  { id: 10, x:  8, y:131, w: 44, h: 17, lx: 30, ly: 143 },
  { id: 12, x: 57, y:131, w: 45, h: 17, lx: 79, ly: 143 },
];

const DIVIDERS = [
  // horizontais
  "M8,32 H102", "M8,58 H102", "M8,96 H102", "M8,114 H102", "M8,131 H102",
  // linha 2: vertical centro
  "M55,32 V58",
  // linha 3: paredes laterais
  "M23,58 V96", "M87,58 V96",
  // linha 4: vertical centro
  "M55,96 V114",
  // linha 5: dois terços
  "M37,114 V131", "M73,114 V131",
  // linha 6: vertical centro
  "M55,131 V148",
];

// Cor neutra para zonas não selecionadas (terra/bege fazenda)
const NEUTRAL_FILL   = "oklch(0.90 0.025 80)";
const NEUTRAL_TEXT   = "#5c4a2a";

export function HoofZoneMap({ selectedZones, onToggleZone, foot, severity = 0 }: Props) {
  const isRight = foot === "FD" || foot === "TD";
  const activeCol = ZONE_SEVERITY_COLOR[severity];

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Rótulo orientação */}
      <div className="flex w-full max-w-[280px] justify-between px-1 text-[10px] font-bold uppercase text-muted-foreground">
        <span>{isRight ? "← Int." : "← Ext."}</span>
        <span>↑ Ponta</span>
        <span>{isRight ? "Ext. →" : "Int. →"}</span>
      </div>

      {/* SVG do casco */}
      <svg
        viewBox="0 0 110 150"
        className={cn(
          "w-full max-w-[280px] drop-shadow-lg",
          isRight && "-scale-x-100",
        )}
        style={{ touchAction: "none" }}
      >
        <defs>
          <clipPath id="hc">
            <path d={HOOF_PATH} />
          </clipPath>
        </defs>

        {/* Fundo do casco */}
        <path d={HOOF_PATH} fill={NEUTRAL_FILL} stroke="#8b7355" strokeWidth="2" />

        {/* Zonas (preenchimento), clipadas */}
        <g clipPath="url(#hc)">
          {ZONES.map((z) => {
            const sel = selectedZones.includes(z.id);
            return (
              <rect
                key={z.id}
                x={z.x} y={z.y}
                width={z.w} height={z.h}
                fill={sel ? activeCol.fill : NEUTRAL_FILL}
                opacity={sel ? 1 : 0.55}
              />
            );
          })}
        </g>

        {/* Divisórias, clipadas ao contorno */}
        <g clipPath="url(#hc)" stroke="#8b7355" strokeWidth="1.3" fill="none">
          {DIVIDERS.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* Contorno por cima de tudo */}
        <path d={HOOF_PATH} fill="none" stroke="#5c4a2a" strokeWidth="2" />

        {/* Highlight de seleção (borda interna da zona) clipado */}
        <g clipPath="url(#hc)">
          {ZONES.filter((z) => selectedZones.includes(z.id)).map((z) => (
            <rect
              key={`sel-${z.id}`}
              x={z.x + 1} y={z.y + 1}
              width={z.w - 2} height={z.h - 2}
              fill="none"
              stroke={activeCol.stroke}
              strokeWidth="2"
            />
          ))}
        </g>

        {/* Labels + área de toque */}
        {ZONES.map((z) => {
          const sel = selectedZones.includes(z.id);
          const textColor = sel ? activeCol.text : NEUTRAL_TEXT;
          return (
            <g
              key={`lbl-${z.id}`}
              onClick={() => onToggleZone(z.id)}
              style={{ cursor: "pointer" }}
            >
              {/* Área de toque invisível (tamanho real da zona) */}
              <rect
                x={z.x} y={z.y}
                width={z.w} height={z.h}
                fill="transparent"
              />
              {/* Número da zona */}
              <text
                x={z.lx} y={z.ly + 1}
                textAnchor="middle"
                fontSize={z.fs ?? 8}
                fontWeight="900"
                fill={textColor}
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
            backgroundColor: activeCol.fill + "dd",
            color: activeCol.text,
            borderLeft: `4px solid ${activeCol.stroke}`,
          }}
        >
          {selectedZones.length === 1
            ? `Zona ${selectedZones[0]} — ${ZONE_LABEL[selectedZones[0]]}`
            : `Zonas: ${[...selectedZones].sort((a, b) => a - b).join(", ")}`}
        </div>
      )}

      {/* Grade numérica rápida (toque alternativo) */}
      <div className="w-full max-w-[280px]">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Atalho — tocar no número
        </p>
        <div className="grid grid-cols-7 gap-1.5">
          {(Array.from({ length: 13 }, (_, i) => i) as Zone[]).map((z) => {
            const sel = selectedZones.includes(z);
            return (
              <button
                key={z}
                type="button"
                onClick={() => onToggleZone(z)}
                style={
                  sel
                    ? { backgroundColor: activeCol.fill, borderColor: activeCol.stroke, color: activeCol.text }
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
