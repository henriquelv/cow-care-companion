import { describe, expect, it } from "vitest";
import type { Visit } from "./casco-store";
import {
  billingForVisit,
  billingSummaryFromVisits,
  createVisitBillingSnapshot,
  monthlyBillingSeries,
  type PricingConfig,
} from "./billing";

const pricing: PricingConfig = {
  preventive: 40,
  clinicalVisit: 20,
  bandage: 12,
  tacoApply: 30,
  tacoMaintain: 8,
  tacoRemove: 10,
  diseases: { DD: 15, SU: 25 },
};

const catalog = [
  { code: "DD", name: "DD", full: "Dermatite Digital", emoji: "", recheckDays: 7, active: true },
  { code: "SU", name: "SU", full: "Úlcera de Sola", emoji: "", recheckDays: 21, active: true },
];

function visit(partial: Partial<Visit> = {}): Visit {
  return {
    id: "visit-1",
    status: "active",
    date: "2026-08-15",
    createdAt: new Date("2026-08-15T10:00:00-03:00").getTime(),
    completedAt: new Date("2026-08-15T10:05:00-03:00").getTime(),
    tag: "100",
    sex: "vaca",
    preventivo: true,
    employee_id: "employee-1",
    employee_name: "Romano",
    feet: ["FE", "FD", "TE", "TD"].map((foot) => ({
      foot: foot as "FE" | "FD" | "TE" | "TD",
      ok: true,
      diseases: [],
      treatments: [],
    })),
    ...partial,
  };
}

describe("billing", () => {
  it("calcula um preventivo por visita", () => {
    const result = billingForVisit(visit(), pricing, catalog);
    expect(result.total).toBe(40);
    expect(result.lines).toEqual([expect.objectContaining({ key: "preventive", total: 40 })]);
  });

  it("soma atendimento, doenças por casco, curativo e taco", () => {
    const clinical = visit({
      preventivo: false,
      feet: [
        {
          foot: "FE",
          ok: false,
          diseases: [
            { code: "DD", severity: 2 },
            { code: "SU", severity: 1 },
          ],
          treatments: ["BAND_ON"],
          taco: { action: "apply", side: "left" },
        },
        { foot: "FD", ok: true },
        { foot: "TE", ok: true },
        { foot: "TD", ok: true },
      ],
    });
    expect(billingForVisit(clinical, pricing, catalog).total).toBe(102);
  });

  it("preserva o valor congelado mesmo depois de reajuste", () => {
    const original = visit();
    const snapshot = createVisitBillingSnapshot(original, pricing, catalog)!;
    const saved = { ...original, billing: snapshot };
    const increased = { ...pricing, preventive: 100 };
    expect(billingForVisit(saved, increased, catalog)).toMatchObject({
      total: 40,
      estimated: false,
    });
  });

  it("marca visitas antigas como estimativa e cria série mensal", () => {
    const august = visit();
    const july = visit({
      id: "visit-2",
      date: "2026-07-10",
      createdAt: new Date("2026-07-10T10:00:00-03:00").getTime(),
    });
    const summary = billingSummaryFromVisits([august, july], pricing, catalog);
    expect(summary).toMatchObject({ visits: 2, total: 80, estimatedVisits: 2 });
    expect(monthlyBillingSeries([august, july], pricing, catalog, "2026-08-15", 2)).toEqual([
      expect.objectContaining({ prefix: "2026-07", total: 40, visits: 1 }),
      expect.objectContaining({ prefix: "2026-08", total: 40, visits: 1 }),
    ]);
  });
});
