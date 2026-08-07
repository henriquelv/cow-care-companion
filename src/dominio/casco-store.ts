// Armazenamento local offline-first. Com fazenda ativada, as chaves locais ficam isoladas por farm_id.

import { farmContextService } from "@/servicos/farm-context.service";
import { enqueueOutboxMany, localdb, putLocalRecord } from "@/servicos/localdb";
import { mediaIdFromRef, mediaRef } from "@/servicos/media.service";

export type Sex = "vaca" | "touro";
export type FootKey = "FE" | "FD" | "TE" | "TD";
export type Severity = 0 | 1 | 2 | 3;
export type Zone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type LesionCode = string;

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

export type TacoAction = "apply" | "remove" | "maintain";
export type TacoSide = "left" | "right";

export interface TacoEntry {
  action: TacoAction;
  side?: TacoSide;
}

export type CommentCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

export interface DiseaseEntry {
  code: LesionCode;
  severity: Severity;
  zones?: Zone[]; // mantido para compatibilidade com dados existentes
}

export interface DiseaseDefinition {
  code: LesionCode;
  name: string;
  full: string;
  emoji: string;
  recheckDays: number;
  active: boolean;
}

export interface FootEntry {
  foot: FootKey;
  ok: boolean;
  zones?: Zone[];
  diseases?: DiseaseEntry[];
  treatments?: TreatmentCode[];
  taco?: TacoEntry;
  comments?: CommentCode[];
  nota?: string; // observação livre do funcionário
  recheck?: boolean;
  recheckDate?: string; // ISO yyyy-mm-dd
  intervalo_revisao_dias?: number;
  revisoes_necessarias?: number;
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
  status?: "draft" | "active" | "corrected" | "cancelled";
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
  completedAt?: number; // definido somente quando o usuário confirma o salvamento
  tag: string;
  sex: Sex;
  lote?: string;
  preventivo?: boolean;
  visitante_nome?: string; // funcionário que realizou a visita
  employee_id?: string;
  employee_name?: string;
  device_id?: string;
  correction_of_id?: string;
  correction_reason?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_scope?: "visit" | "animal";
  feet: FootEntry[];
}

export interface RegisteredAnimal {
  tag: string;
  sex?: Sex;
  lote?: string;
}

export interface FarmConfig {
  farmName: string;
  worker: string;
  configured: boolean;
  lotes: string[];
  dias_para_preventivo: number;
  animais: RegisteredAnimal[]; // animais cadastrados manualmente
  diseases: DiseaseDefinition[];
}

const VISITS_KEY = "casco.visits.v3";
const FARM_KEY = "casco.farm.v1";
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
    status: v.status ?? "active",
    payload: v,
  };
}

export function visitIsVisible(visit: Pick<Visit, "status">) {
  return visit.status === undefined || visit.status === "active";
}

export function visitIsFinalized(
  visit: Pick<Visit, "id" | "tag" | "date" | "createdAt" | "feet" | "status">,
) {
  return (
    visitIsVisible(visit) &&
    Boolean(visit.id?.trim()) &&
    Boolean(visit.tag?.trim()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(visit.date) &&
    Number.isFinite(visit.createdAt) &&
    visit.createdAt > 0 &&
    Array.isArray(visit.feet) &&
    visit.feet.length > 0
  );
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
    taco_action: f.taco?.action,
    taco_side: f.taco?.side,
    comments: f.comments ?? [],
    nota: f.nota,
    recheck: f.recheck,
    recheck_date: f.recheckDate,
    intervalo_revisao_dias: f.intervalo_revisao_dias,
    revisoes_necessarias: f.revisoes_necessarias,
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
    correction:
      v.correction_of_id && v.correction_reason
        ? {
            id: `correction_${v.id}`,
            farm_id: v.farm_id,
            original_visit_id: v.correction_of_id,
            correction_visit_id: v.id,
            reason: v.correction_reason,
            employee_id: v.employee_id,
            device_id: v.device_id,
            created_at: new Date(v.createdAt).toISOString(),
          }
        : null,
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

export const LESIONS: DiseaseDefinition[] = [
  {
    code: "SH",
    name: "Laminite",
    full: "Hemorragia de Sola / Laminite",
    emoji: "🟡",
    recheckDays: 30,
    active: true,
  },
  {
    code: "SU",
    name: "Úlcera Sola",
    full: "Úlcera de Sola",
    emoji: "🔴",
    recheckDays: 21,
    active: true,
  },
  {
    code: "BU",
    name: "Fratura Sola",
    full: "Fratura de Sola",
    emoji: "🟠",
    recheckDays: 30,
    active: true,
  },
  {
    code: "SOLE_ABSCESS",
    name: "Abscesso",
    full: "Abscesso de Sola",
    emoji: "🟤",
    recheckDays: 30,
    active: true,
  },
  {
    code: "WU",
    name: "Úlcera Parede",
    full: "Úlcera de Parede",
    emoji: "🧱",
    recheckDays: 30,
    active: true,
  },
  {
    code: "TU",
    name: "Necrose",
    full: "Úlcera da Ponta / Necrose",
    emoji: "⚫",
    recheckDays: 30,
    active: true,
  },
  {
    code: "LB",
    name: "Linha Branca",
    full: "Linha Branca",
    emoji: "⬜",
    recheckDays: 21,
    active: true,
  },
  {
    code: "DD",
    name: "Derm. Digital",
    full: "Dermatite Digital",
    emoji: "🦠",
    recheckDays: 7,
    active: true,
  },
  {
    code: "HI",
    name: "Hiperplasia",
    full: "Hiperplasia Interdigital",
    emoji: "🌿",
    recheckDays: 30,
    active: true,
  },
  {
    code: "FF",
    name: "Flegmão",
    full: "Flegmão / Podridão do Pé",
    emoji: "🦨",
    recheckDays: 30,
    active: true,
  },
  {
    code: "J",
    name: "Inf. Articular",
    full: "Infecção Articular",
    emoji: "🔩",
    recheckDays: 30,
    active: true,
  },
  {
    code: "LM",
    name: "Les. Membro",
    full: "Lesão de Membro",
    emoji: "🦵",
    recheckDays: 30,
    active: true,
  },
  {
    code: "TS",
    name: "Sola Fina",
    full: "Sola Fina",
    emoji: "📏",
    recheckDays: 30,
    active: true,
  },
  {
    code: "DOUBLE_SOLE",
    name: "Sola Dupla",
    full: "Sola Dupla",
    emoji: "🟣",
    recheckDays: 30,
    active: true,
  },
  {
    code: "LOCOMOTION",
    name: "Locomoção",
    full: "Problema de Locomoção",
    emoji: "🚶",
    recheckDays: 30,
    active: true,
  },
  {
    code: "P",
    name: "Perfuração",
    full: "Perfuração",
    emoji: "📌",
    recheckDays: 30,
    active: true,
  },
  {
    code: "X",
    name: "Descarte",
    full: "Descarte — Retirar do Lote",
    emoji: "❌",
    recheckDays: 30,
    active: true,
  },
];

const REMOVED_DISEASES: Record<string, DiseaseDefinition> = {
  HHE: {
    code: "HHE",
    name: "Talão c/ Lama",
    full: "Talão por Lama / Esterco",
    emoji: "💧",
    recheckDays: 30,
    active: false,
  },
};

function normalizeRecheckDays(value: unknown, fallback: number = CURATIVE_DEADLINES.other) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(365, Math.round(numeric)));
}

