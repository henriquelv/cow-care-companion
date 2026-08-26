import { useState } from "react";
import { ChevronDown, MapPin, RotateCcw } from "lucide-react";
import {
  type DiseaseDefinition,
  type DiseaseEntry,
  type HoofAreaDefinition,
  type Zone,
} from "@/dominio/casco-store";
import { cn } from "@/dominio/utils";
import { DiseasePicker } from "./DiseasePicker";

interface Props {
  areas: HoofAreaDefinition[];
  catalog: DiseaseDefinition[];
  selectedZones: Zone[];
  diseases: DiseaseEntry[];
  onZonesChange: (zones: Zone[]) => void;
  onDiseasesChange: (diseases: DiseaseEntry[]) => void;
}

const AREA_SHAPES: Record<number, { d: string; labelX: number; labelY: number }> = {
  1: { d: "M92 34 Q150 6 208 34 L202 94 L98 94 Z", labelX: 150, labelY: 63 },
  2: { d: "M98 100 L146 100 L146 205 L82 194 Q80 142 98 100 Z", labelX: 113, labelY: 153 },
  3: { d: "M152 100 L202 100 Q220 142 218 194 L152 205 Z", labelX: 184, labelY: 153 },
  4: { d: "M84 201 L146 211 L146 300 L92 292 Q82 250 84 201 Z", labelX: 115, labelY: 250 },
  5: { d: "M152 211 L216 201 Q218 250 208 292 L152 300 Z", labelX: 184, labelY: 250 },
  6: {
    d: "M94 299 L140 307 L132 370 Q102 358 92 326 Z M160 307 L206 299 L208 326 Q198 358 168 370 Z",
    labelX: 100,
    labelY: 330,
  },
  11: { d: "M140 307 L160 307 L168 370 Q150 382 132 370 Z", labelX: 150, labelY: 345 },
};

