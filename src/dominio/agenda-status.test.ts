import { describe, expect, it } from "vitest";
import type { AgendaItem } from "./casco-store";
import {
  agendaItemStatus,
  agendaStatusCounts,
  agendaStatusText,
  filterAgendaItems,
} from "./agenda-status";

function item(date: string, tag: string, type: AgendaItem["type"] = "recheck"): AgendaItem {
  return {
    id: `${tag}-${date}`,
    date,
    type,
    tag,
    sex: "vaca",
    feet: [],
    title: "Revisão clínica",
    detail: "Retorno",
    overdue: date < "2026-09-02",
  };
}

describe("relatório de situação da agenda", () => {
  const today = "2026-09-02";
  const items = [
    item("2026-08-30", "100"),
    item("2026-09-02", "200"),
    item("2026-09-06", "300", "preventive"),
    item("2026-10-10", "400", "curative"),
  ];

  it("separa atrasadas, hoje, próximos sete dias e futuras", () => {
    expect(items.map((entry) => agendaItemStatus(entry, today))).toEqual([
      "overdue",
      "today",
      "next7",
      "later",
    ]);
    expect(agendaStatusCounts(items, today)).toEqual({ overdue: 1, today: 1, next7: 1, later: 1 });
  });

  it("filtra por situação, tipo e busca", () => {
    expect(filterAgendaItems(items, { referenceDate: today, status: "ontime" })).toHaveLength(3);
    expect(
      filterAgendaItems(items, { referenceDate: today, status: "all", type: "preventive" }).map(
        (entry) => entry.tag,
      ),
    ).toEqual(["300"]);
    expect(
      filterAgendaItems(items, { referenceDate: today, status: "all", search: "400" }),
    ).toHaveLength(1);
  });

  it("explica o prazo em linguagem simples", () => {
    expect(agendaStatusText(items[0], today)).toBe("3 dia(s) em atraso");
    expect(agendaStatusText(items[1], today)).toBe("Atender hoje");
    expect(agendaStatusText(item("2026-09-03", "500"), today)).toBe("Amanhã");
  });
});
