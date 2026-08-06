import { useState } from "react";
import { BarChart3, Beef, Footprints, Stethoscope } from "lucide-react";
import { cn } from "@/dominio/utils";
import type { MonthlyComparison, OperationalBreakdown } from "@/dominio/visit-report";

type BreakdownTab = "diseases" | "feet" | "animals";

function comparisonText(current: number, previous: number) {
  const difference = current - previous;
  if (difference === 0) return "Sem mudança";
  return difference > 0 ? `+${difference}` : String(difference);
}

export function MonthlyComparisonPanel({ comparison }: { comparison: MonthlyComparison }) {
  const rows = [
    {
      label: "Atendimentos",
      current: comparison.current.visits,
      previous: comparison.previous.visits,
    },
    {
      label: "Animais únicos",
      current: comparison.current.animals,
      previous: comparison.previous.animals,
    },
    {
      label: "Preventivos",
      current: comparison.current.preventive,
      previous: comparison.previous.preventive,
    },
    {
      label: "Com problema",
      current: comparison.current.withProblem,
      previous: comparison.previous.withProblem,
    },
    {
      label: "Diagnósticos",
      current: comparison.current.diagnoses,
      previous: comparison.previous.diagnoses,
    },
  ];

  return (
    <section className="border-t border-border pt-5" aria-labelledby="monthly-comparison-title">
      <div className="flex items-start gap-3">
        <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 id="monthly-comparison-title" className="font-display text-base font-black uppercase">
            Comparativo mensal
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Compara visitas finalizadas. “Animais” conta brincos diferentes e “diagnósticos” conta
            cada doença registrada em cada casco.
          </p>
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-border bg-card">
        <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] bg-surface px-3 py-2 text-[10px] font-black uppercase text-muted-foreground">
          <span>Métrica</span>
          <span className="text-center capitalize">{comparison.previous.label}</span>
          <span className="text-center capitalize">{comparison.current.label}</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid min-h-14 grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center border-t border-border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{row.label}</p>
              <p
                className={cn(
                  "text-[10px] font-black uppercase",
                  row.current > row.previous
                    ? "text-primary"
                    : row.current < row.previous
                      ? "text-warn-foreground"
                      : "text-muted-foreground",
                )}
              >
                {comparisonText(row.current, row.previous)} no mês
              </p>
            </div>
            <span className="text-center font-display text-lg font-black text-muted-foreground">
              {row.previous}
            </span>
            <span className="text-center font-display text-xl font-black text-primary">
              {row.current}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OperationalBreakdownPanel({
  breakdown,
  periodLabel = "período escolhido",
}: {
  breakdown: OperationalBreakdown;
  periodLabel?: string;
}) {
  const [tab, setTab] = useState<BreakdownTab>("diseases");
  const tabs = [
    { id: "diseases" as const, label: "Doenças", icon: Stethoscope },
    { id: "feet" as const, label: "Pés", icon: Footprints },
    { id: "animals" as const, label: "Animais", icon: Beef },
  ];
  const maxDisease = Math.max(1, ...breakdown.diseases.map((row) => row.records));
  const maxFoot = Math.max(1, ...breakdown.feet.map((row) => row.records));

  return (
    <section className="border-t border-border pt-5" aria-labelledby="operational-breakdown-title">
      <div>
        <h3
          id="operational-breakdown-title"
          className="font-display text-base font-black uppercase"
        >
          Detalhes do trabalho
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Dados do {periodLabel}. Selecione abaixo como deseja analisar.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-lg bg-surface p-1" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-12 items-center justify-center gap-1.5 rounded-md px-2 font-display text-xs font-black uppercase",
              tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab === "diseases" && (
        <div className="mt-3" role="tabpanel">
          <p className="mb-2 text-xs text-muted-foreground">
            {breakdown.diagnoses} diagnóstico(s) registrado(s). Uma visita pode ter mais de uma
            doença.
          </p>
          {breakdown.diseases.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhuma doença registrada neste período.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {breakdown.diseases.map((row) => (
                <div key={row.code} className="border-b border-border p-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 text-sm font-bold">{row.label}</p>
                    <p className="shrink-0 font-display text-lg font-black text-primary">
                      {row.records}
                    </p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(6, (row.records / maxDisease) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {row.records} registro(s) em {row.animals} animal(is)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "feet" && (
        <div className="mt-3" role="tabpanel">
          <p className="mb-2 text-xs text-muted-foreground">
            {breakdown.problemFeet} casco(s) com doença ou ação de taco no período.
          </p>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            {breakdown.feet.map((row) => (
              <div key={row.foot} className="border-b border-border p-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold">
                    {row.foot} · {row.label}
                  </p>
                  <p className="font-display text-lg font-black text-primary">{row.records}</p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${row.records === 0 ? 0 : Math.max(6, (row.records / maxFoot) * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {row.records} registro(s) em {row.animals} animal(is)
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "animals" && (
        <div className="mt-3" role="tabpanel">
          <p className="mb-2 text-xs text-muted-foreground">
            Ordenado pelos animais com mais visitas no período.
          </p>
          {breakdown.animals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Nenhum animal atendido neste período.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {breakdown.animals.slice(0, 10).map((row) => (
                <div
                  key={row.tag}
                  className="grid min-h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-display text-base font-black uppercase">Brinco {row.tag}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.problemVisits} visita(s) com problema · última em{" "}
                      {new Date(`${row.latestDate}T12:00:00`).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl font-black text-primary">{row.visits}</p>
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Visitas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
