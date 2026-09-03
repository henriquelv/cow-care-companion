import type { AgendaItem } from "./casco-store";

export type AgendaStatus = "overdue" | "today" | "next7" | "later";
export type AgendaStatusFilter = "all" | AgendaStatus | "ontime";
export type AgendaTypeFilter = "all" | AgendaItem["type"];

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`).getTime();
}

export function agendaDayDistance(date: string, referenceDate: string) {
  return Math.round((dateAtNoon(date) - dateAtNoon(referenceDate)) / 86400000);
}

export function agendaItemStatus(
  item: Pick<AgendaItem, "date">,
  referenceDate: string,
): AgendaStatus {
  const distance = agendaDayDistance(item.date, referenceDate);
  if (distance < 0) return "overdue";
  if (distance === 0) return "today";
  if (distance <= 7) return "next7";
  return "later";
}

export function agendaStatusText(item: Pick<AgendaItem, "date">, referenceDate: string) {
  const distance = agendaDayDistance(item.date, referenceDate);
  if (distance < 0) return `${Math.abs(distance)} dia(s) em atraso`;
  if (distance === 0) return "Atender hoje";
  if (distance === 1) return "Amanhã";
  return `Em ${distance} dias`;
}

export function filterAgendaItems(
  items: AgendaItem[],
  options: {
    referenceDate: string;
    status?: AgendaStatusFilter;
    type?: AgendaTypeFilter;
    search?: string;
  },
) {
  const normalizedSearch = options.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  return items
    .filter((item) => {
      const status = agendaItemStatus(item, options.referenceDate);
      if (options.status === "ontime" && status === "overdue") return false;
      if (options.status && options.status !== "all" && options.status !== "ontime") {
        if (status !== options.status) return false;
      }
      if (options.type && options.type !== "all" && item.type !== options.type) return false;
      if (!normalizedSearch) return true;
      return [item.tag, item.lote, item.title, item.detail, item.employee_name]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("pt-BR").includes(normalizedSearch));
    })
    .sort(
      (left, right) => left.date.localeCompare(right.date) || left.tag.localeCompare(right.tag),
    );
}

export function agendaStatusCounts(items: AgendaItem[], referenceDate: string) {
  const counts: Record<AgendaStatus, number> = { overdue: 0, today: 0, next7: 0, later: 0 };
  for (const item of items) counts[agendaItemStatus(item, referenceDate)] += 1;
  return counts;
}
