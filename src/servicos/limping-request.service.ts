import { farmContextService } from "./farm-context.service";
import { enqueueOutboxMany, localdb, putLocalRecord } from "./localdb";
import { uid } from "@/dominio/casco-store";

export type LimpingRequestStatus = "new" | "accepted" | "scheduled" | "attended" | "refused";

export interface LimpingRequest {
  id: string;
  farm_id: string;
  tag: string;
  note?: string;
  photo_media_id?: string;
  photo_storage_path?: string;
  status: LimpingRequestStatus;
  scheduled_date?: string;
  created_by: string;
  created_by_name: string;
  assigned_employee_id?: string;
  visit_id?: string;
  created_at: string;
  updated_at: string;
}

function contextOrThrow() {
  const context = farmContextService.getContext();
  if (!context) throw new Error("Fazenda não selecionada.");
  return context;
}

async function persist(request: LimpingRequest) {
  await putLocalRecord("limping_requests", {
    id: request.id,
    farm_id: request.farm_id,
    data: request,
    updated_at: request.updated_at,
    synced: false,
  });
  await enqueueOutboxMany([
    {
      farm_id: request.farm_id,
      tableName: "limping_requests",
      op: "upsert",
      payload: request,
    },
  ]);
  return request;
}

export const limpingRequestService = {
  async list() {
    const context = contextOrThrow();
    const rows = await localdb.limping_requests.where("farm_id").equals(context.farm_id).toArray();
    return rows
      .map((row) => row.data as LimpingRequest)
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  },

  async create(input: { tag: string; note?: string; photoMediaId?: string }) {
    const context = contextOrThrow();
    const tag = input.tag.trim();
    if (!tag) throw new Error("Informe o número do brinco.");
    const now = new Date().toISOString();
    return persist({
      id: uid(),
      farm_id: context.farm_id,
      tag,
      note: input.note?.trim() || undefined,
      photo_media_id: input.photoMediaId,
      status: "new",
      created_by: context.employee_id,
      created_by_name: context.employee_name,
      created_at: now,
      updated_at: now,
    });
  },

  async update(
    request: LimpingRequest,
    patch: Partial<
      Pick<LimpingRequest, "status" | "scheduled_date" | "assigned_employee_id" | "visit_id">
    >,
  ) {
    return persist({ ...request, ...patch, updated_at: new Date().toISOString() });
  },
};
