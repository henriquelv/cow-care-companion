import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarCheck2,
  CalendarPlus,
  ChevronRight,
  Clock3,
  History,
  Search,
} from "lucide-react";
import type { AgendaItem } from "@/dominio/casco-store";
import {
  agendaItemStatus,
  agendaStatusCounts,
  agendaStatusText,
  filterAgendaItems,
  type AgendaStatusFilter,
  type AgendaTypeFilter,
} from "@/dominio/agenda-status";
import { cn } from "@/dominio/utils";

interface Props {
  items: AgendaItem[];
  today: string;
  farmName: string;
  onBack: () => void;
  onOpenHistory: (tag: string) => void;
  onStartVisit: (tag: string) => void;
  onAddToCalendar: (item: AgendaItem) => void;
}

const STATUS_FILTERS: Array<{ id: AgendaStatusFilter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "overdue", label: "Atrasadas" },
  { id: "today", label: "Hoje" },
  { id: "next7", label: "Próx. 7 dias" },
  { id: "later", label: "Futuras" },
  { id: "ontime", label: "Em dia" },
];

const TYPE_LABEL: Record<AgendaItem["type"], string> = {
  recheck: "Revisão",
  curative: "Curativo",
  preventive: "Preventivo",
};

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AgendaStatusReport({
  items,
  today,
  farmName,
  onBack,
  onOpenHistory,
  onStartVisit,
  onAddToCalendar,
}: Props) {
  const [status, setStatus] = useState<AgendaStatusFilter>("all");
  const [type, setType] = useState<AgendaTypeFilter>("all");
  const [search, setSearch] = useState("");
  const counts = useMemo(() => agendaStatusCounts(items, today), [items, today]);
  const visibleItems = useMemo(
    () => filterAgendaItems(items, { referenceDate: today, status, type, search }),
    [items, search, status, today, type],
  );

  return (
    <div className="space-y-4 pb-6">
      <button
        type="button"
        onClick={onBack}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg border-2 border-border bg-card px-4 text-left font-display text-sm font-black uppercase text-primary"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" /> Voltar ao calendário
      </button>

      <section className="border-b border-border pb-4">
        <p className="text-xs font-black uppercase text-primary">Agenda compartilhada</p>
        <h1 className="mt-1 font-display text-2xl font-black uppercase">Relatório de pendências</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {farmName} · revisões, curativos e preventivos da equipe
        </p>
      </section>

      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
        {[
          { label: "Atrasadas", value: counts.overdue, tone: "text-danger" },
          { label: "Hoje", value: counts.today, tone: "text-warn-foreground" },
          { label: "Próx. 7 dias", value: counts.next7, tone: "text-primary" },
          { label: "Futuras", value: counts.later, tone: "text-good" },
        ].map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "px-2 py-4 text-center",
              index % 2 === 0 && "border-r border-border",
              index < 2 && "border-b border-border sm:border-b-0",
              index > 0 && "sm:border-l sm:border-border",
            )}
          >
            <p className={cn("font-display text-3xl font-black", metric.tone)}>{metric.value}</p>
            <p className="text-[10px] font-black uppercase text-muted-foreground">{metric.label}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 border-y border-border py-4">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtrar por situação">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setStatus(option.id)}
              aria-pressed={status === option.id}
              className={cn(
                "min-h-12 rounded-lg border-2 px-2 font-display text-[11px] font-black uppercase",
                status === option.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_14rem]">
          <label className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 focus-within:border-primary">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Buscar por brinco ou lote</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar brinco ou lote"
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por tipo de atendimento</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as AgendaTypeFilter)}
              className="min-h-12 w-full rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
            >
              <option value="all">Todos os tipos</option>
              <option value="recheck">Revisões</option>
              <option value="curative">Curativos</option>
              <option value="preventive">Preventivos</option>
            </select>
          </label>
        </div>
      </section>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-muted-foreground">Resultado</p>
          <p className="font-display text-lg font-black uppercase">
            {visibleItems.length} compromisso(s)
          </p>
        </div>
        <p className="text-right text-xs text-muted-foreground">Ordenados pela data</p>
      </div>

      {visibleItems.length === 0 ? (
        <section className="rounded-xl border-2 border-dashed border-border py-10 text-center">
          <CalendarCheck2 className="mx-auto h-10 w-10 text-good" aria-hidden="true" />
          <p className="mt-3 font-display text-base font-black uppercase">
            Nenhuma vaca neste filtro
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Escolha outra situação ou tipo.</p>
        </section>
      ) : (
        <ul className="space-y-3">
          {visibleItems.map((item) => {
            const itemStatus = agendaItemStatus(item, today);
            return (
              <li
                key={item.id}
                className={cn(
                  "rounded-xl border-2 bg-card p-4",
                  itemStatus === "overdue"
                    ? "border-danger/45"
                    : itemStatus === "today"
                      ? "border-warn/60"
                      : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase text-muted-foreground">
                      {TYPE_LABEL[item.type]}
                    </p>
                    <p className="font-display text-2xl font-black uppercase">Brinco {item.tag}</p>
                    <p className="mt-1 text-sm font-bold capitalize">{formatDate(item.date)}</p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-lg px-2 py-1 text-[10px] font-black uppercase",
                      itemStatus === "overdue"
                        ? "bg-danger/10 text-danger"
                        : itemStatus === "today"
                          ? "bg-warn/20 text-warn-foreground"
                          : "bg-good/10 text-good",
                    )}
                  >
                    {agendaStatusText(item, today)}
                  </span>
                </div>
                <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
                  <p>{item.detail}</p>
                  {item.lote ? <p className="text-muted-foreground">Lote: {item.lote}</p> : null}
                  {item.employee_name ? (
                    <p className="text-muted-foreground">
                      Compromisso gerado por atendimento de {item.employee_name}
                    </p>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={() => onStartVisit(item.tag)}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-3 font-display text-xs font-black uppercase text-primary-foreground"
                  >
                    Iniciar visita <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAddToCalendar(item)}
                    className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-border bg-card text-primary"
                    aria-label={`Adicionar compromisso do brinco ${item.tag} ao calendário do celular`}
                  >
                    <CalendarPlus className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenHistory(item.tag)}
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-surface px-3 text-xs font-black uppercase text-foreground"
                >
                  <History className="h-4 w-4" aria-hidden="true" /> Ver histórico da vaca
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 rounded-lg bg-surface px-3 py-3 text-xs text-muted-foreground">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />A agenda é compartilhada. O
        atendimento concluído será registrado no nome do funcionário que realizou a nova visita.
      </p>
    </div>
  );
}
