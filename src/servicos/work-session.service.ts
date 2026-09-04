import { enqueueOutboxMany, putLocalRecord } from "./localdb";
import { farmContextService } from "./farm-context.service";

export interface HoofWorkSession {
  id: string;
  farm_id: string;
  employee_id: string;
  employee_name: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

function activeKey(farmId: string, employeeId: string) {
  return `casco.work_session.active.v1.${farmId}.${employeeId}`;
}

function readActive(): HoofWorkSession | null {
  if (typeof localStorage === "undefined") return null;
  const context = farmContextService.getContext();
  if (!context) return null;
  try {
    const session = JSON.parse(
      localStorage.getItem(activeKey(context.farm_id, context.employee_id)) ?? "null",
    ) as HoofWorkSession | null;
    return session?.status === "active" && session.farm_id === context.farm_id ? session : null;
  } catch {
    return null;
  }
}

async function persist(session: HoofWorkSession) {
  await putLocalRecord("hoof_work_sessions", {
    id: session.id,
    farm_id: session.farm_id,
    data: session,
    updated_at: session.updated_at,
    synced: false,
  });
  await enqueueOutboxMany([
    {
      farm_id: session.farm_id,
      tableName: "hoof_work_sessions",
      op: "upsert",
      payload: session,
    },
  ]);
}

export const workSessionService = {
  getActive: readActive,

  async start() {
    const existing = readActive();
    if (existing) return existing;
    const context = farmContextService.getContext();
    if (!context) throw new Error("Selecione a fazenda antes de iniciar a visita.");
    const now = new Date().toISOString();
    const session: HoofWorkSession = {
      id: crypto.randomUUID(),
      farm_id: context.farm_id,
      employee_id: context.employee_id,
      employee_name: context.employee_name,
      device_id: context.device_id,
      started_at: now,
      status: "active",
      created_at: now,
      updated_at: now,
    };
    localStorage.setItem(activeKey(context.farm_id, context.employee_id), JSON.stringify(session));
    await persist(session);
    return session;
  },

  async complete() {
    const active = readActive();
    if (!active) throw new Error("Não há visita à fazenda em andamento.");
    const now = new Date().toISOString();
    const completed: HoofWorkSession = {
      ...active,
      ended_at: now,
      status: "completed",
      updated_at: now,
    };
    localStorage.removeItem(activeKey(active.farm_id, active.employee_id));
    await persist(completed);
    return completed;
  },
};
