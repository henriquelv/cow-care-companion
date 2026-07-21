import { requireSupabase, isSupabaseConfigured } from "./supabase";
import { activationService } from "./activation.service";
import { farmContextService } from "./farm-context.service";
import { localdb, pendingOutbox } from "./localdb";
import { uploadPhotoBlob } from "./media.service";
import { hydrateVisitsFromIndexedDb } from "@/lib/casco-store";

const SYNC_TABLES = [
  "hoof_visits",
  "hoof_feet",
  "animals",
  "farm_lotes",
  "farm_settings",
  "hoof_media",
] as const;

function conflictTarget(tableName: string) {
  switch (tableName) {
    case "animals":
      return "farm_id,tag";
    case "farm_lotes":
      return "farm_id,name";
    case "farm_settings":
      return "farm_id";
    default:
      return "id";
  }
}

export function scopeSyncPayload(
  tableName: string,
  payload: Record<string, unknown>,
  context: {
    farm_id: string;
    employee_id: string;
    employee_name: string;
    device_id: string;
  },
) {
  const {
    employee_id: _employeeId,
    employee_name: _employeeName,
    device_id: _deviceId,
    ...tablePayload
  } = payload;
  const scopedPayload = { ...tablePayload, farm_id: context.farm_id };

  return tableName === "hoof_visits"
    ? {
        ...scopedPayload,
        employee_id: context.employee_id,
        employee_name: context.employee_name,
        device_id: context.device_id,
      }
    : scopedPayload;
}

export const syncService = {
  isSyncing: false,

  async syncAll(): Promise<{ ok: boolean; count: number; message?: string }> {
    if (!isSupabaseConfigured) return { ok: true, count: 0, message: "Modo local." };
    if (this.isSyncing) return { ok: true, count: 0 };
    if (!navigator.onLine) return { ok: false, count: 0, message: "Offline." };

    const ctx = farmContextService.getContext();
    if (!ctx) return { ok: false, count: 0, message: "Aplicativo não ativado." };

    const access = await activationService.validateCurrentAccess();
    if (!access.ok) return { ok: false, count: 0, message: access.message };

    const supabase = requireSupabase();
    const items = await pendingOutbox(ctx.farm_id);
    this.isSyncing = true;
    let count = 0;

    try {
      for (const item of items) {
        if (item.farm_id !== ctx.farm_id) continue;
        if (!item.payload || typeof item.payload !== "object" || Array.isArray(item.payload)) {
          await localdb.outbox.update(item.id!, {
            status: "error",
            errorMessage: "Payload de sincronização inválido.",
          });
          continue;
        }
        const payload = scopeSyncPayload(
          item.tableName,
          item.payload as Record<string, unknown>,
          ctx,
        );

        let tableName = item.tableName;
        let finalPayload: Record<string, unknown> = payload;
        if (item.tableName === "hoof_media") {
          const mediaPayload = payload as {
            id?: string;
            visit_id?: string;
            mime_type?: string;
            storage_path?: string;
          };
          if (!mediaPayload.storage_path && mediaPayload.id && mediaPayload.visit_id) {
            mediaPayload.storage_path = await uploadPhotoBlob({
              mediaId: mediaPayload.id,
              visitId: mediaPayload.visit_id,
              mimeType: mediaPayload.mime_type,
            });
          }
          finalPayload = {
            id: mediaPayload.id,
            farm_id: ctx.farm_id,
            visit_id: mediaPayload.visit_id,
            foot: (payload as { foot?: string }).foot,
            storage_path: mediaPayload.storage_path,
            mime_type: mediaPayload.mime_type ?? "image/jpeg",
          };
          tableName = "hoof_media";
        }

        const table = supabase.from(tableName);
        const result =
          item.op === "delete"
            ? await table
                .delete()
                .eq("id", (finalPayload as { id?: string }).id)
                .eq("farm_id", ctx.farm_id)
            : await table.upsert(finalPayload, { onConflict: conflictTarget(tableName) });

        if (result.error) {
          await localdb.outbox.update(item.id!, {
            status: "error",
            errorMessage: result.error.message,
          });
          continue;
        }
        if (tableName in localdb && finalPayload && typeof finalPayload === "object") {
          const row = finalPayload as {
            id?: string;
            farm_id?: string;
            updated_at?: string;
            created_at?: string;
          };
          if (row.id && row.farm_id) {
            const table =
              localdb[tableName as keyof Pick<typeof localdb, (typeof SYNC_TABLES)[number]>];
            await table.put({
              id: String(row.id),
              farm_id: row.farm_id,
              data: finalPayload,
              updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
              synced: true,
            });
          }
        }
        await localdb.outbox.update(item.id!, { status: "done", errorMessage: undefined });
        count += 1;
      }

      for (const tableName of SYNC_TABLES) {
        const { data, error } = await supabase
          .from(tableName)
          .select("*")
          .eq("farm_id", ctx.farm_id);
        if (error) throw error;
        const table = localdb[tableName];
        await table.bulkPut(
          (data ?? []).map((row) => ({
            id: String(row.id),
            farm_id: ctx.farm_id,
            data: row,
            updated_at: row.updated_at ?? row.created_at ?? new Date().toISOString(),
            synced: true,
          })),
        );
      }

      await hydrateVisitsFromIndexedDb();
      localStorage.setItem("casco.last_sync_at.v1", new Date().toISOString());
      return { ok: true, count };
    } finally {
      this.isSyncing = false;
    }
  },
};