export function normalizeReviewCount(value: unknown, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(24, Math.round(numeric)));
}

function normalizeDiseaseCatalog(stored?: DiseaseDefinition[]) {
  const storedByCode = new Map(
    (Array.isArray(stored) ? stored : [])
      .filter((disease) => disease && typeof disease.code === "string")
      .map((disease) => [disease.code, disease]),
  );
  const defaults = LESIONS.map((disease) => {
    const saved = storedByCode.get(disease.code);
    storedByCode.delete(disease.code);
    const keepCanonicalName = disease.code === "FF";
    return {
      ...disease,
      ...saved,
      code: disease.code,
      name: keepCanonicalName ? disease.name : saved?.name?.trim() || disease.name,
      full: keepCanonicalName
        ? disease.full
        : saved?.full?.trim() || saved?.name?.trim() || disease.full,
      emoji: saved?.emoji || disease.emoji,
      recheckDays: normalizeRecheckDays(saved?.recheckDays, disease.recheckDays),
      active: saved?.active !== false,
    } satisfies DiseaseDefinition;
  });
  const custom = Array.from(storedByCode.values()).map((disease) => ({
    code: disease.code,
    name: disease.name?.trim() || "Doença sem nome",
    full: disease.full?.trim() || disease.name?.trim() || "Doença sem nome",
    emoji: disease.emoji || "🩺",
    recheckDays: normalizeRecheckDays(disease.recheckDays),
    active: disease.active !== false,
  }));
  return [...defaults, ...custom].filter((disease) => !(disease.code in REMOVED_DISEASES));
}

export function defaultDiseaseCatalog() {
  return normalizeDiseaseCatalog();
}

export function diseaseCatalog(farm = loadFarm(), includeInactive = true) {
  const catalog = normalizeDiseaseCatalog(farm.diseases);
  return includeInactive ? catalog : catalog.filter((disease) => disease.active);
}

export function diseaseDefinition(code: LesionCode, farm = loadFarm()) {
  return diseaseCatalog(farm).find((disease) => disease.code === code) ?? REMOVED_DISEASES[code];
}

export function recommendedRecheckForDiseases(
  diseases: DiseaseEntry[] = [],
  catalog: DiseaseDefinition[] = diseaseCatalog(),
) {
  const activeCodes = new Set(
    diseases.filter((disease) => disease.severity > 0).map((disease) => disease.code),
  );
  const matchingRules = catalog.filter(
    (disease) => activeCodes.has(disease.code) && disease.recheckDays > 0,
  );
  if (matchingRules.length === 0) return null;
  const days = Math.min(...matchingRules.map((disease) => disease.recheckDays));
  return {
    days,
    diseases: matchingRules.filter((disease) => disease.recheckDays === days),
  };
}

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

const LEGACY_BLOCK_TREATMENTS = new Set<TreatmentCode>(["BLOCO_ON", "BLOCO_OFF", "BLOCO_FIX"]);

// Bloco continua legível no histórico, mas novos registros usam o fluxo estruturado de Taco.
export const SELECTABLE_TREATMENTS = TREATMENTS.filter(
  (treatment) => !LEGACY_BLOCK_TREATMENTS.has(treatment.code),
);

const EXCLUSIVE_TREATMENT_GROUPS: TreatmentCode[][] = [
  ["BLOCO_ON", "BLOCO_OFF", "BLOCO_FIX"],
  ["BAND_ON", "BAND_OFF"],
];

export function normalizeTreatmentSelection(values: TreatmentCode[] = [], hasTaco = false) {
  let result = Array.from(new Set(values));
  if (hasTaco || result.length > 1) result = result.filter((code) => code !== "NADA");
  for (const group of EXCLUSIVE_TREATMENT_GROUPS) {
    const selected = [...values].reverse().find((code) => group.includes(code));
    result = result.filter((code) => !group.includes(code));
    if (selected) result.push(selected);
  }
  return result;
}

export function toggleTreatmentSelection(
  current: TreatmentCode[],
  code: TreatmentCode,
  hasTaco = false,
): TreatmentCode[] {
  if (current.includes(code)) return current.filter((item) => item !== code);
  if (code === "NADA") return hasTaco ? [] : ["NADA"];
  return normalizeTreatmentSelection([...current, code], hasTaco);
}

export interface VisitValidationIssue {
  foot?: FootKey;
  message: string;
}

export function footHasActiveProblem(foot: FootEntry) {
  if (foot.resolved || foot.data_liberacao) return false;
  return (
    !foot.ok ||
    (foot.diseases ?? []).some((disease) => normalizeSeverity(disease.severity) > 0) ||
    foot.taco?.action === "apply" ||
    foot.taco?.action === "maintain"
  );
}

export function visitHasActiveProblem(visit: Visit) {
  return visit.feet.some(footHasActiveProblem);
}

