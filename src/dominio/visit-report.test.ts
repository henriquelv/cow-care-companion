import { describe, expect, it } from "vitest";
import {
  employeeReportBreakdown,
  filterVisitsForReport,
  visitFootReportCells,
  visitReportMetrics,
} from "./visit-report";
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

  it("permite ao administrador consolidar toda a equipe da fazenda", () => {
    const companyVisits = [
      visits[0],
      visits[1],
      visit({ id: "other-farm", tag: "900", farm_id: "farm-2" }),
    ].map((item, index) => (index < 2 ? { ...item, farm_id: "farm-1" } : item));

    expect(
      filterVisitsForReport(companyVisits, { farmId: "farm-1" }).map((item) => item.id),
    ).toEqual(["normal", "problem"]);
    expect(
      employeeReportBreakdown(filterVisitsForReport(companyVisits, { farmId: "farm-1" })),
    ).toMatchObject([
      { employeeName: "Patrick", visits: 1 },
      { employeeName: "Romano", visits: 1 },
    ]);
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

  it("separa a produção da equipe por funcionário sem incluir cancelados", () => {
    expect(employeeReportBreakdown(visits)).toMatchObject([
      { employeeName: "Patrick", visits: 1, animals: 1, withProblem: 1 },
      { employeeName: "Romano", visits: 1, animals: 1, preventive: 1 },
    ]);
  });

  it("gera uma coluna para cada um dos quatro cascos em toda visita", () => {
    const cells = visitFootReportCells(
      visit({
        preventivo: false,
        feet: [
          {
            foot: "FE",
            ok: false,
            zones: [0],
            diseases: [{ code: "DD", severity: 2 }],
            treatments: ["SPRAY"],
            recheck: true,
            recheckDate: "2026-07-18",
            intervalo_revisao_dias: 3,
            revisoes_necessarias: 3,
          },
          { foot: "FD", ok: true },
          {
            foot: "TE",
            ok: true,
            resolved: true,
            diseases: [{ code: "SU", severity: 2 }],
          },
          { foot: "TD", ok: true, taco: { action: "apply", side: "right" } },
        ],
      }),
    );

    expect(cells.map((cell) => cell.foot)).toEqual(["FE", "FD", "TE", "TD"]);
    expect(cells[0]).toMatchObject({ status: "problem", severity: 2 });
    expect(cells[0].text).toContain("Dermatite Digital");
    expect(cells[0].text).toContain("G2 Médio");
    expect(cells[0].text).toContain("Spray");
    expect(cells[0].text).toContain("3x a cada 3 dias");
    expect(cells[1]).toMatchObject({ status: "normal", text: "CASCO NORMAL" });
    expect(cells[2].text).toContain("CURADO / LIBERADO");
    expect(cells[3].text).toContain("Taco: Colocar taco · Lado direito");
  });

  it("identifica casco sem registro em atendimento legado incompleto", () => {
    const cells = visitFootReportCells(
      visit({ feet: [{ foot: "FE", ok: true }], preventivo: true }),
    );

    expect(cells).toHaveLength(4);
    expect(cells[0]).toMatchObject({ status: "normal", text: "CASCO NORMAL · PREVENTIVO" });
    expect(cells.slice(1).every((cell) => cell.status === "unrecorded")).toBe(true);
    expect(cells.slice(1).every((cell) => cell.text === "SEM REGISTRO")).toBe(true);
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
