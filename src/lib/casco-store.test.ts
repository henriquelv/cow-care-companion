import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  allAnimals,
  createPreventiveVisit,
  createVisitSyncPayloads,
  dateAfterDays,
  exportBackupJson,
  footWorstSeverity,
  footsWorstSeverity,
  hydrateVisitsFromIndexedDb,
  importBackupJson,
  loadFarm,
  loadLastBackupAt,
  normalizeSeverity,
  preventiveList,
  rechecksByDate,
  saveFarm,
  saveVisits,
  todayISO,
  type FarmConfig,
  type FootEntry,
  type Visit,
} from "./casco-store";
import { localdb } from "@/services/localdb";

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
  funcionarios: [],
  lotes: ["A1"],
  dias_para_preventivo: 180,
  animais: [],
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

  it("cria visita preventiva rápida com todos os pés OK", () => {
    const preventive = createPreventiveVisit({
      tag: "777",
      sex: "touro",
      lote: "A1",
      visitante_nome: "João",
    });

    expect(preventive.preventivo).toBe(true);
    expect(preventive.tag).toBe("777");
    expect(preventive.sex).toBe("touro");
    expect(preventive.lote).toBe("A1");
    expect(preventive.visitante_nome).toBe("João");
    expect(preventive.feet).toHaveLength(4);
    expect(preventive.feet.every((f) => f.ok)).toBe(true);
    expect(preventive.feet.every((f) => f.diseases?.length === 0)).toBe(true);
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

  it("hidrata visitas a partir do IndexedDB com pés e mídia remota", async () => {
    vi.useRealTimers();
    await localdb.open();
    await Promise.all([
      localdb.hoof_visits.clear(),
      localdb.hoof_feet.clear(),
      localdb.hoof_media.clear(),
    ]);
    localStorage.setItem(
      "casco.farm_context.v1",
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