export function validateVisitClinicalData(visit: Visit): VisitValidationIssue[] {
  const issues: VisitValidationIssue[] = [];
  if (!visit.tag.trim()) issues.push({ message: "Informe o número do brinco." });

  const hasActiveProblem = visitHasActiveProblem(visit);
  if (visit.preventivo && hasActiveProblem) {
    issues.push({
      message: "Preventivo não pode ser salvo porque há doença, taco ou outro problema registrado.",
    });
  }

  for (const foot of visit.feet) {
    if (foot.ok || foot.resolved || foot.data_liberacao) continue;
    const diseases = (foot.diseases ?? []).filter((disease) => disease.severity > 0);
    const treatments = foot.treatments ?? [];
    if (diseases.length === 0 && treatments.length === 0 && !foot.taco) {
      issues.push({
        foot: foot.foot,
        message: "Informe uma lesão, um taco ou outro tratamento para este casco.",
      });
    }
    if (foot.taco && !foot.taco.side) {
      issues.push({ foot: foot.foot, message: "Escolha o lado esquerdo ou direito do taco." });
    }
    if (treatments.includes("NADA") && (treatments.length > 1 || foot.taco)) {
      issues.push({
        foot: foot.foot,
        message: "Só limpou não pode ser usado com outro tratamento.",
      });
    }
    for (const group of EXCLUSIVE_TREATMENT_GROUPS) {
      if (treatments.filter((code) => group.includes(code)).length > 1) {
        issues.push({ foot: foot.foot, message: "Escolha somente uma ação do mesmo tratamento." });
      }
    }
    if (foot.recheck && !foot.recheckDate) {
      issues.push({ foot: foot.foot, message: "Escolha a data da primeira revisão." });
    }
  }
  return issues;
}

export const TACO_ACTIONS: { action: TacoAction; label: string }[] = [
  { action: "apply", label: "Colocar taco" },
  { action: "remove", label: "Retirar taco" },
  { action: "maintain", label: "Deixar taco colocado" },
];

export const TACO_SIDE_LABEL: Record<TacoSide, string> = {
  left: "Lado esquerdo",
  right: "Lado direito",
};

export function tacoLabel(taco?: TacoEntry) {
  if (!taco) return "";
  const action = TACO_ACTIONS.find((item) => item.action === taco.action)?.label ?? "Taco";
  return `${action} · ${taco.side ? TACO_SIDE_LABEL[taco.side] : "lado não informado"}`;
}

export function normalizeDiseases(diseases: DiseaseEntry[] = []) {
  const normalized = new Map<LesionCode, DiseaseEntry>();
  for (const disease of diseases) {
    const severity = normalizeSeverity(disease.severity);
    if (severity === 0) continue;
    const previous = normalized.get(disease.code);
    if (!previous || severity >= previous.severity) {
      normalized.set(disease.code, { ...disease, severity });
    }
  }
  return Array.from(normalized.values());
}

export function visitHasTaco(visit: Visit) {
  return visit.feet.some((foot) => Boolean(foot.taco));
}

export interface TacoMetrics {
  applied: number;
  removed: number;
  maintained: number;
  active: number;
  appliedToday: number;
}

function activeTacoPlacementsFromVisits(visits: Visit[]) {
  const active = new Map<string, string>();
  for (const visit of visits.filter(visitIsFinalized).sort((a, b) => a.createdAt - b.createdAt)) {
    for (const foot of visit.feet) {
      if (!foot.taco?.side) continue;
      const tag = visit.tag.trim().toLocaleLowerCase("pt-BR");
      const key = `${visit.farm_id ?? "local"}:${tag}:${foot.foot}:${foot.taco.side}`;
      if (foot.taco.action === "remove") active.delete(key);
      else active.set(key, tag);
    }
  }
  return active;
}

export interface ActiveDiseaseEpisode {
  foot: FootKey;
  code: LesionCode;
  severity: Severity;
  sinceDate: string;
  sinceCreatedAt: number;
  visits: number;
}

export interface ActiveTacoPlacement {
  foot: FootKey;
  side: TacoSide;
  sinceDate: string;
  sinceCreatedAt: number;
}

export interface AnimalClinicalSnapshot {
  tag: string;
  totalVisits: number;
  lastVisit?: Visit;
  lastPreventiveDate?: string;
  activeDiseases: ActiveDiseaseEpisode[];
  activeTacos: ActiveTacoPlacement[];
  hasActiveProblem: boolean;
  hasOpenRecheck: boolean;
  worstSeverity: Severity;
}

export function animalClinicalSnapshotFromVisits(
  sourceVisits: Visit[],
  tag: string,
): AnimalClinicalSnapshot {
  const normalizedTag = tag.trim().toLocaleLowerCase("pt-BR");
  const visits = sourceVisits
    .filter(visitIsFinalized)
    .filter((visit) => visit.tag.trim().toLocaleLowerCase("pt-BR") === normalizedTag)
    .sort((a, b) => a.createdAt - b.createdAt);
  const diseases = new Map<string, ActiveDiseaseEpisode>();
  const tacos = new Map<string, ActiveTacoPlacement>();
  let lastPreventiveDate: string | undefined;
  let hasOpenRecheck = false;

  for (const visit of visits) {
    if (visit.preventivo) lastPreventiveDate = visit.date;
    hasOpenRecheck = visit.feet.some((foot) =>
      Boolean(foot.recheck && !foot.resolved && !foot.data_liberacao),
    );

    for (const foot of visit.feet) {
      const activeDiseases = normalizeDiseases(foot.diseases);
      const previousEpisodes = new Map(
        Array.from(diseases.entries()).filter(([, episode]) => episode.foot === foot.foot),
      );
      for (const [key, episode] of diseases) {
        if (episode.foot === foot.foot) diseases.delete(key);
      }
      if (!foot.ok && !foot.resolved && !foot.data_liberacao) {
        for (const disease of activeDiseases) {
          const key = `${foot.foot}:${disease.code}`;
          const previous = previousEpisodes.get(key);
          diseases.set(key, {
            foot: foot.foot,
            code: disease.code,
            severity: disease.severity,
            sinceDate: previous?.sinceDate ?? visit.date,
            sinceCreatedAt: previous?.sinceCreatedAt ?? visit.createdAt,
            visits: (previous?.visits ?? 0) + 1,
          });
        }
      }

      if (!foot.taco?.side) continue;
      const tacoKey = `${foot.foot}:${foot.taco.side}`;
      if (foot.taco.action === "remove") {
        tacos.delete(tacoKey);
      } else if (!tacos.has(tacoKey)) {
        tacos.set(tacoKey, {
          foot: foot.foot,
          side: foot.taco.side,
          sinceDate: visit.date,
          sinceCreatedAt: visit.createdAt,
        });
      }
    }
  }

  const activeDiseases = Array.from(diseases.values());
  const activeTacos = Array.from(tacos.values());
  return {
    tag,
    totalVisits: visits.length,
    lastVisit: visits.at(-1),
    lastPreventiveDate,
    activeDiseases,
    activeTacos,
    hasActiveProblem: activeDiseases.length > 0 || activeTacos.length > 0,
    hasOpenRecheck,
    worstSeverity: normalizeSeverity(
      activeDiseases.reduce((worst, disease) => Math.max(worst, disease.severity), 0),
    ),
  };
}

