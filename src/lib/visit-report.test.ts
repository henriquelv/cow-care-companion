import { describe, expect, it } from "vitest";
import { filterVisitsForReport, visitReportMetrics } from "./visit-report";
import type { Visit } from "./casco-store";

function visit(overrides: Partial<Visit>): Visit {
  return {
    id: "visit",
    date: "2026-07-15",
    createdAt: new Date("2026-07-15T10:00:00-03:00").getTime(),
    tag: "100",
    sex: "vaca",
    employee_id: "employee-1",
    employee_name: "Romano",
    feet: [
      { foot: "FE", ok: true },
      { foot: "FD", ok: true },
      { foot: "TE", ok: true },
      { foot: "TD", ok: true },
    ],
    ...overrides,
  };
}

describe("visit reports", () => {
  const visits = [
    visit({ id: "normal", tag: "100", preventivo: true }),
    visit({
      id: "problem",
      tag: "200",
      employee_id: "employee-2",
      employee_name: "Patrick",
      feet: [
        {
          foot: "FE",
          ok: false,
          diseases: [{ code: "DD", severity: 2 }],
          recheck: true,
          recheckDate: "2026-07-18",
        },
      ],
    }),
    visit({ id: "cancelled", tag: "300", status: "cancelled" }),
  ];

  it("limita o relatório do funcionário aos próprios atendimentos", () => {
    expect(
      filterVisitsForReport(visits, {
        employeeId: "employee-1",
        employeeName: "Romano",
      }).map((item) => item.id),
    ).toEqual(["normal"]);
  });

  it("filtra preventivos e problemas e calcula métricas", () => {
    expect(filterVisitsForReport(visits, { status: "preventive" })).toHaveLength(1);
    expect(filterVisitsForReport(visits, { status: "problem" })).toHaveLength(1);
    expect(visitReportMetrics(visits)).toMatchObject({
      visits: 2,
      animals: 2,
      preventive: 1,
      normal: 0,
      withoutProblem: 1,
      withProblem: 1,
      moderate: 1,
    });
  });

  it("não inclui registro incompleto nas métricas", () => {
    const incomplete = visit({ id: "draft", tag: "", feet: [] });
    expect(visitReportMetrics([...visits, incomplete]).visits).toBe(2);
  });

  it("filtra e contabiliza atendimentos com taco", () => {
    const withTaco = visit({
      id: "taco",
      tag: "400",
      feet: [
        {
          foot: "TD",
          ok: false,
          diseases: [{ code: "DD", severity: 2 }],
          taco: { action: "apply", side: "right" },
        },
      ],
    });

    expect(filterVisitsForReport([...visits, withTaco], { status: "taco" })).toEqual([withTaco]);
    expect(visitReportMetrics([...visits, withTaco])).toMatchObject({
      withTaco: 1,
      tacosApplied: 1,
    });
  });
});
