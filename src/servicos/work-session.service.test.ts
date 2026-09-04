import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { farmContextService } from "./farm-context.service";
import { localdb } from "./localdb";
import { workSessionService } from "./work-session.service";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("work session service", () => {
  beforeEach(async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
    localStorage.clear();
    await localdb.delete();
    await localdb.open();
    farmContextService.saveContext({
      client_code: "HULLSJOB",
      farm_id: "farm-1",
      farm_name: "Fazenda Vitória",
      employee_id: "employee-1",
      employee_name: "Romano",
      device_id: "device-1",
      last_license_check_at: new Date().toISOString(),
      grace_period_days: 7,
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    localStorage.clear();
    await localdb.delete();
    vi.unstubAllGlobals();
  });

  it("mantém uma única visita ativa até o encerramento", async () => {
    const first = await workSessionService.start();
    const second = await workSessionService.start();

    expect(second.id).toBe(first.id);
    expect(workSessionService.getActive()?.id).toBe(first.id);

    const completed = await workSessionService.complete();
    expect(completed).toMatchObject({ id: first.id, status: "completed" });
    expect(completed.ended_at).toBeTruthy();
    expect(workSessionService.getActive()).toBeNull();
    expect(await localdb.outbox.count()).toBe(2);
  });
});