export function animalClinicalSnapshot(tag: string) {
  return animalClinicalSnapshotFromVisits(loadVisits(), tag);
}

export function tacoMetricsFromVisits(visits: Visit[], referenceDate = todayISO()): TacoMetrics {
  const metrics: TacoMetrics = {
    applied: 0,
    removed: 0,
    maintained: 0,
    active: 0,
    appliedToday: 0,
  };

  for (const visit of visits.filter(visitIsFinalized).sort((a, b) => a.createdAt - b.createdAt)) {
    for (const foot of visit.feet) {
      if (!foot.taco?.side) continue;
      if (foot.taco.action === "apply") {
        metrics.applied += 1;
        if (visit.date === referenceDate) metrics.appliedToday += 1;
      } else if (foot.taco.action === "remove") {
        metrics.removed += 1;
      } else {
        metrics.maintained += 1;
      }
    }
  }
  metrics.active = activeTacoPlacementsFromVisits(visits).size;
  return metrics;
}

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

export const CURATIVE_DEADLINES = {
  digitalDermatitis: 7,
  soleUlcerOrWhiteLine: 21,
  other: 30,
} as const;

export type CurativeCategory = "digital_dermatitis" | "sole_ulcer_white_line" | "other";

export interface CurativeFollowup {
  id: string;
  farm_id?: string;
  tag: string;
  sex: Sex;
  lote?: string;
  foot: FootKey;
  visitId: string;
  treatmentDate: string;
  dueDate: string;
  targetDays: number;
  elapsedDays: number;
  remainingDays: number;
  category: CurativeCategory;
  diseases: LesionCode[];
  status: "overdue" | "today" | "upcoming";
}

export interface CurativeMetrics {
  open: number;
  overdue: number;
  dueToday: number;
  released: number;
  averageDaysToRelease: number | null;
}

export interface AgendaItem {
  id: string;
  visit_id?: string;
  farm_id?: string;
  farm_name?: string;
  date: string;
  type: "recheck" | "curative" | "preventive";
  tag: string;
  sex: Sex;
  lote?: string;
  feet: FootKey[];
  title: string;
  detail: string;
  overdue: boolean;
  reviewNumber?: number;
  reviewTotal?: number;
  reviewIntervalDays?: number;
}

export interface ScheduledRecheck {
  visit_id: string;
  farm_id?: string;
  tag: string;
  sex: Sex;
  lote?: string;
  feet: FootKey[];
  sequence: number;
  total: number;
  intervalDays: number;
}

export interface EmployeeWorkMetrics {
  totalVisits: number;
  uniqueAnimals: number;
  todayVisits: number;
  monthVisits: number;
  lastSevenDaysVisits: number;
  problemVisits: number;
  okVisits: number;
  pendingAnimals: number;
  overdueAnimals: number;
  lastVisitAt: number | null;
}

export interface CalendarMonthMetrics {
  visits: number;
  attendedAnimals: number;
  scheduledItems: number;
  scheduledAnimals: number;
}

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

function daysBetweenISO(fromISO: string, toISO: string) {
  const from = new Date(`${fromISO}T12:00:00`).getTime();
  const to = new Date(`${toISO}T12:00:00`).getTime();
  return Math.max(0, Math.round((to - from) / 86400000));
}

