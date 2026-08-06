import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  addVisit,
  allAnimals,
  animalClinicalSnapshotFromVisits,
  agendaByDate,
  agendaByDateFromVisits,
  calendarMonthMetricsFromVisits,
  createVisitSyncPayloads,
  curativeDeadlineForDiseases,
  curativeFollowups,
  curativeMetrics,
  dateAfterDays,
  defaultDiseaseCatalog,
  employeeWorkMetricsFromVisits,
  exportBackupJson,
  footWorstSeverity,
  footsWorstSeverity,
  hydrateVisitsFromIndexedDb,
  importBackupJson,
  loadFarm,
  loadLastBackupAt,
  loadVisits,
  normalizeSeverity,
  normalizeDiseases,
  preventiveAgendaItems,
  preventiveList,
  recommendedRecheckForDiseases,
  rechecksByDate,
  saveFarm,
  saveVisits,
  SELECTABLE_TREATMENTS,
  TREATMENTS,
  todayISO,
  tacoMetricsFromVisits,
  toggleTreatmentSelection,
  toHoofVisitPayload,
  validateVisitClinicalData,
  visitIsVisible,
  visitIsFinalized,
  type FarmConfig,
  type FootEntry,
  type AgendaItem,
  type Visit,
} from "./casco-store";
import { enqueueOutboxMany, localdb, pendingOutbox } from "@/servicos/localdb";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

const farm: FarmConfig = {
  farmName: "Fazenda Teste",
  worker: "Gerente",
  configured: true,
  lotes: ["A1"],
  dias_para_preventivo: 180,
  animais: [],
  diseases: defaultDiseaseCatalog(),
};

function foot(overrides: Partial<FootEntry> = {}): FootEntry {
  return {
    foot: "FE",
    ok: true,
    zones: [],
    diseases: [],
    treatments: [],
    ...overrides,
  };
}

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: `v-${Math.random()}`,
    date: todayISO(),
    createdAt: Date.now(),
    tag: "100",
    sex: "vaca",
    feet: [foot({ foot: "FE" }), foot({ foot: "FD" }), foot({ foot: "TE" }), foot({ foot: "TD" })],
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-22T12:00:00-03:00"));
  const storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  saveFarm(farm);
});

