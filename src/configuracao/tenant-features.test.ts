import { describe, expect, it } from "vitest";
import { canViewFinancial, tenantFeatures } from "./tenant-features";

describe("tenant features", () => {
  it("habilita o mapa e o financeiro somente na Hullsjob", () => {
    expect(tenantFeatures({ client_code: "HULLSJOB" })).toMatchObject({
      hoofMap: true,
      pricing: true,
      financial: true,
      limpingRequests: true,
      workSessions: true,
    });
    expect(tenantFeatures({ client_code: "STARMILK" })).toMatchObject({
      hoofMap: false,
      pricing: false,
      financial: false,
      limpingRequests: false,
      workSessions: false,
    });
  });

  it("exige permissão individual para mostrar valores", () => {
    expect(canViewFinancial({ client_code: "HULLSJOB", can_view_financial: true })).toBe(true);
    expect(canViewFinancial({ client_code: "HULLSJOB", can_view_financial: false })).toBe(false);
    expect(canViewFinancial({ client_code: "STARMILK", can_view_financial: true })).toBe(false);
  });

  it("permite configuração central por fazenda", () => {
    expect(tenantFeatures({ client_code: "STARMILK" }, { hoofMap: true }).hoofMap).toBe(true);
  });
});