export function curativeDeadlineForDiseases(
  diseases: DiseaseEntry[] = [],
  catalog: DiseaseDefinition[] = diseaseCatalog(),
): {
  days: number;
  category: CurativeCategory;
} {
  const activeCodes = diseases.filter((d) => d.severity > 0).map((d) => d.code);
  const configuredDays = activeCodes
    .map((code) => catalog.find((disease) => disease.code === code)?.recheckDays)
    .filter((days): days is number => typeof days === "number" && days > 0);
  const days = configuredDays.length > 0 ? Math.min(...configuredDays) : CURATIVE_DEADLINES.other;
  const category = activeCodes.includes("DD")
    ? "digital_dermatitis"
    : activeCodes.some((code) => code === "SU" || code === "LB")
      ? "sole_ulcer_white_line"
      : "other";
  return { days, category };
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

export function visitBelongsToEmployee(visit: Visit, employeeId: string, employeeName?: string) {
  if (visit.employee_id) return visit.employee_id === employeeId;
  if (!employeeName) return false;
  const recordedName = visit.employee_name ?? visit.visitante_nome;
  return (
    recordedName?.trim().toLocaleLowerCase("pt-BR") ===
    employeeName.trim().toLocaleLowerCase("pt-BR")
  );
}

export function employeeWorkMetricsFromVisits(
  visits: Visit[],
  agendaItems: AgendaItem[],
  employeeId: string,
  employeeName?: string,
  referenceDate = todayISO(),
): EmployeeWorkMetrics {
  const ownedVisits = visits
    .filter(visitIsFinalized)
    .filter((visit) => visitBelongsToEmployee(visit, employeeId, employeeName));
  const monthPrefix = referenceDate.slice(0, 7);
  const endOfReferenceDay = new Date(`${referenceDate}T23:59:59`).getTime();
  const sevenDaysAgo = endOfReferenceDay - 6 * 86400000;
  const uniqueTags = (items: Array<{ tag: string }>) =>
    new Set(items.map((item) => item.tag.trim().toLocaleLowerCase("pt-BR"))).size;
  const problemVisits = ownedVisits.filter((visit) =>
    visit.feet.some((foot) => !foot.ok && !foot.resolved && !foot.data_liberacao),
  ).length;

  return {
    totalVisits: ownedVisits.length,
    uniqueAnimals: uniqueTags(ownedVisits),
    todayVisits: ownedVisits.filter((visit) => visit.date === referenceDate).length,
    monthVisits: ownedVisits.filter((visit) => visit.date.startsWith(monthPrefix)).length,
    lastSevenDaysVisits: ownedVisits.filter(
      (visit) => visit.createdAt >= sevenDaysAgo && visit.createdAt <= endOfReferenceDay,
    ).length,
    problemVisits,
    okVisits: ownedVisits.length - problemVisits,
    pendingAnimals: uniqueTags(agendaItems),
    overdueAnimals: uniqueTags(agendaItems.filter((item) => item.date < referenceDate)),
    lastVisitAt: ownedVisits.length
      ? Math.max(...ownedVisits.map((visit) => visit.createdAt))
      : null,
  };
}

export function calendarMonthMetricsFromVisits(
  visits: Visit[],
  agendaItems: AgendaItem[],
  employeeId: string,
  year: number,
  month: number,
  employeeName?: string,
): CalendarMonthMetrics {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthVisits = visits.filter(
    (visit) =>
      visitIsFinalized(visit) &&
      visit.date.startsWith(prefix) &&
      visitBelongsToEmployee(visit, employeeId, employeeName),
  );
  const monthAgenda = agendaItems.filter((item) => item.date.startsWith(prefix));
  const uniqueTags = (items: Array<{ tag: string }>) =>
    new Set(items.map((item) => item.tag.trim().toLocaleLowerCase("pt-BR"))).size;

  return {
    visits: monthVisits.length,
    attendedAnimals: uniqueTags(monthVisits),
    scheduledItems: monthAgenda.length,
    scheduledAnimals: uniqueTags(monthAgenda),
  };
}

function migrateFootEntry(f: LegacyFootEntry): FootEntry {
  const diseases: DiseaseEntry[] = [];
  if (f.diseases) {
    diseases.push(
      ...f.diseases.map((disease) => ({
        ...disease,
        severity: normalizeSeverity(disease.severity),
      })),
    );
  } else if (f.lesion && f.severity !== undefined && (f.severity as number) > 0) {
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
    diseases,
    treatments: (
      f.treatments ?? (f.treatment && f.treatment !== "NADA" ? [f.treatment as TreatmentCode] : [])
    ).map((c: string) => (c === "BLOCO" ? "BLOCO_ON" : c)) as TreatmentCode[],
    taco: f.taco,
    recheck: f.recheck,
    recheckDate: f.recheckDate,
    intervalo_revisao_dias: f.intervalo_revisao_dias,
    revisoes_necessarias:
      f.revisoes_necessarias !== undefined || f.recheck
        ? normalizeReviewCount(f.revisoes_necessarias)
        : undefined,
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
      return (JSON.parse(v3Raw) as LegacyVisit[])
        .map(
          (v) =>
            ({
              ...v,
              feet: (v.feet || []).map(migrateFootEntry),
            }) as Visit,
        )
        .filter(visitIsVisible);
    }

    const legacyKeys = ["casco.visits.v2", "casco.visits.v1"];
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(scopedKey(key));
      if (raw) {
        const legacy = JSON.parse(raw) as LegacyVisit[];
        const migrated: Visit[] = legacy
          .map(
            (v) =>
              ({
                ...v,
                feet: (v.feet || []).map(migrateFootEntry),
              }) as Visit,
          )
          .filter(visitIsVisible);
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
      taco_action?: TacoAction;
      taco_side?: TacoSide;
      comments?: CommentCode[];
      nota?: string;
      recheck?: boolean;
      recheck_date?: string;
      intervalo_revisao_dias?: number;
      revisoes_necessarias?: number;
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
      taco:
        data.payload?.taco ??
        (data.taco_action && data.taco_side
          ? { action: data.taco_action, side: data.taco_side }
          : undefined),
      comments: data.payload?.comments ?? data.comments ?? [],
      nota: data.payload?.nota ?? data.nota,
      recheck: data.payload?.recheck ?? data.recheck,
      recheckDate: data.payload?.recheckDate ?? data.recheck_date,
      intervalo_revisao_dias: data.payload?.intervalo_revisao_dias ?? data.intervalo_revisao_dias,
      revisoes_necessarias: data.payload?.revisoes_necessarias ?? data.revisoes_necessarias,
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

  const visits = visitRows
    .map((row) => {
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
        status?: Visit["status"];
        cancellation_reason?: string;
        cancelled_at?: string;
        cancelled_by?: string;
        cancellation_scope?: Visit["cancellation_scope"];
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
        completedAt: payload?.completedAt,
        tag: payload?.tag ?? data.tag ?? "",
        sex: payload?.sex ?? data.sex ?? "vaca",
        lote: payload?.lote ?? data.lote,
        preventivo: payload?.preventivo ?? data.preventivo,
        visitante_nome: payload?.visitante_nome ?? data.visitante_nome,
        employee_id: payload?.employee_id ?? data.employee_id,
        employee_name: payload?.employee_name ?? data.employee_name,
        device_id: payload?.device_id ?? data.device_id,
        status: data.status ?? payload?.status ?? "active",
        correction_of_id: payload?.correction_of_id,
        correction_reason: payload?.correction_reason,
        cancellation_reason: data.cancellation_reason ?? payload?.cancellation_reason,
        cancelled_at: data.cancelled_at ?? payload?.cancelled_at,
        cancelled_by: data.cancelled_by ?? payload?.cancelled_by,
        cancellation_scope: data.cancellation_scope ?? payload?.cancellation_scope,
        feet,
      } satisfies Visit;
    })
    .filter(visitIsVisible);

  visits.sort((a, b) => b.createdAt - a.createdAt);
  saveVisits(visits);
  return visits;
}

function registerAnimalFromVisit(v: Visit) {
  if (!canUseStorage()) return { created: false };
  const tag = v.tag.trim();
  if (!tag) return { created: false };

  const farm = loadFarm();
  const normalizedTag = tag.toLocaleLowerCase("pt-BR");
  if (
    farm.animais.some((animal) => animal.tag.trim().toLocaleLowerCase("pt-BR") === normalizedTag)
  ) {
    return { created: false };
  }

  const animal: RegisteredAnimal = {
    tag,
    sex: v.sex,
    lote: v.lote?.trim().toUpperCase() || undefined,
  };
  const next = normalizeFarm({ ...farm, animais: [...farm.animais, animal] });
  localStorage.setItem(scopedKey(FARM_KEY), JSON.stringify(next));

  const payload = v.farm_id
    ? {
        id: `${v.farm_id}_${tag}`,
        farm_id: v.farm_id,
        tag,
        sex: animal.sex ?? "vaca",
        lote: animal.lote,
        status: "active",
      }
    : undefined;
  if (payload && v.farm_id) {
    void putLocalRecord("animals", {
      id: payload.id,
      farm_id: v.farm_id,
      data: payload,
      updated_at: new Date().toISOString(),
      synced: false,
    });
  }

  writeAutoBackup();
  return { created: true, payload };
}

export function addVisit(v: Visit) {
  if (v.status !== "active" || !v.completedAt || !Number.isFinite(v.completedAt)) {
    throw new Error("A visita só pode ser salva depois da confirmação final.");
  }
  const all = loadVisits();
  const normalizedFeet = v.feet.map((foot) => {
    const normalized = {
      ...foot,
      diseases: normalizeDiseases(foot.diseases),
      treatments: normalizeTreatmentSelection(foot.treatments, Boolean(foot.taco)),
    };
    return foot.recheck
      ? {
          ...normalized,
          revisoes_necessarias: normalizeReviewCount(foot.revisoes_necessarias),
        }
      : {
          ...normalized,
          recheckDate: undefined,
          intervalo_revisao_dias: undefined,
          revisoes_necessarias: undefined,
        };
  });
  v = {
    ...v,
    ...currentVisitMetadata(),
    completedAt: v.completedAt,
    tag: v.tag.trim(),
    lote: v.lote?.trim().toUpperCase() || undefined,
    status: "active",
    preventivo: Boolean(v.preventivo) && !normalizedFeet.some(footHasActiveProblem),
    feet: normalizedFeet,
  };

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
  const animalRegistration = registerAnimalFromVisit(v);
  const animalCreated = animalRegistration.created;
  const registeredAnimal = animalRegistration.payload;
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
      ...(syncPayloads.correction
        ? [
            putLocalRecord("hoof_corrections", {
              id: syncPayloads.correction.id,
              farm_id: v.farm_id!,
              data: syncPayloads.correction,
              updated_at: updatedAt,
              synced: false,
            }),
          ]
        : []),
    ]);
  }
  if (v.farm_id) {
    void enqueueOutboxMany([
      ...(registeredAnimal
        ? [
            {
              farm_id: v.farm_id,
              tableName: "animals",
              op: "upsert" as const,
              payload: registeredAnimal,
            },
          ]
        : []),
      {
        farm_id: v.farm_id,
        tableName: "hoof_visits",
        op: "upsert",
        payload: syncPayloads.visit,
      },
      ...syncPayloads.feet.map((payload) => ({
        farm_id: v.farm_id!,
        tableName: "hoof_feet",
        op: "upsert" as const,
        payload,
      })),
      ...syncPayloads.media.map((payload) => ({
        farm_id: v.farm_id!,
        tableName: "hoof_media",
        op: "upsert" as const,
        payload,
      })),
      ...(syncPayloads.correction
        ? [
            {
              farm_id: v.farm_id,
              tableName: "hoof_corrections",
              op: "insert" as const,
              payload: syncPayloads.correction,
            },
          ]
        : []),
    ]);
  }
  return { animalCreated };
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
    lotes: Array.from(
      new Set((stored.lotes ?? []).map((lote) => lote.trim().toUpperCase()).filter(Boolean)),
    ),
    dias_para_preventivo: stored.dias_para_preventivo ?? 180,
    animais: (stored.animais ?? [])
      .filter((animal) => animal?.tag?.trim())
      .map((animal) => ({
        tag: animal.tag.trim(),
        sex: animal.sex === "touro" ? "touro" : "vaca",
        lote: animal.lote?.trim().toUpperCase() || undefined,
      })),
    diseases: normalizeDiseaseCatalog(stored.diseases),
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
  return loadVisits().filter((visit) => visitIsFinalized(visit) && visit.date === date);
}

