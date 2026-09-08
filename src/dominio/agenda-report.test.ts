import { describe, expect, it } from "vitest";
import { agendaReportData } from "./agenda-report";
import type { AgendaItem } from "./casco-store";

const item = (date: string, tag: string, type: AgendaItem["type"]): AgendaItem => ({
  id: `${date}-${tag}`,
  date,
  tag,
  type,
  sex: "vaca",
  feet: ["FE"],
  title: "Retorno",
  detail: "Revisão do casco dianteiro esquerdo",
  overdue: false,
});

describe("agenda PDF data", () => {
  it("resume e ordena todos os compromissos visíveis", () => {
    const report = agendaReportData(
      [
        item("2026-09-11", "300", "preventive"),
        item("2026-09-02", "100", "recheck"),
        item("2026-09-03", "200", "curative"),
      ],
      "2026-09-03",
    );
    expect(report.counts).toEqual({ overdue: 1, today: 1, next7: 0, later: 1 });
    expect(report.rows.map((row) => row.tag)).toEqual(["100", "200", "300"]);
    expect(report.rows.map((row) => row.type)).toEqual(["Revisão", "Curativo", "Preventivo"]);
  });

  it("inclui solicitação agendada como tipo próprio", () => {
    const report = agendaReportData([item("2026-09-05", "400", "request")], "2026-09-03");

    expect(report.rows[0]).toMatchObject({
      tag: "400",
      type: "Solicitação",
      statusKey: "next7",
    });
  });
});