export function HoofMapPicker({
  areas,
  catalog,
  selectedZones,
  diseases,
  onZonesChange,
  onDiseasesChange,
}: Props) {
  const [showOtherDiseases, setShowOtherDiseases] = useState(false);
  const availableAreas = areas.filter((area) => area.active);
  const activeAreas = availableAreas.filter((area) => AREA_SHAPES[area.id]);
  const additionalAreas = availableAreas.filter((area) => !AREA_SHAPES[area.id]);
  const selectedSet = new Set(selectedZones);
  const selectedAreaNames = availableAreas
    .filter((area) => selectedSet.has(area.id))
    .map((area) => area.name);
  const selectedCodes = new Set(
    catalog
      .filter((disease) => disease.zones?.some((zone) => selectedSet.has(zone)))
      .map((disease) => disease.code),
  );
  for (const disease of diseases) selectedCodes.add(disease.code);
  const suggested = catalog.filter((disease) => selectedCodes.has(disease.code));
  const otherDiseases = catalog.filter(
    (disease) => !suggested.some((suggestion) => suggestion.code === disease.code),
  );

  function toggleArea(areaId: Zone) {
    onZonesChange(
      selectedSet.has(areaId)
        ? selectedZones.filter((zone) => zone !== areaId)
        : [...selectedZones, areaId],
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border-2 border-border bg-card p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-base font-black uppercase">Onde está o problema?</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Toque em uma ou mais áreas. A lista de doenças muda conforme a região.
            </p>
          </div>
          {selectedZones.length > 0 ? (
            <button
              type="button"
              onClick={() => onZonesChange([])}
              className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-black uppercase text-primary"
            >
              <RotateCcw className="h-4 w-4" /> Limpar
            </button>
          ) : null}
        </div>

        <svg
          viewBox="45 5 210 390"
          className="mx-auto mt-3 block aspect-[210/390] w-full max-w-[22rem] touch-manipulation"
          role="img"
          aria-label="Mapa das áreas do casco"
        >
          <path
            d="M92 24 Q150 -2 208 24 Q238 78 228 220 Q224 332 184 380 Q150 406 116 380 Q76 332 72 220 Q62 78 92 24 Z"
            fill="#f7f8f5"
            stroke="#33473a"
            strokeWidth="7"
          />
          {activeAreas.map((area) => {
            const shape = AREA_SHAPES[area.id];
            const selected = selectedSet.has(area.id);
            return (
              <g
                key={area.id}
                role="button"
                tabIndex={0}
                aria-label={`Área ${area.code}: ${area.name}${selected ? ", selecionada" : ""}`}
                onClick={() => toggleArea(area.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") toggleArea(area.id);
                }}
                className="cursor-pointer outline-none"
              >
                <path
                  d={shape.d}
                  fill={selected ? "#1f5b30" : "#dfe8df"}
                  stroke={selected ? "#123f20" : "#8aa08e"}
                  strokeWidth={selected ? 5 : 3}
                  className="transition-[fill,stroke]"
                />
                <text
                  x={shape.labelX}
                  y={shape.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={selected ? "#ffffff" : "#24372b"}
                  fontSize="18"
                  fontWeight="800"
                  pointerEvents="none"
                >
                  {area.code}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="mt-3">
          <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">
            Toque na região encontrada
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {activeAreas.map((area) => {
              const selected = selectedSet.has(area.id);
              return (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => toggleArea(area.id)}
                  aria-pressed={selected}
                  aria-label={`Selecionar área ${area.code}: ${area.name}`}
                  className={cn(
                    "min-h-12 rounded-lg border-2 px-3 text-left",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-foreground",
                  )}
                >
                  <span className="block font-display text-sm font-black uppercase">
                    Área {area.code}
                  </span>
                  <span className="block text-[10px] font-semibold opacity-80">{area.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {additionalAreas.length > 0 ? (
          <div className="mt-3">
            <p className="mb-2 text-[10px] font-black uppercase text-muted-foreground">
              Áreas adicionais
            </p>
            <div className="flex flex-wrap gap-2">
              {additionalAreas.map((area) => {
                const selected = selectedSet.has(area.id);
                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    aria-pressed={selected}
                    className={cn(
                      "min-h-11 rounded-lg border-2 px-3 text-xs font-black uppercase",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-foreground",
                    )}
                  >
                    {area.code} · {area.name}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex min-h-12 items-center gap-2 rounded-lg bg-surface px-3">
          <MapPin className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">
            {selectedAreaNames.length > 0
              ? selectedAreaNames.join(" + ")
              : "Nenhuma área selecionada"}
          </p>
        </div>
      </section>

      {selectedZones.length > 0 ? (
        <section className="space-y-3">
          <div>
            <p className="font-display text-base font-black uppercase">Doenças sugeridas</p>
            <p className="text-xs text-muted-foreground">
              Selecione a doença e o grau. Você pode marcar mais de uma.
            </p>
          </div>
          <DiseasePicker
            catalog={suggested}
            diseases={diseases}
            activeZones={selectedZones}
            onChange={onDiseasesChange}
          />
          <button
            type="button"
            onClick={() => setShowOtherDiseases((current) => !current)}
            aria-expanded={showOtherDiseases}
            className="flex min-h-12 w-full items-center justify-between rounded-lg border-2 border-border bg-card px-4 text-left font-display text-sm font-black uppercase"
          >
            Demais doenças
            <ChevronDown
              className={cn("h-5 w-5 transition-transform", showOtherDiseases && "rotate-180")}
            />
          </button>
          {showOtherDiseases ? (
            <DiseasePicker
              catalog={otherDiseases}
              diseases={diseases}
              activeZones={selectedZones}
              onChange={onDiseasesChange}
            />
          ) : null}
        </section>
      ) : (
        <p className="rounded-lg border-2 border-dashed border-border bg-surface p-4 text-center text-sm text-muted-foreground">
          Primeiro toque na área do casco onde encontrou o problema.
        </p>
      )}
    </div>
  );
}
