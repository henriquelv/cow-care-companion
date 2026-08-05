import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { farmContextService, type FarmContext } from "./farm-context.service";

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

describe("farm device identity", () => {
  let storage: MemoryStorage;
  let cookieDocument: { cookie: string };

  beforeEach(() => {
    storage = new MemoryStorage();
    cookieDocument = { cookie: "" };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("document", cookieDocument);
    vi.stubGlobal("location", { protocol: "https:" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mantém o mesmo aparelho ao trocar de fazenda ou entrar novamente", () => {
    const deviceId = farmContextService.getDeviceId();
    const context: FarmContext = {
      farm_id: "farm-1",
      farm_name: "Fazenda",
      employee_id: "employee-1",
      employee_name: "Funcionário",
      device_id: deviceId,
      last_license_check_at: new Date().toISOString(),
      grace_period_days: 7,
    };

    farmContextService.saveContext(context);
    farmContextService.clearContext();

    expect(farmContextService.getContext()).toBeNull();
    expect(farmContextService.getDeviceId()).toBe(deviceId);
  });

  it("recupera o identificador pelo cookie se o localStorage perder apenas essa chave", () => {
    const deviceId = farmContextService.getDeviceId();
    storage.removeItem("casco.device_id.v1");

    expect(farmContextService.getDeviceId()).toBe(deviceId);
    expect(storage.getItem("casco.device_id.v1")).toBe(deviceId);
  });
});