export function visitsByTag(tag: string): Visit[] {
  return loadVisits()
    .filter((visit) => visitIsFinalized(visit) && visit.tag.toLowerCase() === tag.toLowerCase())
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
  hasProblem: boolean;
  hasTaco: boolean;
  worstSeverity: Severity;
}[] {
  const visits = loadVisits().filter(visitIsFinalized);
  const farm = loadFarm();
  const map = new Map<string, ReturnType<typeof allAnimals>[number]>();

  // Animals from registered list (no visit yet appear with lastVisit=0)
  for (const a of farm.animais) {
    const key = a.tag.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        tag: a.tag,
        sex: a.sex ?? "vaca",
        lote: a.lote,
        lastVisit: 0,
        totalVisits: 0,
        hasRecheck: false,
        hasResolved: false,
        hasProblem: false,
        hasTaco: false,
        worstSeverity: 0,
      });
    }
  }

  const tags = new Map<string, string>();
  for (const visit of visits) tags.set(visit.tag.toLocaleLowerCase("pt-BR"), visit.tag);
  for (const animal of farm.animais) {
    tags.set(animal.tag.toLocaleLowerCase("pt-BR"), animal.tag);
  }

  for (const [key, tag] of tags) {
    const snapshot = animalClinicalSnapshotFromVisits(visits, tag);
    const latest = snapshot.lastVisit;
    const existing = map.get(key);
    const hasResolved =
      latest?.feet.some((foot) => foot.resolved || Boolean(foot.data_liberacao)) ?? false;
    map.set(key, {
      tag: latest?.tag ?? existing?.tag ?? tag,
      sex: latest?.sex ?? existing?.sex ?? "vaca",
      lote: latest?.lote ?? existing?.lote,
      lastVisit: latest?.createdAt ?? 0,
      totalVisits: snapshot.totalVisits,
      hasRecheck: snapshot.hasOpenRecheck,
      hasResolved,
      hasProblem: snapshot.hasActiveProblem,
      hasTaco: snapshot.activeTacos.length > 0,
      worstSeverity: snapshot.worstSeverity,
    });
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
      sex: a.sex ?? "vaca",
      lote: a.lote,
      hasActiveProblem: false,
      hasProblemaHistorico: false,
    });
  }

  for (const v of visits) {
    const key = v.tag.toLowerCase();
    const hasActiveProblem = visitHasActiveProblem(v);
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
  lotes: [],
  dias_para_preventivo: 180,
  animais: [],
  diseases: defaultDiseaseCatalog(),
};

export function loadFarm(): FarmConfig {
  if (!canUseStorage()) return FARM_DEFAULT;
  return readStoredFarm();
}

export async function hydrateFarmFromIndexedDb() {
  const ctx = farmContextService.getContext();
  if (!ctx || !canUseStorage()) return loadFarm();

  const [settingsRows, loteRows, animalRows] = await Promise.all([
    localdb.farm_settings.where("farm_id").equals(ctx.farm_id).toArray(),
    localdb.farm_lotes.where("farm_id").equals(ctx.farm_id).toArray(),
    localdb.animals.where("farm_id").equals(ctx.farm_id).toArray(),
  ]);
  const settingsRow = [...settingsRows].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  const settingsData = settingsRow?.data as
    | { payload?: Partial<FarmConfig>; dias_para_preventivo?: number }
    | undefined;
  const previous = loadFarm();
  const next = normalizeFarm({
    ...previous,
    ...(settingsData?.payload ?? {}),
    farmName: ctx.farm_name || settingsData?.payload?.farmName || previous.farmName,
    worker: ctx.employee_name || settingsData?.payload?.worker || previous.worker,
    configured: true,
    dias_para_preventivo:
      settingsData?.dias_para_preventivo ??
      settingsData?.payload?.dias_para_preventivo ??
      previous.dias_para_preventivo,
    lotes: loteRows.map((row) => {
      const data = row.data as { name?: string; status?: string };
      return data.status === "blocked" ? "" : (data.name ?? "");
    }),
    animais: animalRows.flatMap((row): RegisteredAnimal[] => {
      const data = row.data as {
        tag?: string;
        sex?: Sex;
        lote?: string;
        status?: string;
      };
      if (!data.tag || data.status === "blocked") return [];
      return [{ tag: data.tag, sex: data.sex, lote: data.lote }];
    }),
  });

  localStorage.setItem(scopedKey(FARM_KEY), JSON.stringify(next));
  return next;
}

