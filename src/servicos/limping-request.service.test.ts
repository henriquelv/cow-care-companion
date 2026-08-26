import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { farmContextService } from "./farm-context.service";
import { limpingRequestService } from "./limping-request.service";
import { localdb, pendingOutbox } from "./localdb";

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
}

describe("limping request service", () => {
  beforeEach(async () => {
    Object.defineProperty(globalThis, "window", { value: globalThis, configurable: true });
    Object.defineProperty(globalThis, "localStorage", {
      value: new MemoryStorage(),
      configurable: true,
    });
    await localdb.limping_requests.clear();
    await localdb.outbox.clear();
    farmContextService.saveContext({
      client_code: "HULLSJOB",
      farm_id: "farm-a",
      farm_name: "Fazenda A",
      employee_id: "employee-a",
      employee_name: "Romano",
      device_id: "device-a",
      last_license_check_at: new Date().toISOString(),
      grace_period_days: 7,
    });
  });

  it("salva por fazenda, entra no outbox e percorre os estados", async () => {
    const created = await limpingRequestService.create({
      tag: "3051",
      note: "Mancando",
      photoMediaId: "photo-1",
    });
    expect(created).toMatchObject({
      farm_id: "farm-a",
      tag: "3051",
      status: "new",
      created_by: "employee-a",
      photo_media_id: "photo-1",
    });
    expect(await pendingOutbox("farm-a")).toHaveLength(1);

    const scheduled = await limpingRequestService.update(created, {
      status: "scheduled",
      scheduled_date: "2026-09-01",
      assigned_employee_id: "employee-a",
    });
    expect(scheduled).toMatchObject({ status: "scheduled", scheduled_date: "2026-09-01" });
    expect(await limpingRequestService.list()).toEqual([
      expect.objectContaining({ id: created.id, farm_id: "farm-a" }),
    ]);
  });

  it("não aceita solicitação sem brinco", async () => {
    await expect(limpingRequestService.create({ tag: "   " })).rejects.toThrow(
      "Informe o número do brinco",
    );
  });
});
