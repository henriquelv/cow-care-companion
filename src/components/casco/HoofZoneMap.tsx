import { cn } from "@/lib/utils";
import { ZONE_LABEL, ZONE_SEVERITY_COLOR, type Zone, type Severity } from "@/lib/casco-store";

interface Props {
  selectedZones: Zone[];
  onToggleZone: (z: Zone) => void;
  foot: "FE" | "FD" | "TE" | "TD";
  severity?: Severity; // pior gravidade — determina a cor das zonas selecionadas
}

// Layout de zonas usando rects que serão clipadas ao contorno do casco
// Cada entrada: id da zona, rect(x, y, w, h), posição do label (lx, ly)
const ZONE_RECTS: {
  id: Zone;
  x: number;
  y: number;
  w: number;
  h: number;
  lx: number;
  ly: number;
  fs?: number; // fontSize override para zonas estreitas
}[] = [
  // Linha 1 – Ponta (toe)
  { id:  1, x:  5, y:  4, w: 90, h: 29, lx: 50, ly: 21 },
  // Linha 2 – Parede frontal esq / dir
  { id:  2, x:  5, y: 33, w: 44, h: 29, lx: 27, ly: 50 },
  { id:  3, x: 51, y: 33, w: 44, h: 29, lx: 73, ly: 50 },
  // Linha 3 – Paredes laterais + Sola central
  { id:  7, x:  5, y: 62, w: 16, h: 35, lx: 13, ly: 82, fs: 6 },
  { id:  0, x: 21, y: 62, w: 58, h: 35, lx: 50, ly: 82 },
  { id:  9, x: 79, y: 62, w: 16, h: 35, lx: 87, ly: 82, fs: 6 },
  // Linha 4 – Sola posterior esq / dir
  { id:  4, x:  5, y: 97, w: 44, h: 18, lx: 27, ly: 109 },
  { id:  5, x: 51, y: 97, w: 44, h: 18, lx: 73, ly: 109 },
  // Linha 5 – Talão esq / centro / dir
  { id:  6, x:  5, y:115, w: 29, h: 18, lx: 19, ly: 127 },
  { id: 11, x: 34, y:115, w: 32, h: 18, lx: 50, ly: 127 },
  { id:  8, x: 66, y:115, w: 29, h: 18, lx: 81, ly: 127 },
  // Linha 6 – Bulbo do talão esq / dir
  { id: 10, x:  5, y:133, w: 44, h: 18, lx: 27, ly: 145 },
  { id: 12, x: 51, y:133, w: 44, h: 18, lx: 73, ly: 145 },
];

// Linhas divisoras (serão clipadas ao contorno)
const DIVIDERS = [
  // horizontais
  { x1: 5,  y1:  33, x2: 95, y2:  33 },
  { x1: 5,  y1:  62, x2: 95, y2:  62 },
  { x1: 5,  y1:  97, x2: 95, y2:  97 },
  { x1: 5,  y1: 115, x2: 95, y2: 115 },
  { x1: 5,  y1: 133, x2: 95, y2: 133 },
  // verticais linha 2
  { x1: 50, y1:  33, x2: 50, y2:  62 },
  // verticais linha 3
  { x1: 21, y1:  62, x2: 21, y2:  97 },
  { x1: 79, y1:  62, x2: 79, y2:  97 },
  // verticais linha 4
  { x1: 50, y1:  97, x2: 50, y2: 115 },
  // verticais linha 5
  { x1: 34, y1: 115, x2: 34, y2: 133 },
  { x1: 66, y1: 115, x2: 66, y2: 133 },
  // verticais linha 6
  { x1: 50, y1: 133, x2: 50, y2: 153 },
];

const HOOF_PATH =
  "M 50,4 C 80,4 94,20 94,50 L 94,100 Q 94,138 70,143 Q 50,148 30,143 Q 6,138 6,100 L 6,50 C 6,20 20,4 50,4 Z";

const DEFAULT = { fill: "#e5e7eb", stroke: "#9ca3af", text: "#6b7280" };

export function HoofZoneMap({ selectedZones, onToggleZone, foot, severity = 0 }: Props) {
  const isRight = foot === "FD" || foot === "TD";
  const activeColor = ZONE_SEVERITY_COLOR[severity];

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Orientação */}
      <div className="flex w-full max-w-[260px] justify-between text-[10px] font-bold uppercase text-muted-foreground px-1">
        <span>{isRight ? "Int." : "Ext."}</span>
        <span>↑ Ponta do casco</span>
        <span>{isRight ? "Ext." : "Int."}</span>
      </div>

      {/* SVG principal */}
      <svg
        viewBox="0 0 100 152"
        className={cn("w-full max-w-[260px] drop-shadow-md", isRight && "-scale-x-100")}
        style={{ touchAction: "none" }}
      >
        <defs>
          <clipPath id="hoof-clip">
            <path d={HOOF_PATH} />
          </clipPath>
        </defs>

        {/* Fundo do casco */}
        <path d={HOOF_PATH} fill="#f9fafb" stroke="#9ca3af" strokeWidth="1.5" />

        {/* Zonas clipadas ao contorno */}
        <g clipPath="url(#hoof-clip)">
          {ZONE_RECTS.map((z) => {
            const isSelected = selectedZones.includes(z.id);
            const col = isSelected ? activeColor : DEFAULT;
            return (
              <rect
                key={z.id}
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                fill={col.fill}
                opacity={isSelected ? 1 : 0.7}
              />
            );
          })}
        </g>

        {/* Linhas divisórias (sempre sobre as zonas, clipadas) */}
        <g clipPath="url(#hoof-clip)" stroke="#9ca3af" strokeWidth="0.6">
          {DIVIDERS.map((d, i) => (
            <line key={i} x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} />
          ))}
        </g>

        {/* Contorno do casco por cima */}
        <path d={HOOF_PATH} fill="none" stroke="#6b7280" strokeWidth="1.5" />

        {/* Labels das zonas + área de toque */}
        {ZONE_RECTS.map((z) => {
          const isSelected = selectedZones.includes(z.id);
          const col = isSelected ? activeColor : DEFAULT;
          return (
            <g
              key={z.id}
              onClick={() => onToggleZone(z.id)}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Zona ${z.id}`}
            >
              {/* Área de toque invisível */}
              <rect x={z.x} y={z.y} width={z.w} height={z.h} fill="transparent" />
              {/* Label */}
              <text
                x={z.lx}
                y={z.ly + 1}
                textAnchor="middle"
                fontSize={z.fs ?? 7.5}
                fontWeight="800"
                fill={col.text}
                style={{ userSelect: "none", pointerEvents: "none" }}
              >
                {z.id}
              </text>
            </g>
          );
        })}
      </svg>

      <p className="text-[10px] font-bold uppercase text-muted-foreground">
        Talão ↓
      </p>

      {/* Resumo das zonas selecionadas */}
      {selectedZones.length > 0 && (
        <div
          className="w-full rounded-xl px-3 py-2 text-center text-xs font-semibold transition-all"
          style={{ backgroundColor: activeColor.fill + "cc", color: activeColor.text }}
        >
          {selectedZones.length === 1
            ? `Zona ${selectedZones[0]} — ${ZONE_LABEL[selectedZones[0]]}`
            : `${selectedZones.length} zonas: ${[...selectedZones].sort((a, b) => a - b).join(", ")}`}
        </div>
      )}
    </div>
  );
}
