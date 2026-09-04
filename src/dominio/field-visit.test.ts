import { describe, expect, it } from "vitest";
import { countFieldVisits } from "./field-visit";
import type { Visit } from "./casco-store";

function visit(overrides: Partial<Visit> = {}): Visit {
  return {
    id: crypto.randomUUID(),
    farm_id: "farm-1",
    date: "2026-09-03",
    createdAt: Date.now(),
    completedAt: Date.now(),
    status: "active",
    tag: "100",
    sex: "vaca",
    employee_id: "employee-1",
    employee_name: "Romano",
    feet: [],
    ...overrides,
  };
}

describe("field visits", () => {
  it("agrupa vários animais na mesma visita iniciada", () => {
    expect(
      countFieldVisits([
        visit({ tag: "100", work_session_id: "session-1" }),
        visit({ tag: "101", work_session_id: "session-1" }),
        visit({ tag: "102", work_session_id: "session-1" }),
      ]),
    ).toBe(1);
  });

  it("separa visitas iniciadas em momentos diferentes", () => {
    expect(
      countFieldVisits([
        visit({ work_session_id: "session-1" }),
        visit({ work_session_id: "session-2" }),
      ]),
    ).toBe(2);
  });

  it("agrupa registros legados por fazenda, funcionário e data", () => {
    expect(
      countFieldVisits([
        visit({ tag: "100" }),
        visit({ tag: "101" }),
        visit({ tag: "102", employee_id: "employee-2" }),
        visit({ tag: "103", date: "2026-09-04" }),
      ]),
    ).toBe(3);
  });
});