export function saveFarm(f: FarmConfig) {
  if (!canUseStorage()) return;
  const previous = loadFarm();
  const normalized = normalizeFarm(f);
  localStorage.setItem(scopedKey(FARM_KEY), JSON.stringify(normalized));
  const ctx = farmContextService.getContext();
  if (ctx?.is_admin) {
    const currentLoteIds = new Set(normalized.lotes.map((lote) => `${ctx.farm_id}_${lote}`));
    const currentAnimalIds = new Set(
      normalized.animais.map((animal) => `${ctx.farm_id}_${animal.tag}`),
    );
    const removedLotes = previous.lotes
      .map((lote) => `${ctx.farm_id}_${lote}`)
      .filter((id) => !currentLoteIds.has(id));
    const removedAnimals = previous.animais
      .map((animal) => `${ctx.farm_id}_${animal.tag}`)
      .filter((id) => !currentAnimalIds.has(id));

    void putLocalRecord("farm_settings", {
      id: ctx.farm_id,
      farm_id: ctx.farm_id,
      data: normalized,
      updated_at: new Date().toISOString(),
      synced: false,
    });
    void Promise.all([
      ...removedLotes.map((id) => localdb.farm_lotes.delete(id)),
      ...removedAnimals.map((id) => localdb.animals.delete(id)),
    ]);
    for (const lote of normalized.lotes) {
      void putLocalRecord("farm_lotes", {
        id: `${ctx.farm_id}_${lote}`,
        farm_id: ctx.farm_id,
        data: { id: `${ctx.farm_id}_${lote}`, farm_id: ctx.farm_id, name: lote, status: "active" },
        updated_at: new Date().toISOString(),
        synced: false,
      });
    }
    for (const animal of normalized.animais) {
      void putLocalRecord("animals", {
        id: `${ctx.farm_id}_${animal.tag}`,
        farm_id: ctx.farm_id,
        data: {
          id: `${ctx.farm_id}_${animal.tag}`,
          farm_id: ctx.farm_id,
          tag: animal.tag,
          sex: animal.sex ?? "vaca",
          lote: animal.lote,
          status: "active",
        },
        updated_at: new Date().toISOString(),
        synced: false,
      });
    }
    void enqueueOutboxMany([
      {
        farm_id: ctx.farm_id,
        tableName: "farm_settings",
        op: "upsert",
        payload: {
          id: ctx.farm_id,
          farm_id: ctx.farm_id,
          dias_para_preventivo: normalized.dias_para_preventivo,
          payload: normalized,
        },
      },
      ...removedLotes.map((id) => ({
        farm_id: ctx.farm_id,
        tableName: "farm_lotes",
        op: "delete" as const,
        payload: { id, farm_id: ctx.farm_id },
      })),
      ...removedAnimals.map((id) => ({
        farm_id: ctx.farm_id,
        tableName: "animals",
        op: "delete" as const,
        payload: { id, farm_id: ctx.farm_id },
      })),
      ...normalized.lotes.map((lote) => ({
        farm_id: ctx.farm_id,
        tableName: "farm_lotes",
        op: "upsert" as const,
        payload: {
          id: `${ctx.farm_id}_${lote}`,
          farm_id: ctx.farm_id,
          name: lote,
          status: "active",
        },
      })),
      ...normalized.animais.map((animal) => ({
        farm_id: ctx.farm_id,
        tableName: "animals",
        op: "upsert" as const,
        payload: {
          id: `${ctx.farm_id}_${animal.tag}`,
          farm_id: ctx.farm_id,
          tag: animal.tag,
          sex: animal.sex ?? "vaca",
          lote: animal.lote,
          status: "active",
        },
      })),
    ]);
  }
  writeAutoBackup();
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

export function rechecksByDateFromVisits(
  sourceVisits: Visit[],
  employeeId?: string,
): Map<string, ScheduledRecheck[]> {
  const visits = [...sourceVisits]
    .filter(visitIsFinalized)
    .filter((visit) => !employeeId || visit.employee_id === employeeId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const map = new Map<string, ScheduledRecheck[]>();
  const seen = new Set<string>();
  for (const v of visits) {
    const key = `${v.farm_id ?? "local"}:${v.tag.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const f of v.feet) {
      if (!f.recheck || f.resolved || f.data_liberacao || !f.recheckDate) continue;
      const total = normalizeReviewCount(f.revisoes_necessarias);
      const intervalDays = normalizeRecheckDays(
        f.intervalo_revisao_dias,
        Math.max(1, daysBetweenISO(v.date, f.recheckDate)),
      );
      for (let sequence = 1; sequence <= total; sequence += 1) {
        const date =
          sequence === 1
            ? f.recheckDate
            : dateAfterDays(intervalDays * (sequence - 1), f.recheckDate);
        const existing = map.get(date) ?? [];
        const grouped = existing.find(
          (item) =>
            item.visit_id === v.id &&
            item.sequence === sequence &&
            item.total === total &&
            item.intervalDays === intervalDays,
        );
        if (grouped) {
          grouped.feet.push(f.foot);
        } else {
          existing.push({
            visit_id: v.id,
            farm_id: v.farm_id,
            tag: v.tag,
            sex: v.sex,
            lote: v.lote,
            feet: [f.foot],
            sequence,
            total,
            intervalDays,
          });
        }
        map.set(date, existing);
      }
    }
  }
  return map;
}

export function rechecksByDate(employeeId?: string) {
  return rechecksByDateFromVisits(loadVisits(), employeeId);
}

export function curativeFollowupsFromVisits(
  sourceVisits: Visit[],
  referenceDate = todayISO(),
  employeeId?: string,
): CurativeFollowup[] {
  const visits = [...sourceVisits]
    .filter(visitIsFinalized)
    .filter((visit) => !employeeId || visit.employee_id === employeeId)
    .sort((a, b) => b.createdAt - a.createdAt);
  const seen = new Set<string>();
  const followups: CurativeFollowup[] = [];

  for (const visit of visits) {
    for (const foot of visit.feet) {
      const key = `${visit.farm_id ?? "local"}_${visit.tag.toLowerCase()}_${foot.foot}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const activeDiseases = (foot.diseases ?? []).filter((d) => d.severity > 0);
      const treated =
        (foot.treatments ?? []).some((treatment) => treatment !== "NADA") ||
        (Boolean(foot.taco) && foot.taco?.action !== "remove");
      if (
        foot.ok ||
        foot.resolved ||
        foot.data_liberacao ||
        !treated ||
        activeDiseases.length === 0
      ) {
        continue;
      }

      const rule = curativeDeadlineForDiseases(activeDiseases);
      const targetDays =
        foot.recheck && foot.intervalo_revisao_dias
          ? normalizeRecheckDays(foot.intervalo_revisao_dias, rule.days)
          : rule.days;
      const dueDate = dateAfterDays(targetDays, visit.date);
      const elapsedDays = daysBetweenISO(visit.date, referenceDate);
      const remainingDays = targetDays - elapsedDays;
      followups.push({
        id: `${visit.id}_${foot.foot}_curative`,
        farm_id: visit.farm_id,
        tag: visit.tag,
        sex: visit.sex,
        lote: visit.lote,
        foot: foot.foot,
        visitId: visit.id,
        treatmentDate: visit.date,
        dueDate,
        targetDays,
        elapsedDays,
        remainingDays,
        category: rule.category,
        diseases: activeDiseases.map((d) => d.code),
        status:
          dueDate < referenceDate ? "overdue" : dueDate === referenceDate ? "today" : "upcoming",
      });
    }
  }

  return followups.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.tag.localeCompare(b.tag));
}

