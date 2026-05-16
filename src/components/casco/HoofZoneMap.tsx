import { cn } from "@/lib/utils";
import { ZONE_LABEL, ZONE_SEVERITY_COLOR, type Zone, type Severity } from "@/lib/casco-store";

interface Props {
  selectedZones: Zone[];
  onToggleZone: (z: Zone) => void;
  foot: "FE" | "FD" | "TE" | "TD";
  severity?: Severity;
}

// ViewBox: 0 0 210 175
// Visão plantar (sola para cima), ponta no topo, talão na base
// Dois dígitos lado a lado + painéis de parede abaxial

const VBOX_W = 210;

// Dígito medial (esq. no SVG) — zonas esq.
const LEFT_CLAW =
  "M 55,6 C 29,6 12,22 12,48 L 12,122 Q 12,154 33,160 Q 55,166 77,160 Q 98,154 98,122 L 98,48 C 98,22 81,6 55,6 Z";

// Dígito lateral (dir. no SVG) — zonas dir.
const RIGHT_CLAW =
  "M 155,6 C 129,6 112,22 112,48 L 112,122 Q 112,154 133,160 Q 155,166 177,160 Q 198,154 198,122 L 198,48 C 198,22 181,6 155,6 Z";

type ClipTarget = "left" | "right" | "none";

const ZONES: {
  id: Zone;
  x: number; y: number; w: number; h: number;
  lx: number; ly: number;
  clip: ClipTarget;
  fs?: number;
}[] = [
  // ── Dígito medial (esq.) ────────────────────────────────────────
  { id:  1, x: 12, y:  6, w: 86, h: 40, lx: 55, ly: 30,  clip: "left" },
  { id:  2, x: 12, y: 46, w: 86, h: 38, lx: 55, ly: 68,  clip: "left" },
  { id:  4, x: 12, y: 84, w: 86, h: 36, lx: 55, ly:105,  clip: "left" },
  { id:  6, x: 12, y:120, w: 86, h: 24, lx: 55, ly:135,  clip: "left" },
  { id: 10, x: 12, y:144, w: 86, h: 22, lx: 55, ly:158,  clip: "left", fs: 7 },

  // ── Dígito lateral (dir.) ───────────────────────────────────────
  { id:  0, x:112, y:  6, w: 86, h: 40, lx:155, ly: 30,  clip: "right" },
  { id:  3, x:112, y: 46, w: 86, h: 38, lx:155, ly: 68,  clip: "right" },
  { id:  5, x:112, y: 84, w: 86, h: 36, lx:155, ly:105,  clip: "right" },
  { id:  8, x:112, y:120, w: 86, h: 24, lx:155, ly:135,  clip: "right" },
  { id: 12, x:112, y:144, w: 86, h: 22, lx:155, ly:158,  clip: "right", fs: 7 },

  // ── Painéis de parede abaxial (sem clip) ────────────────────────
  { id:  7, x:  0, y: 28, w: 12, h:110, lx:  6, ly: 83,  clip: "none", fs: 6 },
  { id:  9, x:198, y: 28, w: 12, h:110, lx:204, ly: 83,  clip: "none", fs: 6 },

  // ── Espaço interdigital / bulbo central ─────────────────────────
  { id: 11, x: 98, y:120, w: 14, h: 46, lx:105, ly:146,  clip: "none", fs: 6 },
];

const LEFT_DIVIDERS  = ["M12,46 H98",  "M12,84 H98",  "M12,120 H98",  "M12,144 H98"];
const RIGHT_DIVIDERS = ["M112,46 H198","M112,84 H198","M112,120 H198","M112,144 H198"];

const NEUTRAL_FILL = "oklch(0.90 0.025 80)";
const NEUTRAL_TEXT = "#5c4a2a";
const WALL_FILL    = "oklch(0.84 0.022 80)";

