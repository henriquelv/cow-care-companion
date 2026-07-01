// Armazenamento local offline-first. Com fazenda ativada, as chaves locais ficam isoladas por farm_id.

import { farmContextService } from "@/services/farm-context.service";
import { enqueueOutboxMany, localdb, putLocalRecord } from "@/services/localdb";
import { mediaIdFromRef, mediaRef } from "@/services/media.service";

export type Sex = "vaca" | "touro";
export type FootKey = "FE" | "FD" | "TE" | "TD";
export type Severity = 0 | 1 | 2 | 3;
export type Zone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type LesionCode =
  | "SH"
  | "SU"
  | "BU"
  | "DD"
  | "HHE"
  | "J"
  | "X"
  | "TS"
  | "P"
  | "WU"
  | "TU"
  | "LB"
  | "HI"
  | "FF"
  | "LM"
  | "SOLE_ABSCESS";

export type TreatmentCode =
  | "TRIM"
  | "ALIVIO"
  | "BLOCO_ON"
  | "BLOCO_OFF"
  | "BLOCO_FIX"
  | "BAND_ON"
  | "BAND_OFF"
  | "SPRAY"
  | "SCORING"
  | "INJ_ATB"
  | "INJ_AINE"
  | "NADA";

export type CommentCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

export interface Funcionario {
  id: string;
  nome: string;
}

export interface DiseaseEntry {
  code: LesionCode;
  severity: Severity;
  zones?: Zone[]; // mantido para compatibilidade com dados existentes
}

export interface FootEntry {
  foot: FootKey;
  ok: boolean;
  zones?: Zone[];
  diseases?: DiseaseEntry[];
  treatments?: TreatmentCode[];
  comments?: CommentCode[];
  nota?: string; // observação livre do funcionário
  recheck?: boolean;
  recheckDate?: string; // ISO yyyy-mm-dd
  intervalo_revisao_dias?: number;
  resolved?: boolean;
  data_liberacao?: string; // ISO yyyy-mm-dd
  numero_revisoes?: number;
  diagnostico_funcionario_id?: string;
  liberacao_funcionario_id?: string;
  photo?: string;
  photoStoragePath?: string;
  photoPendingUpload?: boolean;
}

export interface Visit {
  id: string;
  farm_id?: string;
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
  tag: string;
  sex: Sex;
  lote?: string;
  preventivo?: boolean;
  visitante_nome?: string; // funcionário que realizou a visita
  employee_id?: string;
  employee_name?: string;
  device_id?: string;
  feet: FootEntry[];
}

export interface RegisteredAnimal {
  tag: string;
  lote?: string;
}

export interface FarmConfig {
  farmName: string;
  worker: string;
  configured: boolean;
  funcionarios: Funcionario[];
  lotes: string[];
  dias_para_preventivo: number;
  animais: RegisteredAnimal[]; // animais cadastrados manualmente
}

const VISITS_KEY = "casco.visits.v3";
const FARM_KEY = "casco.farm.v1";
const TUTORIAL_KEY = "casco.tutorial.done.v1";
const AUTO_BACKUP_KEY = "casco.backup.auto.v1";
const AUTO_BACKUP_AT_KEY = "casco.backup.auto.at.v1";

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function scopedKey(key: string) {
  const farmId = typeof window === "undefined" ? null : farmContextService.getFarmId();
  return farmId ? `${key}.${farmId}` : key;
}

function currentVisitMetadata() {
  const ctx = typeof window === "undefined" ? null : farmContextService.getContext();
  return ctx
    ? {
        farm_id: ctx.farm_id,
        employee_id: ctx.employee_id,
        employee_name: ctx.employee_name,
        device_id: ctx.device_id,
      }
    : {};
}

export function toHoofVisitPayload(v: Visit) {
  return {
    id: v.id,
    farm_id: v.farm_id,
    tag: v.tag,
    sex: v.sex,
    lote: v.lote,
    date: v.date,
    created_at: new Date(v.createdAt).toISOString(),
    preventivo: v.preventivo ?? false,
    visitante_nome: v.visitante_nome,
    employee_id: v.employee_id,
    employee_name: v.employee_name,
    device_id: v.device_id,
    status: "active",
    payload: v,
  };
}

export function toHoofFeetPayloads(v: Visit) {
  return v.feet.map((f) => ({
    id: `${v.id}_${f.foot}`,
    farm_id: v.farm_id,
    visit_id: v.id,
    foot: f.foot,
    ok: f.ok,
    zones: f.zones ?? [],
    diseases: f.diseases ?? [],
    treatments: f.treatments ?? [],
    comments: f.comments ?? [],
    nota: f.nota,
    recheck: f.recheck,
    recheck_date: f.recheckDate,
    resolved: f.resolved,
    data_liberacao: f.data_liberacao,
    numero_revisoes: f.numero_revisoes,
    payload: f,
  }));
}

export function toHoofMediaPayloads(v: Visit) {
  return v.feet.flatMap((f) => {
    const mediaId = mediaIdFromRef(f.photo);
    if (!mediaId) return [];
    return [
      {
        id: mediaId,
        farm_id: v.farm_id,
        visit_id: v.id,
        foot: f.foot,
        storage_path: f.photoStoragePath,
        mime_type: "image/jpeg",
        pending_upload: !f.photoStoragePath,
      },
    ];
  });
}

export function createVisitSyncPayloads(v: Visit) {
  return {
    visit: toHoofVisitPayload(v),
    feet: toHoofFeetPayloads(v),
    media: toHoofMediaPayloads(v),
  };
}

export interface CascoBackupPayload {
  version: 1;
  exportedAt: string;
  farm: FarmConfig;
  visits: Visit[];
}

