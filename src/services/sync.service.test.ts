import { describe, expect, it } from "vitest";
import { scopeSyncPayload } from "./sync.service";

const context = {
  farm_id: "farm-1",
  employee_id: "employee-1",
  employee_name: "Romano",
  device_id: "device-1",
};

describe("payload de sincronização", () => {
  it("inclui auditoria do funcionário somente na visita", () => {
    expect(scopeSyncPayload("hoof_visits", { id: "visit-1", tag: "100" }, context)).toEqual({
      id: "visit-1",
      tag: "100",
      farm_id: "farm-1",
      employee_id: "employee-1",
      employee_name: "Romano",
      device_id: "device-1",
    });
  });

  it("remove campos incompatíveis das outras tabelas", () => {
    expect(
      scopeSyncPayload(
        "animals",
        {
          id: "animal-1",
          tag: "100",
          employee_id: "old-employee",
          employee_name: "Outro",
          device_id: "old-device",
        },
        context,
      ),
    ).toEqual({ id: "animal-1", tag: "100", farm_id: "farm-1" });
  });

  it("inclui funcionário e aparelho na correção auditável", () => {
    expect(
      scopeSyncPayload(
        "hoof_corrections",
        { id: "correction-1", original_visit_id: "visit-1", employee_id: "old" },
        context,
      ),
    ).toEqual({
      id: "correction-1",
      original_visit_id: "visit-1",
      farm_id: "farm-1",
      employee_id: "employee-1",
      device_id: "device-1",
    });
  });
});