export function curativeFollowups(referenceDate = todayISO(), employeeId?: string) {
  return curativeFollowupsFromVisits(loadVisits(), referenceDate, employeeId);
}

export function curativeMetrics(referenceDate = todayISO()): CurativeMetrics {
  const openFollowups = curativeFollowups(referenceDate);
  const releasedDurations: number[] = [];

  for (const visit of loadVisits().filter(visitIsFinalized)) {
    for (const foot of visit.feet) {
      if (!foot.data_liberacao) continue;
      releasedDurations.push(daysBetweenISO(visit.date, foot.data_liberacao));
    }
  }

  return {
    open: openFollowups.length,
    overdue: openFollowups.filter((item) => item.status === "overdue").length,
    dueToday: openFollowups.filter((item) => item.status === "today").length,
    released: releasedDurations.length,
    averageDaysToRelease:
      releasedDurations.length > 0
        ? Math.round(
            (releasedDurations.reduce((total, days) => total + days, 0) /
              releasedDurations.length) *
              10,
          ) / 10
        : null,
  };
}

export function agendaByDateFromVisits(
  visits: Visit[],
  referenceDate = todayISO(),
  employeeId?: string,
): Map<string, AgendaItem[]> {
  const map = new Map<string, AgendaItem[]>();
  const add = (item: AgendaItem) => map.set(item.date, [...(map.get(item.date) ?? []), item]);
  const plannedRecheckKeys = new Set<string>();

  for (const [date, items] of rechecksByDateFromVisits(visits, employeeId)) {
    for (const item of items) {
      item.feet.forEach((foot) => plannedRecheckKeys.add(`${item.visit_id}_${foot}`));
      add({
        id: `recheck_${item.visit_id}_${item.sequence}_${date}`,
        visit_id: item.visit_id,
        farm_id: item.farm_id,
        date,
        type: "recheck",
        tag: item.tag,
        sex: item.sex,
        lote: item.lote,
        feet: item.feet,
        title: "Revisão clínica",
        detail: `Revisão ${item.sequence} de ${item.total} · Pé(s): ${item.feet.join(" · ")}`,
        overdue: date < referenceDate,
        reviewNumber: item.sequence,
        reviewTotal: item.total,
        reviewIntervalDays: item.intervalDays,
      });
    }
  }

  for (const item of curativeFollowupsFromVisits(visits, referenceDate, employeeId)) {
    if (plannedRecheckKeys.has(`${item.visitId}_${item.foot}`)) continue;
    add({
      id: item.id,
      visit_id: item.visitId,
      farm_id: item.farm_id,
      date: item.dueDate,
      type: "curative",
      tag: item.tag,
      sex: item.sex,
      lote: item.lote,
      feet: [item.foot],
      title: "Prazo de curativo",
      detail: `${FOOT_LABEL[item.foot]} · ${item.targetDays} dias após tratamento`,
      overdue: item.status === "overdue",
    });
  }

  for (const items of map.values()) {
    items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.tag.localeCompare(b.tag));
  }
  return map;
}

export function preventiveAgendaItems(
  referenceDate = todayISO(),
  diasThreshold = loadFarm().dias_para_preventivo,
): AgendaItem[] {
  const threshold = Math.max(1, Math.min(3650, Math.trunc(diasThreshold) || 1));
  const farmId = farmContextService.getFarmId() ?? undefined;
  return preventiveList(0).map((animal) => {
    const date = animal.lastPreventivoDate
      ? dateAfterDays(threshold, animal.lastPreventivoDate)
      : referenceDate;
    return {
      id: `preventive_${farmId ?? "local"}_${animal.tag}_${date}`,
      farm_id: farmId,
      date,
      type: "preventive",
      tag: animal.tag,
      sex: animal.sex,
      lote: animal.lote,
      feet: [],
      title: "Casqueamento preventivo",
      detail: animal.lastPreventivoDate
        ? `Programado ${threshold} dias após o último preventivo`
        : "Primeiro preventivo ainda não registrado",
      overdue: date < referenceDate,
    };
  });
}

export function agendaByDate(
  referenceDate = todayISO(),
  employeeId?: string,
  options: { includePreventive?: boolean } = {},
) {
  const map = agendaByDateFromVisits(loadVisits(), referenceDate, employeeId);
  if (!options.includePreventive) return map;

  for (const item of preventiveAgendaItems(referenceDate)) {
    map.set(item.date, [...(map.get(item.date) ?? []), item]);
  }
  for (const items of map.values()) {
    items.sort((a, b) => Number(b.overdue) - Number(a.overdue) || a.tag.localeCompare(b.tag));
  }
  return map;
}