export const FOOT_LABEL: Record<FootKey, string> = {
  FE: "Frente Esq.",
  FD: "Frente Dir.",
  TE: "Trás Esq.",
  TD: "Trás Dir.",
};

export const LESIONS: {
  code: LesionCode;
  name: string;
  full: string;
  emoji: string;
}[] = [
  { code: "SH", name: "Laminite", full: "Hemorragia de Sola / Laminite", emoji: "🟡" },
  { code: "SU", name: "Úlcera Sola", full: "Úlcera de Sola", emoji: "🔴" },
  { code: "BU", name: "Fratura Sola", full: "Fratura de Sola", emoji: "🟠" },
  { code: "SOLE_ABSCESS", name: "Abscesso", full: "Abscesso de Sola", emoji: "🟤" },
  { code: "WU", name: "Úlcera Parede", full: "Úlcera de Parede", emoji: "🧱" },
  { code: "TU", name: "Necrose", full: "Úlcera da Ponta / Necrose", emoji: "⚫" },
  { code: "LB", name: "Linha Branca", full: "Linha Branca", emoji: "⬜" },
  { code: "DD", name: "Derm. Digital", full: "Dermatite Digital", emoji: "🦠" },
  { code: "HHE", name: "Talão c/ Lama", full: "Talão por Lama / Esterco", emoji: "💧" },
  { code: "HI", name: "Hiperplasia", full: "Hiperplasia Interdigital", emoji: "🌿" },
  { code: "FF", name: "Fleimão", full: "Fleimão / Podridão do Pé", emoji: "🦨" },
  { code: "J", name: "Inf. Articular", full: "Infecção Articular", emoji: "🔩" },
  { code: "LM", name: "Les. Membro", full: "Lesão de Membro", emoji: "🦵" },
  { code: "TS", name: "Sola Fina", full: "Sola Fina", emoji: "📏" },
  { code: "P", name: "Perfuração", full: "Perfuração", emoji: "📌" },
  { code: "X", name: "Descarte", full: "Descarte — Retirar do Lote", emoji: "❌" },
];

export const TREATMENTS: { code: TreatmentCode; label: string; emoji: string }[] = [
  { code: "TRIM", label: "Casquear", emoji: "🔪" },
  { code: "ALIVIO", label: "Alívio de Carga", emoji: "⬇️" },
  { code: "BLOCO_ON", label: "Aplicar Bloco", emoji: "🟦" },
  { code: "BLOCO_OFF", label: "Remover Bloco", emoji: "🔲" },
  { code: "BLOCO_FIX", label: "Bloco Mantido", emoji: "✔️" },
  { code: "BAND_ON", label: "Curativo", emoji: "🩹" },
  { code: "BAND_OFF", label: "Tirar Curativo", emoji: "✂️" },
  { code: "SPRAY", label: "Spray / Produto", emoji: "💧" },
  { code: "SCORING", label: "Escore DD (M.)", emoji: "📊" },
  { code: "INJ_ATB", label: "Injetável Antibiótico", emoji: "💉" },
  { code: "INJ_AINE", label: "Injetável Anti-inflamatório", emoji: "🩺" },
  { code: "NADA", label: "Só Limpou", emoji: "✅" },
];

export const COMMENTS: { code: CommentCode; label: string }[] = [
  { code: "D1", label: "Já casqueado por terceiro" },
  { code: "D2", label: "Recomendar remoção da garra" },
  { code: "D3", label: "Preocupação com bem-estar" },
  { code: "D4", label: "Queimaduras químicas" },
  { code: "D5", label: "Ensaio com pó salicílico" },
  { code: "D6", label: "Ensaio com pó de antibiótico" },
];

export const ZONE_LABEL: Record<Zone, string> = {
  0: "Sola Central",
  1: "Ponta do Casco",
  2: "Parede Frontal Esq.",
  3: "Parede Frontal Dir.",
  4: "Sola Posterior Esq.",
  5: "Sola Posterior Dir.",
  6: "Talão Esq.",
  7: "Parede Lateral Esq.",
  8: "Talão Dir.",
  9: "Parede Lateral Dir.",
  10: "Bulbo do Talão Esq.",
  11: "Bulbo do Talão Centro",
  12: "Bulbo do Talão Dir.",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: "Ausente",
  1: "Leve",
  2: "Médio",
  3: "Grave",
};

export const ZONE_SEVERITY_COLOR: Record<Severity, { fill: string; stroke: string; text: string }> =
  {
    0: { fill: "#e5e7eb", stroke: "#9ca3af", text: "#374151" },
    1: { fill: "#fef9c3", stroke: "#ca8a04", text: "#713f12" },
    2: { fill: "#fed7aa", stroke: "#ea580c", text: "#7c2d12" },
    3: { fill: "#fecaca", stroke: "#dc2626", text: "#7f1d1d" },
  };

export const QUICK_RECHECK_OPTIONS = [
  { days: 2, label: "2 dias" },
  { days: 3, label: "3 dias" },
  { days: 5, label: "5 dias" },
  { days: 7, label: "1 semana" },
] as const;

export function normalizeSeverity(value: unknown): Severity {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  if (numeric >= 3) return 3;
  return numeric === 2 ? 2 : 1;
}

export function dateAfterDays(days: number, fromISO = todayISO()) {
  const base = new Date(`${fromISO}T12:00:00`);
  base.setDate(base.getDate() + days);
  const tz = base.getTimezoneOffset() * 60000;
  return new Date(base.getTime() - tz).toISOString().slice(0, 10);
}