export function HoofZoneMap({ selectedZones, onToggleZone, foot, severity = 0 }: Props) {
  const isRight = foot === "FD" || foot === "TD";
  const col = ZONE_SEVERITY_COLOR[severity];
  const clipL = `lc-${foot}`;
  const clipR = `rc-${foot}`;

  const leftZones  = ZONES.filter((z) => z.clip === "left");
  const rightZones = ZONES.filter((z) => z.clip === "right");
  const freeZones  = ZONES.filter((z) => z.clip === "none");

  function fillFor(id: Zone) {
    return selectedZones.includes(id) ? col.fill : NEUTRAL_FILL;
  }
  function wallFillFor(id: Zone) {
    return selectedZones.includes(id) ? col.fill : WALL_FILL;
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Rótulos de orientação */}
      <div className="flex w-full max-w-[380px] justify-between px-4 text-[10px] font-bold uppercase text-muted-foreground">
        <span>{isRight ? "← Ext." : "← Ext."}</span>
        <span>↑ Ponta</span>
        <span>{isRight ? "Ext. →" : "Ext. →"}</span>
      </div>

      <svg
        viewBox={`0 0 ${VBOX_W} 175`}
        className={cn(
          "w-full max-w-[380px] drop-shadow-lg",
          isRight && "-scale-x-100",
        )}
        style={{ touchAction: "none" }}
      >
        <defs>
          <clipPath id={clipL}><path d={LEFT_CLAW}  /></clipPath>
          <clipPath id={clipR}><path d={RIGHT_CLAW} /></clipPath>
        </defs>

        {/* ── Fundos dos dígitos ─────────────────────────────────── */}
        <path d={LEFT_CLAW}  fill={NEUTRAL_FILL} stroke="#8b7355" strokeWidth="2" />
        <path d={RIGHT_CLAW} fill={NEUTRAL_FILL} stroke="#8b7355" strokeWidth="2" />

        {/* ── Painéis externos (paredes + interdigital) ─────────── */}
        <rect x="0"   y="28" width="12" height="110" fill={wallFillFor(7)}  rx="3" stroke="#8b7355" strokeWidth="1" />
        <rect x="198" y="28" width="12" height="110" fill={wallFillFor(9)}  rx="3" stroke="#8b7355" strokeWidth="1" />
        <rect x="98"  y="120" width="14" height="46" fill={wallFillFor(11)} stroke="#8b7355" strokeWidth="1" />

        {/* ── Preenchimento das zonas selecionadas ──────────────── */}
        <g clipPath={`url(#${clipL})`}>
          {leftZones.map((z) => (
            <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h}
              fill={fillFor(z.id)}
              opacity={selectedZones.includes(z.id) ? 1 : 0.6}
            />
          ))}
        </g>
        <g clipPath={`url(#${clipR})`}>
          {rightZones.map((z) => (
            <rect key={z.id} x={z.x} y={z.y} width={z.w} height={z.h}
              fill={fillFor(z.id)}
              opacity={selectedZones.includes(z.id) ? 1 : 0.6}
            />
          ))}
        </g>

        {/* ── Divisórias internas ───────────────────────────────── */}
        <g clipPath={`url(#${clipL})`} stroke="#8b7355" strokeWidth="1.2" fill="none">
          {LEFT_DIVIDERS.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g clipPath={`url(#${clipR})`} stroke="#8b7355" strokeWidth="1.2" fill="none">
          {RIGHT_DIVIDERS.map((d, i) => <path key={i} d={d} />)}
        </g>

        {/* ── Contornos sobre tudo ──────────────────────────────── */}
        <path d={LEFT_CLAW}  fill="none" stroke="#5c4a2a" strokeWidth="2" />
        <path d={RIGHT_CLAW} fill="none" stroke="#5c4a2a" strokeWidth="2" />

        {/* ── Bordas de seleção ─────────────────────────────────── */}
        <g clipPath={`url(#${clipL})`}>
          {leftZones.filter((z) => selectedZones.includes(z.id)).map((z) => (
            <rect key={`sel-${z.id}`} x={z.x + 1} y={z.y + 1} width={z.w - 2} height={z.h - 2}
              fill="none" stroke={col.stroke} strokeWidth="2.5" />
          ))}
        </g>
        <g clipPath={`url(#${clipR})`}>
          {rightZones.filter((z) => selectedZones.includes(z.id)).map((z) => (
            <rect key={`sel-${z.id}`} x={z.x + 1} y={z.y + 1} width={z.w - 2} height={z.h - 2}
              fill="none" stroke={col.stroke} strokeWidth="2.5" />
          ))}
        </g>
        {freeZones.filter((z) => selectedZones.includes(z.id)).map((z) => (
          <rect key={`sel-${z.id}`} x={z.x + 1} y={z.y + 1} width={z.w - 2} height={z.h - 2}
            fill="none" stroke={col.stroke} strokeWidth="2" />
        ))}

        {/* ── Áreas de toque + números das zonas ───────────────── */}
        {ZONES.map((z) => {
          const sel = selectedZones.includes(z.id);
          return (
            <g key={`lbl-${z.id}`} onClick={() => onToggleZone(z.id)} style={{ cursor: "pointer" }}>
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="transparent" />
              <text
                x={z.lx} y={z.ly}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={z.fs ?? 9}
                fontWeight="900"
                fill={sel ? col.text : NEUTRAL_TEXT}
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

      {/* ── Legenda das zonas selecionadas ─────────────────────── */}
      {selectedZones.length > 0 && (
        <div
          className="w-full max-w-[380px] rounded-xl px-3 py-2 text-center text-sm font-semibold transition-all"
          style={{
            backgroundColor: col.fill + "dd",
            color: col.text,
            borderLeft: `4px solid ${col.stroke}`,
          }}
        >
          {selectedZones.length === 1
            ? `Zona ${selectedZones[0]} — ${ZONE_LABEL[selectedZones[0]]}`
            : `Zonas: ${[...selectedZones].sort((a, b) => a - b).join(", ")}`}
        </div>
      )}

      {/* ── Grade numérica (atalho de toque) ───────────────────── */}
      <div className="w-full max-w-[380px]">
        <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Atalho — toque no número
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