describe("casco-store domain rules", () => {
  it("remove bloco dos novos tratamentos e preserva sua leitura no histórico", () => {
    const selectableCodes = SELECTABLE_TREATMENTS.map((treatment) => treatment.code);
    const historicalCodes = TREATMENTS.map((treatment) => treatment.code);
    expect(selectableCodes).not.toContain("BLOCO_ON");
    expect(selectableCodes).not.toContain("BLOCO_OFF");
    expect(selectableCodes).not.toContain("BLOCO_FIX");
    expect(historicalCodes).toEqual(expect.arrayContaining(["BLOCO_ON", "BLOCO_OFF", "BLOCO_FIX"]));
  });

  it("não considera rascunho ou registro incompleto como visita finalizada", () => {
    expect(visitIsFinalized(visit({ id: "finalizada", tag: "101" }))).toBe(true);
    expect(visitIsFinalized(visit({ id: "rascunho", tag: "" }))).toBe(false);
    expect(visitIsFinalized(visit({ id: "rascunho-preenchido", status: "draft" }))).toBe(false);
    expect(visitIsFinalized(visit({ id: "cancelada", status: "cancelled" }))).toBe(false);
  });

  it("separa quantidade de visitas da quantidade de animais únicos", () => {
    saveVisits([
      visit({ id: "a-1", tag: "100", createdAt: 1 }),
      visit({ id: "a-2", tag: "100", createdAt: 2 }),
      visit({ id: "a-3", tag: "100", createdAt: 3 }),
      visit({ id: "b-1", tag: "200", createdAt: 4 }),
    ]);

    const animals = allAnimals();
    expect(animals).toHaveLength(2);
    expect(animals.find((animal) => animal.tag === "100")?.totalVisits).toBe(3);
    expect(animals.find((animal) => animal.tag === "200")?.totalVisits).toBe(1);
  });

  it("oferece Sola Dupla e Problema de Locomoção no catálogo padrão", () => {
    const codes = defaultDiseaseCatalog().map((disease) => disease.code);
    expect(codes).toContain("DOUBLE_SOLE");
    expect(codes).toContain("LOCOMOTION");
  });

  it("impede classificar como preventivo quando existe problema ativo", () => {
    const lesionIssues = validateVisitClinicalData(
      visit({
        preventivo: true,
        feet: [foot({ foot: "FE", ok: false, diseases: [{ code: "SU", severity: 2 }] })],
      }),
    );
    const tacoIssues = validateVisitClinicalData(
      visit({
        preventivo: true,
        feet: [foot({ foot: "FD", taco: { action: "maintain", side: "right" } })],
      }),
    );
    expect(lesionIssues.some((issue) => issue.message.includes("Preventivo"))).toBe(true);
    expect(tacoIssues.some((issue) => issue.message.includes("Preventivo"))).toBe(true);
  });

  it("reclassifica no salvamento e conserva todos os diagnósticos", () => {
    addVisit(
      visit({
        id: "preventivo-com-achado",
        tag: "505",
        preventivo: true,
        feet: [
          foot({
            ok: false,
            diseases: [
              { code: "DD", severity: 2 },
              { code: "SU", severity: 3 },
            ],
          }),
        ],
      }),
    );

    const saved = loadVisits()[0];
    expect(saved.preventivo).toBe(false);
    expect(saved.feet[0].diseases).toEqual([
      { code: "DD", severity: 2 },
      { code: "SU", severity: 3 },
    ]);
  });

  it("preserva o início da doença enquanto o diagnóstico continua", () => {
    const first = visit({
      id: "doenca-1",
      tag: "501",
      date: "2026-05-01",
      createdAt: new Date("2026-05-01T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "FD", ok: false, diseases: [{ code: "DD", severity: 1 }] })],
    });
    const second = visit({
      id: "doenca-2",
      tag: "501",
      date: "2026-05-15",
      createdAt: new Date("2026-05-15T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "FD", ok: false, diseases: [{ code: "DD", severity: 2 }] })],
    });

    expect(
      animalClinicalSnapshotFromVisits([second, first], "501").activeDiseases[0],
    ).toMatchObject({
      code: "DD",
      foot: "FD",
      severity: 2,
      sinceDate: "2026-05-01",
      visits: 2,
    });
  });

  it("preserva várias doenças no mesmo casco e em cascos diferentes", () => {
    const first = visit({
      id: "multiplas-1",
      tag: "504",
      date: "2026-05-01",
      createdAt: new Date("2026-05-01T10:00:00-03:00").getTime(),
      feet: [
        foot({
          foot: "FE",
          ok: false,
          diseases: [
            { code: "DD", severity: 1 },
            { code: "SU", severity: 2 },
          ],
        }),
        foot({ foot: "TD", ok: false, diseases: [{ code: "LOCOMOTION", severity: 2 }] }),
      ],
    });
    const second = visit({
      id: "multiplas-2",
      tag: "504",
      date: "2026-05-10",
      createdAt: new Date("2026-05-10T10:00:00-03:00").getTime(),
      feet: [
        foot({
          foot: "FE",
          ok: false,
          diseases: [
            { code: "DD", severity: 2 },
            { code: "SU", severity: 2 },
          ],
        }),
        foot({ foot: "TD", ok: false, diseases: [{ code: "LOCOMOTION", severity: 3 }] }),
      ],
    });

    const snapshot = animalClinicalSnapshotFromVisits([second, first], "504");
    expect(snapshot.activeDiseases).toHaveLength(3);
    expect(snapshot.activeDiseases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ foot: "FE", code: "DD", severity: 2, visits: 2 }),
        expect.objectContaining({ foot: "FE", code: "SU", severity: 2, visits: 2 }),
        expect.objectContaining({ foot: "TD", code: "LOCOMOTION", severity: 3, visits: 2 }),
      ]),
    );
  });

  it("encerra o episódio clínico quando o casco é marcado como curado", () => {
    const active = visit({
      id: "ativa",
      tag: "502",
      date: "2026-05-01",
      createdAt: new Date("2026-05-01T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "TE", ok: false, diseases: [{ code: "SU", severity: 3 }] })],
    });
    const cured = visit({
      id: "curada",
      tag: "502",
      date: "2026-05-20",
      createdAt: new Date("2026-05-20T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "TE", ok: false, resolved: true, data_liberacao: "2026-05-20" })],
    });

    const snapshot = animalClinicalSnapshotFromVisits([active, cured], "502");
    expect(snapshot.activeDiseases).toEqual([]);
    expect(snapshot.hasActiveProblem).toBe(false);
  });

  it("permite liberar para preventivo quando o último problema foi curado", () => {
    addVisit(
      visit({
        id: "cura-preventiva",
        tag: "506",
        preventivo: true,
        feet: [
          foot({
            foot: "FE",
            ok: false,
            resolved: true,
            data_liberacao: "2026-05-22",
            diseases: [],
            recheck: false,
          }),
        ],
      }),
    );

    expect(loadVisits()[0].preventivo).toBe(true);
  });

  it("mantém a data original do taco até a retirada", () => {
    const applied = visit({
      id: "taco-aplicado",
      tag: "503",
      date: "2026-05-01",
      createdAt: new Date("2026-05-01T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "TD", ok: false, taco: { action: "apply", side: "right" } })],
    });
    const maintained = visit({
      id: "taco-mantido",
      tag: "503",
      date: "2026-05-10",
      createdAt: new Date("2026-05-10T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "TD", ok: false, taco: { action: "maintain", side: "right" } })],
    });
    const removed = visit({
      id: "taco-retirado",
      tag: "503",
      date: "2026-05-20",
      createdAt: new Date("2026-05-20T10:00:00-03:00").getTime(),
      feet: [foot({ foot: "TD", ok: false, taco: { action: "remove", side: "right" } })],
    });

    expect(
      animalClinicalSnapshotFromVisits([maintained, applied], "503").activeTacos[0],
    ).toMatchObject({
      foot: "TD",
      side: "right",
      sinceDate: "2026-05-01",
    });
    expect(
      animalClinicalSnapshotFromVisits([applied, maintained, removed], "503").activeTacos,
    ).toEqual([]);
  });

  it("cadastra automaticamente o animal na primeira visita sem duplicar o brinco", async () => {
    vi.useRealTimers();
    await localdb.open();
    await localdb.animals.clear();
    await localdb.outbox.clear();

    const first = addVisit(
      visit({
        id: "first-visit",
        farm_id: "farm-1",
        tag: "  Ab-123  ",
        sex: "vaca",
        lote: "a1",
      }),
    );
    const second = addVisit(
      visit({ id: "second-visit", farm_id: "farm-1", tag: "ab-123", sex: "vaca" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(first.animalCreated).toBe(true);
    expect(second.animalCreated).toBe(false);
    expect(loadFarm().animais).toEqual([{ tag: "Ab-123", sex: "vaca", lote: "A1" }]);
    expect(await localdb.animals.get("farm-1_Ab-123")).toMatchObject({
      farm_id: "farm-1",
      synced: false,
      data: expect.objectContaining({ tag: "Ab-123", lote: "A1", status: "active" }),
    });
    expect(await pendingOutbox("farm-1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "animals",
          op: "upsert",
          payload: expect.objectContaining({ tag: "Ab-123", lote: "A1", status: "active" }),
        }),
      ]),
    );
  });

  it("retira visitas canceladas das telas e mantém o status no payload remoto", () => {
    const cancelled = visit({ id: "visit-cancelled", status: "cancelled" });
    saveVisits([cancelled, visit({ id: "visit-active", status: "active" })]);

    expect(visitIsVisible(cancelled)).toBe(false);
    expect(loadVisits().map((item) => item.id)).toEqual(["visit-active"]);
    expect(toHoofVisitPayload(cancelled).status).toBe("cancelled");
  });

  it("ignora pés curados ao calcular gravidade ativa", () => {
    const active = foot({
      ok: false,
      diseases: [{ code: "SU", severity: 3, zones: [5] }],
    });
    const resolved = foot({
      foot: "FD",
      ok: false,
      resolved: true,
      diseases: [{ code: "DD", severity: 3, zones: [6] }],
    });

    expect(footWorstSeverity(resolved)).toBe(0);
    expect(footsWorstSeverity([active, resolved])).toBe(3);
  });

  it("normaliza grau legado 4 para grau 3", () => {
    expect(normalizeSeverity(4)).toBe(3);
    expect(
      footWorstSeverity(
        foot({
          ok: false,
          diseases: [{ code: "SU", severity: 4 as 3, zones: [5] }],
        }),
      ),
    ).toBe(3);
  });

  it("remove Talão com Lama da seleção e corrige Flegmão", () => {
    saveFarm({
      ...farm,
      diseases: [
        ...defaultDiseaseCatalog(),
        {
          code: "HHE",
          name: "Talão c/ Lama",
          full: "Talão por Lama / Esterco",
          emoji: "💧",
          recheckDays: 30,
          active: true,
        },
        {
          code: "FF",
          name: "Fleimão",
          full: "Fleimão / Podridão do Pé",
          emoji: "🦨",
          recheckDays: 30,
          active: true,
        },
      ],
    });

    expect(loadFarm().diseases.some((disease) => disease.code === "HHE")).toBe(false);
    expect(loadFarm().diseases.find((disease) => disease.code === "FF")).toMatchObject({
      name: "Flegmão",
      full: "Flegmão / Podridão do Pé",
    });
  });

  it("mantém várias lesões por casco e bloqueia tratamentos contraditórios", () => {
    expect(
      normalizeDiseases([
        { code: "DD", severity: 1 },
        { code: "SU", severity: 3 },
        { code: "DD", severity: 2 },
      ]),
    ).toEqual([
      { code: "DD", severity: 2 },
      { code: "SU", severity: 3 },
    ]);
    expect(
      validateVisitClinicalData(
        visit({
          tag: "899",
          feet: [
            foot({
              ok: false,
              diseases: [
                { code: "DD", severity: 2 },
                { code: "SU", severity: 3 },
              ],
            }),
          ],
        }),
      ),
    ).toEqual([]);
    expect(toggleTreatmentSelection(["BLOCO_ON"], "BLOCO_OFF")).toEqual(["BLOCO_OFF"]);
    expect(toggleTreatmentSelection([], "NADA", true)).toEqual([]);

    const invalid = visit({
      tag: "900",
      feet: [
        foot({
          ok: false,
          taco: { action: "apply" },
          diseases: [{ code: "DD", severity: 2 }],
        }),
      ],
    });
    expect(validateVisitClinicalData(invalid)).toEqual([
      expect.objectContaining({ foot: "FE", message: expect.stringContaining("lado") }),
    ]);
  });

  it("calcula tacos aplicados, removidos e ainda ativos", () => {
    const visits = [
      visit({
        id: "taco-apply-left",
        tag: "100",
        date: "2026-05-20",
        createdAt: new Date("2026-05-20T10:00:00-03:00").getTime(),
        feet: [foot({ ok: false, taco: { action: "apply", side: "left" } })],
      }),
      visit({
        id: "taco-remove-left",
        tag: "100",
        date: "2026-05-21",
        createdAt: new Date("2026-05-21T10:00:00-03:00").getTime(),
        feet: [foot({ ok: false, taco: { action: "remove", side: "left" } })],
      }),
      visit({
        id: "taco-apply-right",
        tag: "200",
        date: "2026-05-22",
        createdAt: new Date("2026-05-22T10:00:00-03:00").getTime(),
        feet: [foot({ foot: "FD", ok: false, taco: { action: "apply", side: "right" } })],
      }),
    ];

    expect(tacoMetricsFromVisits(visits, "2026-05-22")).toEqual({
      applied: 2,
      removed: 1,
      maintained: 0,
      active: 1,
      appliedToday: 1,
    });
  });

  it("calcula datas rápidas de revisão", () => {
    expect(dateAfterDays(2)).toBe("2026-05-24");
    expect(dateAfterDays(3)).toBe("2026-05-25");
    expect(dateAfterDays(5)).toBe("2026-05-27");
    expect(dateAfterDays(7)).toBe("2026-05-29");
  });

  it("mantém apenas a revisão aberta mais recente por animal no calendário", () => {
    saveVisits([
      visit({
        id: "new",
        createdAt: Date.now(),
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-30" })],
      }),
      visit({
        id: "old",
        createdAt: Date.now() - 86400000,
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-25" })],
      }),
    ]);

    const map = rechecksByDate();
    expect(map.get("2026-05-30")?.[0]?.tag).toBe("100");
    expect(map.has("2026-05-25")).toBe(false);
  });

  it("agenda todas as revisões recorrentes sem duplicar o prazo do curativo", () => {
    saveVisits([
      visit({
        id: "plano-recorrente",
        date: "2026-05-22",
        employee_id: "employee-romano",
        feet: [
          foot({
            ok: false,
            diseases: [{ code: "DD", severity: 2 }],
            treatments: ["SPRAY"],
            recheck: true,
            recheckDate: "2026-05-25",
            intervalo_revisao_dias: 3,
            revisoes_necessarias: 3,
          }),
        ],
      }),
    ]);

    const agenda = agendaByDate("2026-05-22", "employee-romano");
    expect(Array.from(agenda.keys())).toEqual(["2026-05-25", "2026-05-28", "2026-05-31"]);
    expect(agenda.get("2026-05-25")).toHaveLength(1);
    expect(agenda.get("2026-05-25")?.[0]).toMatchObject({
      type: "recheck",
      reviewNumber: 1,
      reviewTotal: 3,
      reviewIntervalDays: 3,
    });
    expect(agenda.get("2026-05-31")?.[0]?.detail).toContain("Revisão 3 de 3");
  });

  it("inclui intervalo e quantidade no payload sincronizado do pé", () => {
    const payload = createVisitSyncPayloads(
      visit({
        id: "sync-plano",
        farm_id: "farm-1",
        feet: [
          foot({
            ok: false,
            recheck: true,
            recheckDate: "2026-05-25",
            intervalo_revisao_dias: 3,
            revisoes_necessarias: 4,
          }),
        ],
      }),
    );
    expect(payload.feet[0]).toMatchObject({
      intervalo_revisao_dias: 3,
      revisoes_necessarias: 4,
    });
  });

  it("aplica os prazos clínicos de 7, 21 e 30 dias", () => {
    expect(curativeDeadlineForDiseases([{ code: "DD", severity: 2, zones: [6] }]).days).toBe(7);
    expect(curativeDeadlineForDiseases([{ code: "SU", severity: 2, zones: [1] }]).days).toBe(21);
    expect(curativeDeadlineForDiseases([{ code: "LB", severity: 1, zones: [2] }]).days).toBe(21);
    expect(
      curativeDeadlineForDiseases([{ code: "SOLE_ABSCESS", severity: 3, zones: [3] }]).days,
    ).toBe(30);
  });

  it("usa o menor prazo configurado quando há mais de uma doença", () => {
    const catalog = defaultDiseaseCatalog().map((disease) =>
      disease.code === "DD"
        ? { ...disease, recheckDays: 9 }
        : disease.code === "SU"
          ? { ...disease, recheckDays: 18 }
          : disease,
    );
    const diseases = [
      { code: "SU", severity: 2 as const },
      { code: "DD", severity: 1 as const },
    ];

    expect(recommendedRecheckForDiseases(diseases, catalog)).toMatchObject({
      days: 9,
      diseases: [{ code: "DD" }],
    });
    expect(curativeDeadlineForDiseases(diseases, catalog).days).toBe(9);
  });

  it("preserva o prazo escolhido no atendimento para o acompanhamento", () => {
    saveVisits([
      visit({
        id: "curativo-personalizado",
        date: "2026-05-10",
        createdAt: new Date("2026-05-10T12:00:00-03:00").getTime(),
        feet: [
          foot({
            ok: false,
            diseases: [{ code: "DD", severity: 2 }],
            treatments: ["SPRAY"],
            recheck: true,
            recheckDate: "2026-05-19",
            intervalo_revisao_dias: 9,
          }),
        ],
      }),
    ]);

    expect(curativeFollowups("2026-05-12")[0]).toMatchObject({
      dueDate: "2026-05-19",
      targetDays: 9,
    });
  });

  it("leva curativos abertos para a agenda e calcula atraso", () => {
    saveVisits([
      visit({
        id: "curativo-dd",
        date: "2026-05-10",
        createdAt: new Date("2026-05-10T12:00:00-03:00").getTime(),
        feet: [
          foot({
            ok: false,
            diseases: [{ code: "DD", severity: 2, zones: [6] }],
            treatments: ["SPRAY"],
          }),
        ],
      }),
    ]);

    const followups = curativeFollowups("2026-05-22");
    expect(followups[0]).toMatchObject({ dueDate: "2026-05-17", targetDays: 7, status: "overdue" });
    expect(agendaByDate("2026-05-22").get("2026-05-17")?.[0]?.type).toBe("curative");
    expect(curativeMetrics("2026-05-22")).toMatchObject({ open: 1, overdue: 1 });
  });

  it("isola a agenda pelo funcionário responsável", () => {
    saveVisits([
      visit({
        id: "agenda-romano",
        tag: "100",
        employee_id: "employee-romano",
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-25" })],
      }),
      visit({
        id: "agenda-patrick",
        tag: "200",
        employee_id: "employee-patrick",
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-25" })],
      }),
    ]);

    const romanoItems = agendaByDate("2026-05-22", "employee-romano").get("2026-05-25");
    expect(romanoItems?.map((item) => item.tag)).toEqual(["100"]);
  });

  it("mantém compromissos do mesmo brinco separados por fazenda", () => {
    const visits = [
      visit({
        id: "farm-a-visit",
        farm_id: "farm-a",
        employee_id: "employee-romano",
        tag: "100",
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-25" })],
      }),
      visit({
        id: "farm-b-visit",
        farm_id: "farm-b",
        employee_id: "employee-romano",
        tag: "100",
        feet: [foot({ ok: false, recheck: true, recheckDate: "2026-05-26" })],
      }),
    ];

    const agenda = agendaByDateFromVisits(visits, "2026-05-22", "employee-romano");
    expect(agenda.get("2026-05-25")?.[0]?.farm_id).toBe("farm-a");
    expect(agenda.get("2026-05-26")?.[0]?.farm_id).toBe("farm-b");
  });

  it("calcula o trabalho do funcionário sem misturar visitas de colegas", () => {
    const visits = [
      visit({
        id: "romano-hoje",
        employee_id: "employee-romano",
        employee_name: "Romano",
        date: "2026-05-22",
        createdAt: new Date("2026-05-22T10:00:00-03:00").getTime(),
        tag: "100",
      }),
      visit({
        id: "romano-problema",
        employee_id: "employee-romano",
        employee_name: "Romano",
        date: "2026-05-10",
        createdAt: new Date("2026-05-10T10:00:00-03:00").getTime(),
        tag: "100",
        feet: [foot({ ok: false, diseases: [{ code: "DD", severity: 2, zones: [6] }] })],
      }),
      visit({
        id: "romano-legado",
        employee_name: "Romano",
        date: "2026-05-20",
        createdAt: new Date("2026-05-20T10:00:00-03:00").getTime(),
        tag: "200",
      }),
      visit({
        id: "patrick",
        employee_id: "employee-patrick",
        employee_name: "Patrick",
        date: "2026-05-22",
        tag: "300",
      }),
      visit({
        id: "cancelled-romano",
        employee_id: "employee-romano",
        employee_name: "Romano",
        date: "2026-05-22",
        tag: "999",
        status: "cancelled",
      }),
    ];
    const agenda: AgendaItem[] = [
      {
        id: "late",
        date: "2026-05-21",
        type: "recheck",
        tag: "100",
        sex: "vaca",
        feet: ["FE"],
        title: "Revisão",
        detail: "Revisão clínica",
        overdue: true,
      },
      {
        id: "next",
        date: "2026-05-25",
        type: "curative",
        tag: "200",
        sex: "vaca",
        feet: ["FD"],
        title: "Curativo",
        detail: "Prazo de curativo",
        overdue: false,
      },
    ];

    expect(
      employeeWorkMetricsFromVisits(visits, agenda, "employee-romano", "Romano", "2026-05-22"),
    ).toMatchObject({
      totalVisits: 3,
      uniqueAnimals: 2,
      todayVisits: 1,
      monthVisits: 3,
      lastSevenDaysVisits: 2,
      problemVisits: 1,
      okVisits: 2,
      pendingAnimals: 2,
      overdueAnimals: 1,
    });
  });

  it("resume atendidos e agendados no mês exibido no calendário", () => {
    const visits = [
      visit({ employee_id: "employee-romano", date: "2026-05-02", tag: "100" }),
      visit({ employee_id: "employee-romano", date: "2026-05-03", tag: "100" }),
      visit({ employee_id: "employee-romano", date: "2026-05-04", tag: "200" }),
      visit({ employee_id: "employee-patrick", date: "2026-05-05", tag: "300" }),
      visit({
        employee_id: "employee-romano",
        date: "2026-05-06",
        tag: "999",
        status: "cancelled",
      }),
    ];
    const agenda = [
      { id: "1", date: "2026-05-08", tag: "100" },
      { id: "2", date: "2026-05-09", tag: "200" },
      { id: "3", date: "2026-06-01", tag: "400" },
    ] as AgendaItem[];

    expect(calendarMonthMetricsFromVisits(visits, agenda, "employee-romano", 2026, 4)).toEqual({
      visits: 3,
      attendedAnimals: 2,
      scheduledItems: 2,
      scheduledAnimals: 2,
    });
  });

  it("processa a fila offline somente para a fazenda ativa", async () => {
    vi.useRealTimers();
    await localdb.open();
    await localdb.outbox.clear();
    await enqueueOutboxMany([
      {
        farm_id: "farm-starmilk",
        tableName: "animals",
        op: "upsert",
        payload: { id: "animal-1", farm_id: "farm-starmilk" },
      },
      {
        farm_id: "farm-hullsjob",
        tableName: "animals",
        op: "upsert",
        payload: { id: "animal-2", farm_id: "farm-hullsjob" },
      },
    ]);

    const starMilkQueue = await pendingOutbox("farm-starmilk");
    expect(starMilkQueue).toHaveLength(1);
    expect(starMilkQueue[0].farm_id).toBe("farm-starmilk");
  });

  it("envia remoções de lotes e animais para os outros aparelhos", async () => {
    vi.useRealTimers();
    await localdb.open();
    await localdb.outbox.clear();
    localStorage.setItem(
      "casco.farm_context.v2",
      JSON.stringify({
        farm_id: "farm-1",
        farm_name: "Fazenda Teste",
        employee_id: "manager-1",
        employee_name: "Gerente",
        device_id: "device-1",
        is_admin: true,
        last_license_check_at: new Date().toISOString(),
        grace_period_days: 7,
      }),
    );
    saveFarm({
      ...farm,
      lotes: ["A1", "B2"],
      animais: [{ tag: "100", sex: "vaca", lote: "A1" }],
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await localdb.outbox.clear();

    saveFarm({ ...farm, lotes: ["B2"], animais: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const queue = await pendingOutbox("farm-1");
    const removals = queue.filter((item) => item.op === "delete");

    expect(removals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tableName: "farm_lotes",
          payload: { id: "farm-1_A1", farm_id: "farm-1" },
        }),
        expect.objectContaining({
          tableName: "animals",
          payload: { id: "farm-1_100", farm_id: "farm-1" },
        }),
      ]),
    );
  });

  it("lista preventivo para animais saudáveis e exclui problema ativo", () => {
    saveFarm({
      ...farm,
      animais: [
        { tag: "100", lote: "A1" },
        { tag: "200", lote: "A1" },
      ],
    });
    saveVisits([
      visit({
        tag: "200",
        feet: [foot({ ok: false, diseases: [{ code: "DD", severity: 2, zones: [6] }] })],
      }),
    ]);

    const tags = preventiveList(0).map((a) => a.tag);
    expect(tags).toContain("100");
    expect(tags).not.toContain("200");
  });

  it("agenda o preventivo e move a próxima data depois do casqueamento", () => {
    saveFarm({
      ...farm,
      dias_para_preventivo: 10,
      animais: [
        { tag: "100", sex: "vaca", lote: "A1" },
        { tag: "200", sex: "vaca", lote: "A1" },
      ],
    });
    saveVisits([
      visit({
        id: "preventive-old",
        tag: "100",
        date: "2026-05-10",
        createdAt: new Date("2026-05-10T10:00:00-03:00").getTime(),
        preventivo: true,
      }),
    ]);

    expect(preventiveAgendaItems("2026-05-22", 10)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tag: "100", date: "2026-05-20", overdue: true }),
        expect.objectContaining({ tag: "200", date: "2026-05-22", overdue: false }),
      ]),
    );
    expect(
      agendaByDate("2026-05-22", undefined, { includePreventive: true }).get("2026-05-20")?.[0],
    ).toMatchObject({ tag: "100", type: "preventive" });

    saveVisits([
      visit({
        id: "preventive-done",
        tag: "100",
        date: "2026-05-22",
        createdAt: new Date("2026-05-22T10:00:00-03:00").getTime(),
        preventivo: true,
      }),
    ]);
    const updated = preventiveAgendaItems("2026-05-22", 10).find((item) => item.tag === "100");
    expect(updated).toMatchObject({ date: "2026-06-01", overdue: false });
  });

  it("gera payloads separados de visita e pés para sync", () => {
    const v = visit({
      id: "visit-1",
      farm_id: "farm-1",
      feet: [
        foot({ foot: "FE", ok: false, diseases: [{ code: "DD", severity: 2, zones: [6] }] }),
        foot({ foot: "FD" }),
        foot({ foot: "TE" }),
        foot({ foot: "TD" }),
      ],
    });

    const payloads = createVisitSyncPayloads(v);
    expect(payloads.visit.id).toBe("visit-1");
    expect(payloads.visit.farm_id).toBe("farm-1");
    expect(payloads.feet).toHaveLength(4);
    expect(payloads.feet.map((f) => f.id)).toContain("visit-1_FE");
    expect(payloads.feet[0].visit_id).toBe("visit-1");
  });

  it("gera referência leve de mídia para foto no sync", () => {
    const v = visit({
      id: "visit-photo",
      farm_id: "farm-1",
      feet: [
        foot({ foot: "FE", photo: "media:media-1", photoPendingUpload: true }),
        foot({ foot: "FD" }),
        foot({ foot: "TE" }),
        foot({ foot: "TD" }),
      ],
    });

    const payloads = createVisitSyncPayloads(v);
    expect(payloads.media).toHaveLength(1);
    expect(payloads.media[0]).toMatchObject({
      id: "media-1",
      farm_id: "farm-1",
      visit_id: "visit-photo",
      foot: "FE",
      pending_upload: true,
    });
  });

  it("gera vínculo auditável entre a visita original e a correção", () => {
    const v = visit({
      id: "visit-correction",
      farm_id: "farm-1",
      employee_id: "employee-1",
      device_id: "device-1",
      correction_of_id: "visit-original",
      correction_reason: "Pé informado incorretamente",
    });

    const payloads = createVisitSyncPayloads(v);
    expect(payloads.correction).toMatchObject({
      id: "correction_visit-correction",
      farm_id: "farm-1",
      original_visit_id: "visit-original",
      correction_visit_id: "visit-correction",
      reason: "Pé informado incorretamente",
      employee_id: "employee-1",
      device_id: "device-1",
    });
  });

  it("hidrata visitas a partir do IndexedDB com pés e mídia remota", async () => {
    vi.useRealTimers();
    await localdb.open();
    await Promise.all([
      localdb.hoof_visits.clear(),
      localdb.hoof_feet.clear(),
      localdb.hoof_media.clear(),
    ]);
    localStorage.setItem(
      "casco.farm_context.v2",
      JSON.stringify({
        farm_id: "farm-1",
        farm_name: "Fazenda Teste",
        employee_id: "emp-1",
        employee_name: "João",
        device_id: "dev-1",
        last_license_check_at: new Date().toISOString(),
        grace_period_days: 7,
      }),
    );
    await localdb.hoof_visits.put({
      id: "visit-remote",
      farm_id: "farm-1",
      data: {
        id: "visit-remote",
        farm_id: "farm-1",
        tag: "900",
        sex: "vaca",
        date: "2026-05-22",
        created_at: "2026-05-22T12:00:00.000Z",
      },
      updated_at: "2026-05-22T12:00:00.000Z",
      synced: true,
    });
    await localdb.hoof_feet.put({
      id: "visit-remote_FE",
      farm_id: "farm-1",
      data: {
        id: "visit-remote_FE",
        farm_id: "farm-1",
        visit_id: "visit-remote",
        foot: "FE",
        ok: false,
        diseases: [{ code: "DD", severity: 2, zones: [6] }],
      },
      updated_at: "2026-05-22T12:00:00.000Z",
      synced: true,
    });
    await localdb.hoof_media.put({
      id: "media-remote",
      farm_id: "farm-1",
      data: {
        id: "media-remote",
        farm_id: "farm-1",
        visit_id: "visit-remote",
        foot: "FE",
        storage_path: "farms/farm-1/hoof/visit-remote/media-remote.jpg",
      },
      updated_at: "2026-05-22T12:00:00.000Z",
      synced: true,
    });

    const visits = await hydrateVisitsFromIndexedDb();
    expect(visits[0].tag).toBe("900");
    expect(visits[0].feet[0].photo).toBe("media:media-remote");
    expect(visits[0].feet[0].photoStoragePath).toContain("media-remote.jpg");
  });

  it("exporta e importa backup completo do aparelho", () => {
    saveVisits([visit({ tag: "321" })]);
    const exported = exportBackupJson();

    localStorage.clear();
    importBackupJson(exported);

    expect(loadFarm().farmName).toBe("Fazenda Teste");
    expect(allAnimals().map((a) => a.tag)).toContain("321");
    expect(loadLastBackupAt()).toBeTruthy();
  });
});
