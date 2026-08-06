import { useMemo, useState } from "react";
import { AlertTriangle, Scissors } from "lucide-react";
import { preventiveList } from "@/dominio/casco-store";
import { cn } from "@/dominio/utils";

const DIAS_FILTROS = [
  { label: "Todos", dias: null },
  { label: "7+ dias", dias: 7 },
  { label: "30+ dias", dias: 30 },
  { label: "60+ dias", dias: 60 },
  { label: "90+ dias", dias: 90 },
  { label: "120+ dias", dias: 120 },
] as const;

export function PreventiveScreen({
  diasThreshold,
  onNew,
}: {
  diasThreshold: number;
  onNew: (tag: string) => void;
}) {
  const [filtroMin, setFiltroMin] = useState<number | null>(null);

  const todos = useMemo(() => preventiveList(0), []);

  const filtered = useMemo(() => {
    if (filtroMin === null) return todos;
    return todos.filter((animal) => {
      return animal.diasSemCasqueamento < 0 || animal.diasSemCasqueamento >= filtroMin;
    });
  }, [todos, filtroMin]);

  const nunca = filtered.filter((animal) => animal.diasSemCasqueamento < 0).length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 stamp">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            ✂️
          </div>
          <div>
            <p className="font-display text-lg font-black uppercase">Casqueamento Preventivo</p>
            <p className="text-sm text-muted-foreground">
              {todos.length} animal(is) sem problema ativo
            </p>
          </div>
        </div>
        {nunca > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warn-foreground" />
            <p className="text-sm font-bold text-warn-foreground">
              {nunca} animal(is) nunca receberam casqueamento preventivo
            </p>
          </div>
        )}
        <p className="mt-3 rounded-xl bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          Abra o atendimento e avalie os quatro cascos. A visita só será preventiva quando nenhum
          problema for registrado.
        </p>
      </div>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Mostrar animais sem casquear há:
        </p>
        <div className="flex flex-wrap gap-2">
          {DIAS_FILTROS.map(({ label, dias }) => (
            <button
              key={label}
              type="button"
              onClick={() => setFiltroMin(dias)}
              className={cn(
                "tap rounded-xl border-2 px-4 py-2 font-display text-sm uppercase",
                filtroMin === dias
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} animal(is) · ordenado do mais urgente
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum animal neste filtro</p>
          <button
            type="button"
            onClick={() => setFiltroMin(null)}
            className="mt-3 rounded-full bg-muted px-4 py-2 font-display text-sm uppercase text-muted-foreground"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((animal) => {
            const nuncaFoiCasqueado = animal.diasSemCasqueamento < 0;
            const vencido =
              !nuncaFoiCasqueado &&
              diasThreshold > 0 &&
              animal.diasSemCasqueamento >= diasThreshold;
            return (
              <li key={animal.tag}>
                <div
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-2xl border-2 bg-card p-4 sm:flex-row sm:items-center",
                    nuncaFoiCasqueado
                      ? "border-danger/50 bg-danger/5"
                      : vencido
                        ? "border-warn/50 bg-warn/5"
                        : "border-border",
                  )}
                >
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-4xl font-black leading-none">{animal.tag}</p>
                    <p className="mt-0.5 text-xl leading-none">
                      {animal.sex === "vaca" ? "🐄" : "🐂"}
                    </p>
                    {animal.lote && (
                      <span className="mt-0.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-primary">
                        {animal.lote}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    {nuncaFoiCasqueado ? (
                      <p className="font-display text-lg font-black uppercase text-danger">
                        ⚠️ Nunca casqueado
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "font-display text-lg font-black uppercase",
                          vencido ? "text-warn-foreground" : "text-foreground",
                        )}
                      >
                        {animal.diasSemCasqueamento} dias sem casquear
                      </p>
                    )}
                    {animal.lastPreventivoDate && (
                      <p className="text-sm text-muted-foreground">
                        Último preventivo:{" "}
                        {new Date(animal.lastPreventivoDate + "T12:00:00").toLocaleDateString(
                          "pt-BR",
                          { day: "2-digit", month: "2-digit", year: "2-digit" },
                        )}
                      </p>
                    )}
                    {animal.hasProblemaHistorico && (
                      <span className="mt-1 inline-block rounded bg-warn/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warn-foreground">
                        ⚠️ Teve problema antes
                      </span>
                    )}
                  </div>

                  <div className="shrink-0 sm:w-48">
                    <button
                      type="button"
                      onClick={() => onNew(animal.tag)}
                      aria-label={`Iniciar avaliação preventiva do brinco ${animal.tag}`}
                      className="tap min-h-16 w-full rounded-xl border-2 border-primary bg-primary px-3 py-2 font-display text-xs font-black uppercase leading-tight text-primary-foreground transition-transform active:scale-[0.98]"
                    >
                      <span className="flex min-w-0 items-center justify-center gap-2">
                        <Scissors className="h-5 w-5" aria-hidden="true" />
                        Iniciar avaliação
                      </span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
