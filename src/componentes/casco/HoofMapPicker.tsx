import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react";
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

interface VisualArea {
  key: string;
  code: string;
  name: string;
  zoneIds: Zone[];
  general?: boolean;
  custom?: boolean;
}

interface AreaShape {
  d: string;
  mirror?: boolean;
}

const LEFT_SHAPES: Record<string, AreaShape[]> = {
  "1": [
    {
      d: "M61 127 C73 66 111 29 157 29 C181 29 194 47 190 75 L180 142 C148 128 119 132 91 151 Z",
    },
    {
      d: "M61 127 C73 66 111 29 157 29 C181 29 194 47 190 75 L180 142 C148 128 119 132 91 151 Z",
      mirror: true,
    },
  ],
  "2": [
    { d: "M91 151 C119 132 148 128 180 142 L169 229 C135 216 101 222 74 249 Z" },
    {
      d: "M91 151 C119 132 148 128 180 142 L169 229 C135 216 101 222 74 249 Z",
      mirror: true,
    },
  ],
  "3": [
    { d: "M74 249 C101 222 135 216 169 229 L174 304 C136 285 95 295 58 330 Z" },
    {
      d: "M74 249 C101 222 135 216 169 229 L174 304 C136 285 95 295 58 330 Z",
      mirror: true,
    },
  ],
  "4": [
    { d: "M58 330 C95 295 136 285 174 304 L184 450 C148 477 98 473 55 438 Z" },
    {
      d: "M58 330 C95 295 136 285 174 304 L184 450 C148 477 98 473 55 438 Z",
      mirror: true,
    },
  ],
  "5": [
    {
      d: "M61 127 C43 187 34 261 37 337 C38 378 44 413 55 438 L77 395 C65 331 68 251 91 151 Z",
    },
    {
      d: "M61 127 C43 187 34 261 37 337 C38 378 44 413 55 438 L77 395 C65 331 68 251 91 151 Z",
      mirror: true,
    },
  ],
  "6": [
    {
      d: "M55 438 C98 473 148 477 184 450 L189 516 C153 547 93 540 63 501 C51 485 46 463 55 438 Z",
    },
    {
      d: "M55 438 C98 473 148 477 184 450 L189 516 C153 547 93 540 63 501 C51 485 46 463 55 438 Z",
      mirror: true,
    },
    {
      d: "M190 75 C199 59 221 59 230 75 C245 151 245 317 238 455 C235 510 226 541 210 552 C194 541 185 510 182 455 C175 317 175 151 190 75 Z",
    },
  ],
};

const AREA_COLORS: Record<string, { base: string; selected: string }> = {
  "1": { base: "#79a873", selected: "#1f5b30" },
  "2": { base: "#e5cf6a", selected: "#8a6a12" },
  "3": { base: "#ede9df", selected: "#5c6b62" },
  "4": { base: "#c98276", selected: "#873f36" },
  "5": { base: "#d9ad62", selected: "#8c5e19" },
  "6": { base: "#9099c6", selected: "#475283" },
};

const AREA_LABELS: Record<string, Array<[number, number]>> = {
  "1": [
    [132, 88],
    [288, 88],
  ],
  "2": [
    [132, 183],
    [288, 183],
  ],
  "3": [
    [124, 265],
    [296, 265],
  ],
  "4": [
    [126, 371],
    [294, 371],
  ],
  "5": [
    [55, 292],
    [365, 292],
  ],
  "6": [
    [121, 489],
    [210, 485],
    [299, 489],
  ],
};

function buildVisualAreas(areas: HoofAreaDefinition[]): VisualArea[] {
  const activeAreas = areas.filter((area) => area.active);
  const usedIds = new Set<number>();
  const visualAreas = ["1", "2", "3", "4", "5", "6"].flatMap((code) => {
    const matches = activeAreas.filter((area) => {
      if (code === "6") return area.id === 6 || area.id === 11 || area.code.startsWith("6");
      return area.id === Number(code) || area.code === code;
    });
    matches.forEach((area) => usedIds.add(area.id));
    if (matches.length === 0) return [];
    return [
      {
        key: `area-${code}`,
        code,
        name:
          code === "6"
            ? "Talão e região interdigital"
            : matches.map((area) => area.name).join(" / "),
        zoneIds: matches.map((area) => area.id),
      },
    ];
  });
  const customAreas = activeAreas
    .filter((area) => !usedIds.has(area.id))
    .map((area) => ({
      key: `custom-${area.id}`,
      code: area.code,
      name: area.name,
      zoneIds: [area.id],
      custom: true,
    }));
  return [
    ...visualAreas,
    ...customAreas,
    {
      key: "general",
      code: "Geral",
      name: "Doenças sem região específica",
      zoneIds: [],
      general: true,
    },
  ];
}

