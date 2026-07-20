import { beforeEach, describe, expect, it, vi } from "vitest";
import { activationService } from "@/services/activation.service";
import { farmContextService } from "@/services/farm-context.service";
import { authenticateBootstrapEmployee, findBootstrapClient } from "./tenant-bootstrap";

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

beforeEach(() => {
  const storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { localStorage: storage });
  vi.stubGlobal("navigator", { onLine: false, userAgent: "Vitest" });
});

describe("catálogo inicial de empresas", () => {
  it("mantém StarMilk e Hullsjob separadas", () => {
    const starMilk = findBootstrapClient("STARMILK");
    const hullsjob = findBootstrapClient("HULLSJOB");

    expect(starMilk?.id).toBe("10000000-0000-4000-8000-000000000001");
    expect(hullsjob?.id).toBe("10000000-0000-4000-8000-000000000002");
    expect(starMilk?.id).not.toBe(hullsjob?.id);
  });

  it.each([
    ["Romano", "001"],
    ["Jeová", "002"],
    ["Patrick", "003"],
  ])("autentica %s pelo nome e pelo código %s", (name, code) => {
    const byName = authenticateBootstrapEmployee("HULLSJOB", name, "1234");
    const byCode = authenticateBootstrapEmployee("HULLSJOB", code, "1234");

    expect(byName?.employee.name).toBe(name);
    expect(byCode?.employee.name).toBe(name);
    expect(byName?.farms[0].name).toBe("Fazenda Vitória");
    expect(byName?.farms[0].client_id).toBe(byName?.client.id);
  });

  it("não aceita funcionário, empresa ou senha incorretos", () => {
    expect(authenticateBootstrapEmployee("HULLSJOB", "Romano", "9999")).toBeNull();
    expect(authenticateBootstrapEmployee("STARMILK", "Romano", "1234")).toBeNull();
    expect(findBootstrapClient("INEXISTENTE")).toBeNull();
  });

  it("conclui a ativação offline e salva a fazenda selecionada", async () => {
    const { client } = await activationService.validateActivationCode("HULLSJOB");
    const access = await activationService.authenticateEmployee("HULLSJOB", "002", "1234");
    const context = await activationService.activate(access.farms[0], access.employee, client);

    expect(context.client_id).toBe(client.id);
    expect(context.farm_name).toBe("Fazenda Vitória");
    expect(context.employee_name).toBe("Jeová");
    expect(context.trial_expires_at).toBeTruthy();
    expect(farmContextService.getContext()).toEqual(context);
  });
});
