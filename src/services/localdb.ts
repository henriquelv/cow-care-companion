import Dexie, { type Table } from "dexie";

export interface LocalRecord<T = unknown> {
  id: string;
  farm_id: string;
  data: T;
  updated_at: string;
  synced: boolean;
}

export interface OutboxItem {
  id?: number;
  farm_id: string;
  tableName: string;
  op: "insert" | "update" | "upsert" | "delete";
  payload: unknown;
  created_at: string;
  status: "pending" | "done" | "error";
  errorMessage?: string;
}

export interface MediaBlobRecord {
  id: string;
  farm_id: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

class CascoLocalDatabase extends Dexie {
  farm_context!: Table<LocalRecord>;
  hoof_visits!: Table<LocalRecord>;
  hoof_feet!: Table<LocalRecord>;
  hoof_media!: Table<LocalRecord>;
  hoof_corrections!: Table<LocalRecord>;
  animals!: Table<LocalRecord>;
  farm_lotes!: Table<LocalRecord>;
  farm_settings!: Table<LocalRecord>;
  employees!: Table<LocalRecord>;
  devices!: Table<LocalRecord>;
  licenses!: Table<LocalRecord>;
  hoof_media_blobs!: Table<MediaBlobRecord>;
  outbox!: Table<OutboxItem>;

  constructor() {
    super("CascoDB_Web_v1");
    this.version(1).stores({
      farm_context: "id, farm_id, synced, updated_at",
      hoof_visits: "id, farm_id, synced, updated_at",
      hoof_feet: "id, farm_id, synced, updated_at",
      hoof_media: "id, farm_id, synced, updated_at",
      animals: "id, farm_id, synced, updated_at",
      farm_lotes: "id, farm_id, synced, updated_at",
      farm_settings: "id, farm_id, synced, updated_at",
      employees: "id, farm_id, synced, updated_at",
      devices: "id, farm_id, synced, updated_at",
      licenses: "id, farm_id, synced, updated_at",
      hoof_media_blobs: "id, farm_id, createdAt",
      outbox: "++id, status, created_at",
    });
    this.version(2).stores({
      hoof_media: "id, farm_id, synced, updated_at",
    });
    this.version(3)
      .stores({
        outbox: "++id, farm_id, [farm_id+status], status, created_at",
      })
      .upgrade((transaction) =>
        transaction
          .table<OutboxItem>("outbox")
          .toCollection()
          .modify((item) => {
            const payload = item.payload as { farm_id?: string } | null;
            item.farm_id = payload?.farm_id ?? "legacy-unscoped";
          }),
      );
    this.version(4).stores({
      hoof_corrections: "id, farm_id, synced, updated_at",
    });
  }
}

export const localdb = new CascoLocalDatabase();

export async function putLocalRecord<T>(
  tableName: keyof Pick<
    CascoLocalDatabase,
    | "farm_context"
    | "hoof_visits"
    | "hoof_feet"
    | "hoof_media"
    | "hoof_corrections"
    | "animals"
    | "farm_lotes"
    | "farm_settings"
    | "employees"
    | "devices"
    | "licenses"
  >,
  record: LocalRecord<T>,
) {
  return localdb[tableName].put(record);
}

export async function enqueueOutboxMany(items: Omit<OutboxItem, "created_at" | "status">[]) {
  const createdAt = new Date().toISOString();
  return localdb.outbox.bulkAdd(
    items.map((item) => ({
      ...item,
      created_at: createdAt,
      status: "pending" as const,
    })),
  );
}

export async function pendingOutbox(farmId: string, limit = 100) {
  return localdb.outbox
    .where("[farm_id+status]")
    .equals([farmId, "pending"])
    .sortBy("created_at")
    .then((rows) => rows.slice(0, limit));
}