export function HoofMapPicker({
  areas,
  catalog,
  selectedZones,
  diseases,
  onZonesChange,
  onDiseasesChange,
}: Props) {
  const visualAreas = useMemo(() => buildVisualAreas(areas), [areas]);
  const [activeAreaKey, setActiveAreaKey] = useState<string | null>(null);
  const activeArea = visualAreas.find((area) => area.key === activeAreaKey);
  const selectedSet = new Set(selectedZones);
  const catalogByCode = new Map(catalog.map((disease) => [disease.code, disease]));

  function catalogForArea(area: VisualArea) {
    if (area.general) return catalog.filter((disease) => (disease.zones ?? []).length === 0);
    const areaZones = new Set(area.zoneIds);
    return catalog.filter((disease) => disease.zones?.some((zone) => areaZones.has(zone)));
  }

  function diseasesForArea(area: VisualArea) {
    const areaCatalog = new Set(catalogForArea(area).map((disease) => disease.code));
    if (area.general) {
      return diseases.filter(
        (disease) => areaCatalog.has(disease.code) && (disease.zones ?? []).length === 0,
      );
    }
    const areaZones = new Set(area.zoneIds);
    return diseases.filter(
      (disease) =>
        areaCatalog.has(disease.code) && disease.zones?.some((zone) => areaZones.has(zone)),
    );
  }

  function updateAreaDiseases(area: VisualArea, nextAreaDiseases: DiseaseEntry[]) {
    const areaCatalogCodes = new Set(catalogForArea(area).map((disease) => disease.code));
    const areaZones = new Set(area.zoneIds);
    const merged = new Map<string, DiseaseEntry>();

    for (const disease of diseases) {
      if (!areaCatalogCodes.has(disease.code)) {
        merged.set(disease.code, disease);
        continue;
      }
      if (area.general) {
        if ((disease.zones ?? []).length > 0) merged.set(disease.code, disease);
        continue;
      }
      const remainingZones = (disease.zones ?? []).filter((zone) => !areaZones.has(zone));
      if (remainingZones.length > 0)
        merged.set(disease.code, { ...disease, zones: remainingZones });
    }

    for (const disease of nextAreaDiseases) {
      const previous = merged.get(disease.code);
      merged.set(disease.code, {
        ...previous,
        ...disease,
        zones: Array.from(new Set([...(previous?.zones ?? []), ...(disease.zones ?? [])])),
      });
    }

    const nextDiseases = Array.from(merged.values());
    onDiseasesChange(nextDiseases);
    onZonesChange(Array.from(new Set(nextDiseases.flatMap((disease) => disease.zones ?? []))));
  }

  function areaHasDiagnosis(area: VisualArea) {
    if (area.general) {
      return diseases.some((disease) => {
        const definition = catalogByCode.get(disease.code);
        return disease.severity > 0 && (definition?.zones ?? []).length === 0;
      });
    }
    return area.zoneIds.some((zone) => selectedSet.has(zone));
  }

  if (activeArea) {
    const areaCatalog = catalogForArea(activeArea);
    const areaDiseases = diseasesForArea(activeArea);
    const selectedCount = areaDiseases.filter((disease) => disease.severity > 0).length;
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setActiveAreaKey(null)}
          className="flex min-h-12 w-full items-center gap-3 rounded-lg border-2 border-border bg-card px-4 text-left font-display text-sm font-black uppercase text-primary"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" /> Escolher outra área
        </button>

        <section className="overflow-hidden rounded-xl border-2 border-primary/30 bg-card">
          <div className="flex items-center gap-4 bg-primary px-4 py-4 text-primary-foreground">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-white/70 bg-white/15 font-display text-2xl font-black">
              {activeArea.general ? "G" : activeArea.code}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase text-white/85">Diagnóstico do casco</p>
              <h3 className="font-display text-xl font-black uppercase leading-tight">
                {activeArea.general ? "Doenças gerais" : `Doenças da área ${activeArea.code}`}
              </h3>
              <p className="mt-1 text-sm font-semibold text-white">{activeArea.name}</p>
            </div>
          </div>
          <div className="flex min-h-12 items-center gap-2 px-4 py-2 text-sm font-semibold">
            {selectedCount > 0 ? (
              <>
                <CheckCircle2 className="h-5 w-5 shrink-0 text-good" />
                {selectedCount} lesão(ões) marcada(s) nesta área
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                Marque a doença encontrada e informe o grau
              </>
            )}
          </div>
        </section>

        <DiseasePicker
          catalog={areaCatalog}
          diseases={areaDiseases}
          activeZones={activeArea.zoneIds}
          onChange={(nextDiseases) => updateAreaDiseases(activeArea, nextDiseases)}
        />

        <button
          type="button"
          onClick={() => setActiveAreaKey(null)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-4 font-display text-base font-black uppercase text-primary"
        >
          <ArrowLeft className="h-5 w-5" /> Voltar ao casco
        </button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border-2 border-border bg-card">
      <div className="border-b border-border bg-surface px-4 py-4">
        <p className="font-display text-lg font-black uppercase">Escolha a área do casco</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Toque diretamente no desenho ou use os botões abaixo.
        </p>
      </div>

      <div className="bg-[#f8f6ef] px-3 py-4">
        <svg
          viewBox="0 0 420 570"
          className="mx-auto block aspect-[420/570] w-full max-w-[25rem] touch-manipulation"
          role="img"
          aria-label="Mapa das áreas do casco"
        >
          <defs>
            <filter id="hoof-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow
                dx="0"
                dy="7"
                stdDeviation="7"
                floodColor="#213127"
                floodOpacity="0.18"
              />
            </filter>
          </defs>
          <g filter="url(#hoof-shadow)">
            <path
              d="M61 127 C73 66 111 29 157 29 C181 29 194 47 190 75 C174 158 175 317 189 516 C153 547 93 540 63 501 C22 447 25 226 61 127 Z"
              fill="#f1ead8"
              stroke="#34473a"
              strokeWidth="7"
            />
            <path
              d="M61 127 C73 66 111 29 157 29 C181 29 194 47 190 75 C174 158 175 317 189 516 C153 547 93 540 63 501 C22 447 25 226 61 127 Z"
              transform="translate(420 0) scale(-1 1)"
              fill="#f1ead8"
              stroke="#34473a"
              strokeWidth="7"
            />
          </g>

          {visualAreas
            .filter((area) => !area.general && !area.custom && LEFT_SHAPES[area.code])
            .map((area) => {
              const selected = areaHasDiagnosis(area);
              const colors = AREA_COLORS[area.code];
              return (
                <g
                  key={area.key}
                  role="button"
                  tabIndex={0}
                  aria-label={`Selecionar área ${area.code}: ${area.name}`}
                  onClick={() => setActiveAreaKey(area.key)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setActiveAreaKey(area.key);
                  }}
                  className="cursor-pointer outline-none"
                >
                  {LEFT_SHAPES[area.code].map((shape, index) => (
                    <path
                      key={`${area.key}-${index}`}
                      d={shape.d}
                      transform={shape.mirror ? "translate(420 0) scale(-1 1)" : undefined}
                      fill={selected ? colors.selected : colors.base}
                      stroke={selected ? "#123f20" : "#3f5045"}
                      strokeWidth={selected ? 5 : 3}
                      className="transition-[fill,stroke]"
                    />
                  ))}
                  {AREA_LABELS[area.code].map(([x, y], index) => (
                    <g key={`${area.key}-label-${index}`} pointerEvents="none">
                      <circle
                        cx={x}
                        cy={y}
                        r="19"
                        fill={selected ? "#ffffff" : "#fffdf8"}
                        stroke={selected ? colors.selected : "#536258"}
                        strokeWidth="2"
                      />
                      <text
                        x={x}
                        y={y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={selected ? colors.selected : "#26372d"}
                        fontSize="19"
                        fontWeight="900"
                      >
                        {area.code}
                      </text>
                    </g>
                  ))}
                </g>
              );
            })}
        </svg>
      </div>

      <div className="border-t border-border px-3 py-4">
        <p className="mb-3 text-xs font-black uppercase text-muted-foreground">
          Selecione uma área para ver as doenças
        </p>
        <div className="grid grid-cols-4 gap-2">
          {visualAreas.map((area) => {
            const selected = areaHasDiagnosis(area);
            return (
              <button
                key={area.key}
                type="button"
                onClick={() => setActiveAreaKey(area.key)}
                aria-pressed={selected}
                aria-label={
                  area.general
                    ? "Selecionar doenças gerais"
                    : `Selecionar área ${area.code}: ${area.name}`
                }
                className={cn(
                  "min-h-12 rounded-lg border-2 px-2 font-display text-xs font-black uppercase",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : area.general
                      ? "border-primary/40 bg-primary/5 text-primary"
                      : "border-border bg-surface text-foreground",
                )}
              >
                {area.general ? "Geral" : `Área ${area.code}`}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex min-h-12 items-center gap-2 rounded-lg bg-surface px-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold">
            {diseases.length > 0
              ? `${diseases.length} lesão(ões) registrada(s) neste casco`
              : "Nenhuma lesão registrada neste casco"}
          </p>
        </div>
      </div>
    </section>
  );
}