type LegacyFootEntry = Partial<FootEntry> & {
  lesion?: string;
  severity?: number;
  zone?: Zone;
  treatment?: TreatmentCode | "BLOCO" | "NADA";
};

type LegacyVisit = Partial<Visit> & {
  feet?: LegacyFootEntry[];
};

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function migrateFootEntry(f: LegacyFootEntry): FootEntry {
  const diseases: DiseaseEntry[] = [];
  if (f.diseases) return f as FootEntry;
  if (f.lesion && f.severity !== undefined && (f.severity as number) > 0) {
    const codeMap: Record<string, LesionCode> = {
      DD: "DD",
      SU: "SU",
      SB: "SH",
      WL: "TS",
      SH: "SH",
      TS: "TS",
      P: "P",
      ID: "DD",
      OUT: "SU",
      BU: "BU",
    };
    const newCode = codeMap[f.lesion] ?? "SU";
    diseases.push({ code: newCode, severity: normalizeSeverity(f.severity) });
  }
  return {
    foot: f.foot as FootKey,
    ok: f.ok ?? true,
    zones: f.zone !== undefined ? [f.zone as Zone] : (f.zones ?? []),
    diseases: (diseases.length ? diseases : (f.diseases ?? [])).map((d) => ({
      ...d,
      severity: normalizeSeverity(d.severity),
    })),
    treatments: (
      f.treatments ?? (f.treatment && f.treatment !== "NADA" ? [f.treatment as TreatmentCode] : [])
    ).map((c: string) => (c === "BLOCO" ? "BLOCO_ON" : c)) as TreatmentCode[],
    recheck: f.recheck,
    recheckDate: f.recheckDate,
    resolved: f.resolved,
    data_liberacao: f.data_liberacao,
    numero_revisoes: f.numero_revisoes,
    photo: f.photo,
  };
}

