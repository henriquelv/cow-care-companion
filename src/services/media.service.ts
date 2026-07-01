import { isSupabaseConfigured, requireSupabase } from "./supabase";
import { farmContextService } from "./farm-context.service";
import { localdb } from "./localdb";

const LOCAL_FARM_ID = "local";

export function mediaRef(id: string) {
  return `media:${id}`;
}

export function mediaIdFromRef(ref?: string) {
  if (!ref?.startsWith("media:")) return null;
  return ref.slice("media:".length);
}

export async function savePhotoBlob(id: string, dataUrl: string, mimeType = "image/jpeg") {
  const ctx = farmContextService.getContext();
  const blob = await (await fetch(dataUrl)).blob();
  await localdb.hoof_media_blobs.put({
    id,
    farm_id: ctx?.farm_id ?? LOCAL_FARM_ID,
    blob,
    mimeType,
    createdAt: new Date().toISOString(),
  });
}

export async function getLocalPhotoObjectUrl(ref?: string) {
  const id = mediaIdFromRef(ref);
  if (!id) return ref || "";
  const row = await localdb.hoof_media_blobs.get(id);
  return row ? URL.createObjectURL(row.blob) : "";
}

export async function getPhotoDisplayUrl(ref?: string) {
  if (!ref) return "";
  const localUrl = await getLocalPhotoObjectUrl(ref);
  if (localUrl) return localUrl;

  const id = mediaIdFromRef(ref);
  if (!id || !isSupabaseConfigured) return "";
  const row = await localdb.hoof_media.get(id);
  const storagePath = (row?.data as { storage_path?: string } | undefined)?.storage_path;
  return getSignedPhotoUrl(storagePath);
}

export async function getSignedPhotoUrl(storagePath?: string) {
  if (!storagePath) return "";
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage.from("media").createSignedUrl(storagePath, 3600);
  if (error) return "";
  return data.signedUrl;
}

export async function uploadPhotoBlob(input: {
  mediaId: string;
  visitId: string;
  mimeType?: string;
}) {
  const ctx = farmContextService.getContext();
  if (!ctx) throw new Error("Aplicativo não ativado.");
  const supabase = requireSupabase();
  const stored = await localdb.hoof_media_blobs.get(input.mediaId);
  if (!stored) throw new Error("Foto local não encontrada para sincronizar.");
  const mimeType = input.mimeType ?? stored.mimeType ?? "image/jpeg";
  const path = `farms/${ctx.farm_id}/hoof/${input.visitId}/${input.mediaId}.jpg`;
  const { error } = await supabase.storage.from("media").upload(path, stored.blob, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) throw error;
  return path;
}