export function loadVisits(): Visit[] {
  if (!canUseStorage()) return [];
  try {
    const v3Raw = localStorage.getItem(scopedKey(VISITS_KEY));
    if (v3Raw) {
      return (JSON.parse(v3Raw) as LegacyVisit[]).map((v) => ({
        ...v,
        feet: (v.feet || []).map(migrateFootEntry),
      })) as Visit[];
    }

    const legacyKeys = ["casco.visits.v2", "casco.visits.v1"];
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(scopedKey(key));
      if (raw) {
        const legacy = JSON.parse(raw) as LegacyVisit[];
        const migrated: Visit[] = legacy.map((v) => ({
          ...v,
          feet: (v.feet || []).map(migrateFootEntry),
        })) as Visit[];
        saveVisits(migrated);
        return migrated;
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveVisits(v: Visit[]) {
  if (!canUseStorage()) return;
  localStorage.setItem(scopedKey(VISITS_KEY), JSON.stringify(v));
  writeAutoBackup();
}

export async function hydrateVisitsFromIndexedDb() {
  const ctx = farmContextService.getContext();
  if (!ctx) return [];

  const [visitRows, footRows, mediaRows] = await Promise.all([
    localdb.hoof_visits.where("farm_id").equals(ctx.farm_id).toArray(),
    localdb.hoof_feet.where("farm_id").equals(ctx.farm_id).toArray(),
    localdb.hoof_media.where("farm_id").equals(ctx.farm_id).toArray(),
  ]);

  const feetByVisit = new Map<string, FootEntry[]>();
  for (const row of footRows) {
    const data = row.data as {
      visit_id?: string;
      payload?: FootEntry;
      foot?: FootKey;
      ok?: boolean;
      zones?: Zone[];
      diseases?: DiseaseEntry[];
      treatments?: TreatmentCode[];
      comments?: CommentCode[];
      nota?: string;
      recheck?: boolean;
      recheck_date?: string;
      resolved?: boolean;
      data_liberacao?: string;
      numero_revisoes?: number;
    };
    if (!data.visit_id) continue;
    const foot: FootEntry = {
      foot: data.payload?.foot ?? data.foot ?? "FE",
      ok: data.payload?.ok ?? data.ok ?? true,
      zones: data.payload?.zones ?? data.zones ?? [],
      diseases: (data.payload?.diseases ?? data.diseases ?? []).map((d) => ({
        ...d,
        severity: normalizeSeverity(d.severity),
      })),
      treatments: data.payload?.treatments ?? data.treatments ?? [],
      comments: data.payload?.comments ?? data.comments ?? [],
      nota: data.payload?.nota ?? data.nota,
      recheck: data.payload?.recheck ?? data.recheck,
      recheckDate: data.payload?.recheckDate ?? data.recheck_date,
      intervalo_revisao_dias: data.payload?.intervalo_revisao_dias,
      resolved: data.payload?.resolved ?? data.resolved,
      data_liberacao: data.payload?.data_liberacao ?? data.data_liberacao,
      numero_revisoes: data.payload?.numero_revisoes ?? data.numero_revisoes,
      diagnostico_funcionario_id: data.payload?.diagnostico_funcionario_id,
      liberacao_funcionario_id: data.payload?.liberacao_funcionario_id,
      photo: data.payload?.photo,
      photoStoragePath: data.payload?.photoStoragePath,
      photoPendingUpload: data.payload?.photoPendingUpload,
    };
    feetByVisit.set(data.visit_id, [...(feetByVisit.get(data.visit_id) ?? []), foot]);
  }

  for (const row of mediaRows) {
    const media = row.data as {
      id?: string;
      visit_id?: string;
      foot?: FootKey;
      storage_path?: string;
    };
    if (!media.id || !media.visit_id || !media.foot) continue;
    const feet = feetByVisit.get(media.visit_id) ?? [];
    const idx = feet.findIndex((f) => f.foot === media.foot);
    if (idx >= 0) {
      feet[idx] = {
        ...feet[idx],
        photo: mediaRef(media.id),
        photoStoragePath: media.storage_path,
        photoPendingUpload: !media.storage_path,
      };
    }
    feetByVisit.set(media.visit_id, feet);
  }

  const visits = visitRows.map((row) => {
    const data = row.data as {
      payload?: Visit;
      id?: string;
      date?: string;
      created_at?: string;
      tag?: string;
      sex?: Sex;
      lote?: string;
      preventivo?: boolean;
      visitante_nome?: string;
      employee_id?: string;
      employee_name?: string;
      device_id?: string;
    };
    const payload = data.payload;
    const feet = feetByVisit.get(row.id) ?? payload?.feet ?? [];
    return {
      id: payload?.id ?? data.id ?? row.id,
      farm_id: ctx.farm_id,
      date: payload?.date ?? data.date ?? todayISO(),
      createdAt:
        payload?.createdAt ??
        (data.created_at
          ? new Date(data.created_at).getTime()
          : new Date(row.updated_at).getTime()),
      tag: payload?.tag ?? data.tag ?? "",
      sex: payload?.sex ?? data.sex ?? "vaca",
      lote: payload?.lote ?? data.lote,
      preventivo: payload?.preventivo ?? data.preventivo,
      visitante_nome: payload?.visitante_nome ?? data.visitante_nome,
      employee_id: payload?.employee_id ?? data.employee_id,
      employee_name: payload?.employee_name ?? data.employee_name,
      device_id: payload?.device_id ?? data.device_id,
      feet,
    } satisfies Visit;
  });

  visits.sort((a, b) => b.createdAt - a.createdAt);
  saveVisits(visits);
  return visits;
}

export function addVisit(v: Visit) {
  const all = loadVisits();
  v = { ...v, ...currentVisitMetadata() };

  // Auto-incrementa numero_revisoes para casos contínuos
  const prevVisits = all
    .filter((x) => x.tag.toLowerCase() === v.tag.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);

  if (prevVisits.length > 0) {
    const latest = prevVisits[0];
    v = {
      ...v,
      feet: v.feet.map((f) => {
        if (f.ok) return f;
        const prev = latest.feet.find((pf) => pf.foot === f.foot);
        if (!prev || prev.ok || prev.resolved || prev.data_liberacao) {
          return { ...f, numero_revisoes: 1 };
        }
        return { ...f, numero_revisoes: (prev.numero_revisoes ?? 1) + 1 };
      }),
    };
  } else {
    v = {
      ...v,
      feet: v.feet.map((f) => (f.ok ? f : { ...f, numero_revisoes: 1 })),
    };
  }

  all.unshift(v);
  saveVisits(all);
  const syncPayloads = createVisitSyncPayloads(v);
  const updatedAt = new Date().toISOString();
  if (v.farm_id) {
    void putLocalRecord("hoof_visits", {
      id: v.id,
      farm_id: v.farm_id,
      data: syncPayloads.visit,
      updated_at: updatedAt,
      synced: false,
    });
    void Promise.all([
      ...syncPayloads.feet.map((payload) =>
        putLocalRecord("hoof_feet", {
          id: payload.id,
          farm_id: v.farm_id!,
          data: payload,
          updated_at: updatedAt,
          synced: false,
        }),
      ),
      ...syncPayloads.media.map((payload) =>
        putLocalRecord("hoof_media", {
          id: payload.id,
          farm_id: v.farm_id!,
          data: payload,
          updated_at: updatedAt,
          synced: false,
        }),
      ),
    ]);
  }
  void enqueueOutboxMany([
    { tableName: "hoof_visits", op: "upsert", payload: syncPayloads.visit },
    ...syncPayloads.feet.map((payload) => ({
      tableName: "hoof_feet",
      op: "upsert" as const,
      payload,
    })),
    ...syncPayloads.media.map((payload) => ({
      tableName: "hoof_media",
      op: "upsert" as const,
      payload,
    })),
  ]);
}

export function createPreventiveVisit(input: {
  tag: string;
  sex?: Sex;
  lote?: string;
  visitante_nome?: string;
}): Visit {
  return {
    id: uid(),
    date: todayISO(),
    createdAt: Date.now(),
    tag: input.tag,
    sex: input.sex ?? "vaca",
    lote: input.lote,
    preventivo: true,
    visitante_nome: input.visitante_nome,
    feet: (["FE", "FD", "TE", "TD"] as FootKey[]).map((foot) => ({
      foot,
      ok: true,
      zones: [],
      diseases: [],
      treatments: [],
    })),
  };
}

function readStoredFarm(): FarmConfig {
  if (!canUseStorage()) return FARM_DEFAULT;
  try {
    const stored = JSON.parse(localStorage.getItem(scopedKey(FARM_KEY)) || "null");
    if (!stored) return FARM_DEFAULT;
    return normalizeFarm(stored);
  } catch {
    return FARM_DEFAULT;
  }
}

function normalizeFarm(stored: Partial<FarmConfig>): FarmConfig {
  return {
    farmName: stored.farmName ?? "",
    worker: stored.worker ?? "",
    configured: stored.configured ?? false,
    funcionarios: stored.funcionarios ?? [],
    lotes: stored.lotes ?? [],
    dias_para_preventivo: stored.dias_para_preventivo ?? 180,
    animais: stored.animais ?? [],
  };
}

export function createBackupPayload(): CascoBackupPayload {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    farm: loadFarm(),
    visits: loadVisits(),
  };
}

export function exportBackupJson(): string {
  return JSON.stringify(createBackupPayload(), null, 2);
}

export function importBackupJson(raw: string): CascoBackupPayload {
  if (!canUseStorage()) throw new Error("Backup disponível apenas no navegador.");
  const parsed = JSON.parse(raw) as Partial<CascoBackupPayload>;
  if (parsed.version !== 1 || !parsed.farm || !Array.isArray(parsed.visits)) {
    throw new Error("Arquivo de backup inválido.");
  }

  const farm = normalizeFarm(parsed.farm);
  const visits = parsed.visits.map((v) => ({
    ...v,
    feet: (v.feet || []).map(migrateFootEntry),
  })) as Visit[];

  localStorage.setItem(scopedKey(FARM_KEY), JSON.stringify(farm));
  localStorage.setItem(scopedKey(VISITS_KEY), JSON.stringify(visits));
  writeAutoBackup();
  return { version: 1, exportedAt: parsed.exportedAt ?? new Date().toISOString(), farm, visits };
}

function writeAutoBackup() {
  if (!canUseStorage()) return;
  try {
    const farmRaw = localStorage.getItem(scopedKey(FARM_KEY));
    const visitsRaw = localStorage.getItem(scopedKey(VISITS_KEY));
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      farm: farmRaw ? JSON.parse(farmRaw) : FARM_DEFAULT,
      visits: visitsRaw ? JSON.parse(visitsRaw) : [],
    };
    localStorage.setItem(scopedKey(AUTO_BACKUP_KEY), JSON.stringify(payload));
    localStorage.setItem(scopedKey(AUTO_BACKUP_AT_KEY), payload.exportedAt);
  } catch {
    // Backup automático é uma proteção extra; falha aqui não deve impedir o registro no campo.
  }
}

export function loadLastBackupAt(): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(scopedKey(AUTO_BACKUP_AT_KEY));
}

export function visitsForDay(date: string): Visit[] {
  return loadVisits().filter((v) => v.date === date);
}

export function visitsByTag(tag: string): Visit[] {
  return loadVisits()
    .filter((v) => v.tag.toLowerCase() === tag.toLowerCase())
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function allAnimals(): {
  tag: string;
  sex: Sex;
  lote?: string;
  lastVisit: number;
  totalVisits: number;
  hasRecheck: boolean;
  hasResolved: boolean;
  worstSeverity: Severity;
}[] {
  const visits = loadVisits();
  const farm = loadFarm();
  const map = new Map<string, ReturnType<typeof allAnimals>[number]>();

  // Animals from registered list (no visit yet appear with lastVisit=0)
  for (const a of farm.animais) {
    const key = a.tag.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        tag: a.tag,
        sex: "vaca",
        lote: a.lote,
        lastVisit: 0,
        totalVisits: 0,
        hasRecheck: false,
        hasResolved: false,
        worstSeverity: 0,
      });
    }
  }

  for (const v of visits) {
    const key = v.tag.toLowerCase();
    const hasRecheck = v.feet.some((f) => f.recheck && !f.resolved && !f.data_liberacao);
    const hasResolved = v.feet.some((f) => f.resolved || !!f.data_liberacao);
    const ws = footsWorstSeverity(v.feet);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        tag: v.tag,
        sex: v.sex,
        lote: v.lote,
        lastVisit: v.createdAt,
        totalVisits: 1,
        hasRecheck,
        hasResolved,
        worstSeverity: ws,
      });
    } else {
      existing.totalVisits++;
      if (v.createdAt > existing.lastVisit) {
        existing.lastVisit = v.createdAt;
        existing.worstSeverity = ws;
        if (v.lote) existing.lote = v.lote;
      }
      if (hasRecheck) existing.hasRecheck = true;
      if (hasResolved) existing.hasResolved = true;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastVisit - a.lastVisit);
}

// Lista preventiva: animais sem problema cujo último casqueamento preventivo
// foi há >= diasThreshold dias (ou nunca tiveram)
export type PreventiveAnimal = {
  tag: string;
  sex: Sex;
  lote?: string;
  diasSemCasqueamento: number; // -1 = nunca feito
  lastPreventivoDate?: string;
  hasProblemaHistorico: boolean;
};

export function preventiveList(diasThreshold: number): PreventiveAnimal[] {
  const visits = loadVisits().sort((a, b) => b.createdAt - a.createdAt);
  const farm = loadFarm();
  const now = Date.now();
  const seen = new Set<string>();

  const animals = new Map<
    string,
    {
      tag: string;
      sex: Sex;
      lote?: string;
      hasActiveProblem: boolean;
      lastPreventivo?: number;
      hasProblemaHistorico: boolean;
    }
  >();

  // Seed from registered animals (never visited = no problem, no history)
  for (const a of farm.animais) {
    const key = a.tag.toLowerCase();
    animals.set(key, {
      tag: a.tag,
      sex: "vaca",
      lote: a.lote,
      hasActiveProblem: false,
      hasProblemaHistorico: false,
    });
  }

  for (const v of visits) {
    const key = v.tag.toLowerCase();
    const hasActiveProblem = v.feet.some((f) => !f.ok && !f.resolved && !f.data_liberacao);
    const isPreventivo = v.preventivo === true;
    const hasProblema = v.feet.some((f) => !f.ok);

    if (!seen.has(key)) {
      seen.add(key);
      animals.set(key, {
        tag: v.tag,
        sex: v.sex,
        lote: v.lote,
        hasActiveProblem,
        lastPreventivo: isPreventivo ? v.createdAt : undefined,
        hasProblemaHistorico: hasProblema,
      });
    } else {
      const a = animals.get(key)!;
      if (isPreventivo && a.lastPreventivo === undefined) {
        a.lastPreventivo = v.createdAt;
      }
      if (hasProblema) a.hasProblemaHistorico = true;
    }
  }

  const result: PreventiveAnimal[] = [];
  for (const a of animals.values()) {
    if (a.hasActiveProblem) continue;

    const dias = a.lastPreventivo ? Math.floor((now - a.lastPreventivo) / 86400000) : -1;

    if (dias < 0 || dias >= diasThreshold) {
      result.push({
        tag: a.tag,
        sex: a.sex,
        lote: a.lote,
        diasSemCasqueamento: dias,
        lastPreventivoDate: a.lastPreventivo
          ? new Date(a.lastPreventivo - new Date().getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 10)
          : undefined,
        hasProblemaHistorico: a.hasProblemaHistorico,
      });
    }
  }

  return result.sort((a, b) => {
    if (a.diasSemCasqueamento < 0 && b.diasSemCasqueamento >= 0) return -1;
    if (b.diasSemCasqueamento < 0 && a.diasSemCasqueamento >= 0) return 1;
    return b.diasSemCasqueamento - a.diasSemCasqueamento;
  });
}

const FARM_DEFAULT: FarmConfig = {
  farmName: "",
  worker: "",
  configured: false,
  funcionarios: [],
  lotes: [],
  dias_para_preventivo: 180,
  animais: [],
};

export function loadFarm(): FarmConfig {
  if (!canUseStorage()) return FARM_DEFAULT;
  return readStoredFarm();
}

export function deleteAnimal(tag: string) {
  const farm = loadFarm();
  farm.animais = farm.animais.filter((a) => a.tag.toLowerCase() !== tag.toLowerCase());
  saveFarm(farm);
  saveVisits(loadVisits().filter((v) => v.tag.toLowerCase() !== tag.toLowerCase()));
}

export function saveFarm(f: FarmConfig) {
  if (!canUseStorage()) return;
  localStorage.setItem(scopedKey(FARM_KEY), JSON.stringify(f));
  const ctx = farmContextService.getContext();
  if (ctx) {
    void putLocalRecord("farm_settings", {
      id: ctx.farm_id,
      farm_id: ctx.farm_id,
      data: f,
      updated_at: new Date().toISOString(),
      synced: false,
    });
    for (const lote of f.lotes) {
      void putLocalRecord("farm_lotes", {
        id: `${ctx.farm_id}_${lote}`,
        farm_id: ctx.farm_id,
        data: { id: `${ctx.farm_id}_${lote}`, farm_id: ctx.farm_id, name: lote, status: "active" },
        updated_at: new Date().toISOString(),
        synced: false,
      });
    }
    for (const animal of f.animais) {
      void putLocalRecord("animals", {
        id: `${ctx.farm_id}_${animal.tag}`,
        farm_id: ctx.farm_id,
        data: {
          id: `${ctx.farm_id}_${animal.tag}`,
          farm_id: ctx.farm_id,
          tag: animal.tag,
          sex: "vaca",
          lote: animal.lote,
          status: "active",
        },
        updated_at: new Date().toISOString(),
        synced: false,
      });
    }
    void enqueueOutboxMany([
      {
        tableName: "farm_settings",
        op: "upsert",
        payload: {
          id: ctx.farm_id,
          farm_id: ctx.farm_id,
          dias_para_preventivo: f.dias_para_preventivo,
          payload: f,
        },
      },
      ...f.lotes.map((lote) => ({
        tableName: "farm_lotes",
        op: "upsert" as const,
        payload: {
          id: `${ctx.farm_id}_${lote}`,
          farm_id: ctx.farm_id,
          name: lote,
          status: "active",
        },
      })),
      ...f.animais.map((animal) => ({
        tableName: "animals",
        op: "upsert" as const,
        payload: {
          id: `${ctx.farm_id}_${animal.tag}`,
          farm_id: ctx.farm_id,
          tag: animal.tag,
          sex: "vaca",
          lote: animal.lote,
          status: "active",
        },
      })),
    ]);
  }
  writeAutoBackup();
}

export function isTutorialDone(): boolean {
  if (!canUseStorage()) return true;
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function markTutorialDone() {
  if (!canUseStorage()) return;
  localStorage.setItem(TUTORIAL_KEY, "1");
}

// footWorstSeverity ignora pés resolvidos/liberados
export function footWorstSeverity(foot: FootEntry): Severity {
  if (foot.ok || foot.resolved || foot.data_liberacao) return 0;
  if (!foot.diseases?.length) return 0;
  return normalizeSeverity(Math.max(0, ...foot.diseases.map((d) => normalizeSeverity(d.severity))));
}

export function footsWorstSeverity(feet: FootEntry[]): Severity {
  return normalizeSeverity(feet.reduce<number>((acc, f) => Math.max(acc, footWorstSeverity(f)), 0));
}

export function severityLabel(s?: Severity) {
  if (s === undefined) return "—";
  return SEVERITY_LABEL[s];
}

export function severityBucket(s?: Severity): "leve" | "medio" | "grave" | null {
  if (!s) return null;
  if (s <= 1) return "leve";
  if (s === 2) return "medio";
  return "grave";
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function rechecksByDate(): Map<string, { tag: string; sex: Sex; feet: FootKey[] }[]> {
  const visits = loadVisits().sort((a, b) => b.createdAt - a.createdAt);
  const map = new Map<string, { tag: string; sex: Sex; feet: FootKey[] }[]>();
  const seen = new Set<string>();
  for (const v of visits) {
    const key = v.tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const recheckFeet: FootKey[] = [];
    let recheckDate = "";
    for (const f of v.feet) {
      if (f.recheck && !f.resolved && !f.data_liberacao && f.recheckDate) {
        recheckFeet.push(f.foot);
        if (!recheckDate) recheckDate = f.recheckDate;
      }
    }
    if (recheckFeet.length > 0 && recheckDate) {
      const existing = map.get(recheckDate) ?? [];
      existing.push({ tag: v.tag, sex: v.sex, feet: recheckFeet });
      map.set(recheckDate, existing);
    }
  }
  return map;
}

export function seedMockData(replace = false) {
  if (!canUseStorage()) return;
  const existing = loadVisits();
  if (existing.length > 0 && !replace) return;

  const base = Date.now();
  const day = 86400000;

  function mkDate(daysAgo: number): string {
    const d = new Date(base - daysAgo * day);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function mkTs(daysAgo: number, offsetMs = 0): number {
    return base - daysAgo * day + offsetMs;
  }

  function f(key: FootKey, overrides: Partial<FootEntry> = {}): FootEntry {
    return { foot: key, ok: true, zones: [], diseases: [], treatments: [], ...overrides };
  }

  const lotes = ["A1", "B2", "C3"];

  const visits: Visit[] = [
    {
      id: uid(),
      date: mkDate(45),
      createdAt: mkTs(45),
      tag: "1284",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "DD", severity: 3, zones: [6, 10] }],
          treatments: ["SPRAY"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE", {
          ok: false,
          diseases: [{ code: "SH", severity: 2, zones: [0] }],
          treatments: ["TRIM"],
          numero_revisoes: 1,
        }),
        f("TD"),
      ],
    },
    {
      id: uid(),
      date: mkDate(14),
      createdAt: mkTs(14),
      tag: "1284",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "DD", severity: 2, zones: [6] }],
          treatments: ["SPRAY", "BAND_ON"],
          recheck: true,
          recheckDate: mkDate(-7),
          numero_revisoes: 2,
        }),
        f("FD"),
        f("TE", {
          ok: false,
          diseases: [{ code: "SH", severity: 1, zones: [0, 4] }],
          treatments: ["TRIM"],
          numero_revisoes: 2,
        }),
        f("TD"),
      ],
    },
    {
      id: uid(),
      date: mkDate(0),
      createdAt: mkTs(0, -3600000),
      tag: "1284",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "DD", severity: 1, zones: [6] }],
          treatments: ["SPRAY"],
          numero_revisoes: 3,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(30),
      createdAt: mkTs(30),
      tag: "502",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE"),
        f("FD", {
          ok: false,
          diseases: [{ code: "SU", severity: 3, zones: [5] }],
          treatments: ["TRIM", "BLOCO_ON", "BAND_ON", "INJ_ATB"],
          numero_revisoes: 1,
        }),
        f("TE"),
        f("TD", {
          ok: false,
          diseases: [{ code: "SU", severity: 3, zones: [5] }],
          treatments: ["TRIM", "BLOCO_ON"],
          numero_revisoes: 1,
        }),
      ],
    },
    {
      id: uid(),
      date: mkDate(7),
      createdAt: mkTs(7),
      tag: "502",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE"),
        f("FD", {
          ok: false,
          diseases: [{ code: "SU", severity: 1, zones: [5] }],
          treatments: ["BLOCO_OFF", "SPRAY"],
          resolved: true,
          data_liberacao: mkDate(7),
          numero_revisoes: 2,
        }),
        f("TE"),
        f("TD", {
          ok: false,
          diseases: [{ code: "SU", severity: 1, zones: [5] }],
          treatments: ["SPRAY"],
          resolved: true,
          data_liberacao: mkDate(7),
          numero_revisoes: 2,
        }),
      ],
    },

    {
      id: uid(),
      date: mkDate(5),
      createdAt: mkTs(5),
      tag: "3871",
      sex: "touro",
      lote: "C3",
      feet: [
        f("FE", {
          ok: false,
          diseases: [
            { code: "DD", severity: 2, zones: [6, 10] },
            { code: "HHE", severity: 2, zones: [10, 11] },
          ],
          treatments: ["SPRAY", "SCORING"],
          numero_revisoes: 1,
        }),
        f("FD", {
          ok: false,
          diseases: [
            { code: "DD", severity: 3, zones: [8, 12] },
            { code: "HHE", severity: 3, zones: [11, 12] },
          ],
          treatments: ["SPRAY", "SCORING", "INJ_AINE"],
          numero_revisoes: 1,
        }),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(20),
      createdAt: mkTs(20),
      tag: "94",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "LB", severity: 2, zones: [2, 3] }],
          treatments: ["TRIM"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(3),
      createdAt: mkTs(3),
      tag: "2210",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE"),
        f("FD"),
        f("TE", {
          ok: false,
          diseases: [{ code: "FF", severity: 3, zones: [0, 6, 7] }],
          treatments: ["TRIM", "BAND_ON", "INJ_ATB"],
          recheck: true,
          recheckDate: mkDate(-2),
          numero_revisoes: 1,
        }),
        f("TD", {
          ok: false,
          diseases: [{ code: "DD", severity: 2, zones: [8] }],
          treatments: ["SPRAY"],
          numero_revisoes: 1,
        }),
      ],
    },

    {
      id: uid(),
      date: mkDate(10),
      createdAt: mkTs(10),
      tag: "765",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "TS", severity: 1, zones: [0] }],
          treatments: ["ALIVIO", "BLOCO_ON"],
          numero_revisoes: 1,
        }),
        f("FD", {
          ok: false,
          diseases: [{ code: "TS", severity: 1, zones: [0] }],
          treatments: ["ALIVIO", "BLOCO_ON"],
          numero_revisoes: 1,
        }),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(12),
      createdAt: mkTs(12),
      tag: "1033",
      sex: "vaca",
      lote: "C3",
      feet: [
        f("FE"),
        f("FD"),
        f("TE", {
          ok: false,
          diseases: [{ code: "HI", severity: 3, zones: [0] }],
          treatments: ["TRIM", "BAND_ON"],
          recheck: true,
          recheckDate: mkDate(-5),
          numero_revisoes: 1,
        }),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(8),
      createdAt: mkTs(8),
      tag: "487",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "WU", severity: 2, zones: [7] }],
          treatments: ["TRIM", "SPRAY"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE", {
          ok: false,
          diseases: [{ code: "WU", severity: 2, zones: [9] }],
          treatments: ["TRIM", "SPRAY"],
          numero_revisoes: 1,
        }),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(1),
      createdAt: mkTs(1),
      tag: "3001",
      sex: "vaca",
      lote: "C3",
      feet: [
        f("FE", {
          ok: false,
          diseases: [
            { code: "X", severity: 3, zones: [0, 1, 2, 3] },
            { code: "J", severity: 3, zones: [1] },
          ],
          treatments: ["NADA"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(2),
      createdAt: mkTs(2),
      tag: "88",
      sex: "vaca",
      lote: "A1",
      feet: [f("FE"), f("FD"), f("TE"), f("TD")],
    },

    {
      id: uid(),
      date: mkDate(6),
      createdAt: mkTs(6),
      tag: "2756",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE"),
        f("FD", {
          ok: false,
          diseases: [{ code: "TU", severity: 3, zones: [1] }],
          treatments: ["TRIM", "BAND_ON"],
          recheck: true,
          recheckDate: mkDate(-3),
          numero_revisoes: 1,
        }),
        f("TE"),
        f("TD", {
          ok: false,
          diseases: [{ code: "TU", severity: 2, zones: [1] }],
          treatments: ["TRIM"],
          numero_revisoes: 1,
        }),
      ],
    },

    {
      id: uid(),
      date: mkDate(15),
      createdAt: mkTs(15),
      tag: "391",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "P", severity: 3, zones: [0] }],
          treatments: ["TRIM", "BAND_ON", "BLOCO_ON"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(4),
      createdAt: mkTs(4),
      tag: "1100",
      sex: "vaca",
      lote: "C3",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "SH", severity: 2, zones: [0, 4] }],
          treatments: ["ALIVIO", "INJ_AINE"],
          recheck: true,
          recheckDate: mkDate(2),
          numero_revisoes: 1,
        }),
        f("FD", {
          ok: false,
          diseases: [{ code: "SH", severity: 2, zones: [0, 5] }],
          treatments: ["ALIVIO"],
          numero_revisoes: 1,
        }),
        f("TE", {
          ok: false,
          diseases: [{ code: "SH", severity: 1, zones: [0] }],
          treatments: ["ALIVIO"],
          numero_revisoes: 1,
        }),
        f("TD", {
          ok: false,
          diseases: [{ code: "SH", severity: 1, zones: [0] }],
          treatments: ["ALIVIO"],
          numero_revisoes: 1,
        }),
      ],
    },

    {
      id: uid(),
      date: mkDate(9),
      createdAt: mkTs(9),
      tag: "654",
      sex: "vaca",
      lote: "B2",
      feet: [
        f("FE"),
        f("FD", {
          ok: false,
          diseases: [{ code: "BU", severity: 2, zones: [5] }],
          treatments: ["TRIM", "BLOCO_ON"],
          numero_revisoes: 1,
        }),
        f("TE"),
        f("TD"),
      ],
    },

    {
      id: uid(),
      date: mkDate(11),
      createdAt: mkTs(11),
      tag: "2009",
      sex: "vaca",
      lote: "A1",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "LM", severity: 2, zones: [7] }],
          treatments: ["SPRAY"],
          comments: ["D3"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    // Acesso de sola (nova doença)
    {
      id: uid(),
      date: mkDate(13),
      createdAt: mkTs(13),
      tag: "5500",
      sex: "vaca",
      lote: "C3",
      feet: [
        f("FE", {
          ok: false,
          diseases: [{ code: "SOLE_ABSCESS", severity: 3, zones: [0, 4] }],
          treatments: ["TRIM", "BAND_ON", "INJ_ATB"],
          numero_revisoes: 1,
        }),
        f("FD"),
        f("TE"),
        f("TD"),
      ],
    },

    // Visitas preventivas (sem problema)
    {
      id: uid(),
      date: mkDate(60),
      createdAt: mkTs(60),
      tag: "88",
      sex: "vaca",
      lote: "A1",
      preventivo: true,
      feet: [f("FE"), f("FD"), f("TE"), f("TD")],
    },
    {
      id: uid(),
      date: mkDate(90),
      createdAt: mkTs(90),
      tag: "502",
      sex: "vaca",
      lote: "B2",
      preventivo: true,
      feet: [f("FE"), f("FD"), f("TE"), f("TD")],
    },
  ];

  // Seed farm config com funcionários e lotes de exemplo
  const farmStored = localStorage.getItem(scopedKey(FARM_KEY));
  if (!farmStored) {
    saveFarm({
      farmName: "Fazenda Demo",
      worker: "João",
      configured: true,
      funcionarios: [
        { id: uid(), nome: "João Silva" },
        { id: uid(), nome: "Maria Souza" },
        { id: uid(), nome: "Pedro Lima" },
      ],
      lotes: lotes,
      dias_para_preventivo: 180,
      animais: [],
    });
  }

  saveVisits(replace ? visits : [...visits, ...existing]);
}
