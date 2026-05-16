// Armazenamento local offline-first. Sem backend — tudo persiste em localStorage.

export type Sex = "vaca" | "touro";
export type FootKey = "FE" | "FD" | "TE" | "TD";
export type Severity = 0 | 1 | 2 | 3 | 4;
export type Zone = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type LesionCode =
  | "SH" | "SU" | "BU" | "DD" | "HHE" | "J" | "X" | "TS" | "P"
  | "WU" | "TU" | "LB" | "HI" | "FF" | "LM";

export type TreatmentCode =
  | "TRIM" | "ALIVIO"
  | "BLOCO_ON" | "BLOCO_OFF" | "BLOCO_FIX"
  | "BAND_ON" | "BAND_OFF"
  | "SPRAY" | "SCORING"
  | "NADA";

export type CommentCode = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";

export interface DiseaseEntry {
  code: LesionCode;
  severity: Severity; // 0 = não marcado, 1–4 = gravidade crescente
  zones?: Zone[];     // zonas específicas afetadas por esta doença
}

export interface FootEntry {
  foot: FootKey;
  ok: boolean;
  zones?: Zone[];
  diseases?: DiseaseEntry[];
  treatments?: TreatmentCode[];
  comments?: CommentCode[];
  recheck?: boolean;
  recheckDate?: string; // ISO yyyy-mm-dd para o calendário
  resolved?: boolean;
  photo?: string;
}

export interface Visit {
  id: string;
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
  tag: string;
  sex: Sex;
  feet: FootEntry[];
}

export interface FarmConfig {
  farmName: string;
  worker: string;
  configured: boolean;
}

const VISITS_KEY = "casco.visits.v3";
const FARM_KEY = "casco.farm.v1";
const TUTORIAL_KEY = "casco.tutorial.done.v1";

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
  { code: "SH",  name: "SH",  full: "Hemorragia de Sola / Laminite",  emoji: "🟡" },
  { code: "SU",  name: "SU",  full: "Úlcera de Sola",                  emoji: "🔴" },
  { code: "BU",  name: "BU",  full: "Fratura de Sola",                 emoji: "🟠" },
  { code: "WU",  name: "WU",  full: "Úlcera de Parede",                emoji: "🧱" },
  { code: "TU",  name: "TU",  full: "Úlcera da Ponta / Necrose",       emoji: "⚫" },
  { code: "LB",  name: "LB",  full: "Linha Branca",                    emoji: "⬜" },
  { code: "DD",  name: "DD",  full: "Dermatite Digital",               emoji: "🦠" },
  { code: "HHE", name: "HHE", full: "Talão por Lama / Esterco",        emoji: "💧" },
  { code: "HI",  name: "HI",  full: "Hiperplasia Interdigital",        emoji: "🌿" },
  { code: "FF",  name: "FF",  full: "Fleimão / Podridão do Pé",        emoji: "🦨" },
  { code: "J",   name: "J",   full: "Infecção Articular",              emoji: "🔩" },
  { code: "LM",  name: "LM",  full: "Lesão de Membro",                 emoji: "🦵" },
  { code: "TS",  name: "TS",  full: "Sola Fina",                       emoji: "📏" },
  { code: "P",   name: "P",   full: "Perfuração",                      emoji: "📌" },
  { code: "X",   name: "X",   full: "Descarte — Retirar do Lote",      emoji: "❌" },
];

export const TREATMENTS: { code: TreatmentCode; label: string; emoji: string }[] = [
  { code: "TRIM",      label: "Casquear",          emoji: "🔪" },
  { code: "ALIVIO",    label: "Alívio de Carga",   emoji: "⬇️" },
  { code: "BLOCO_ON",  label: "Aplicar Bloco",     emoji: "🟦" },
  { code: "BLOCO_OFF", label: "Remover Bloco",     emoji: "🔲" },
  { code: "BLOCO_FIX", label: "Bloco Mantido",     emoji: "✔️" },
  { code: "BAND_ON",   label: "Curativo",          emoji: "🩹" },
  { code: "BAND_OFF",  label: "Tirar Curativo",    emoji: "✂️" },
  { code: "SPRAY",     label: "Spray / Produto",   emoji: "💧" },
  { code: "SCORING",   label: "Escore DD (M.)",    emoji: "📊" },
  { code: "NADA",      label: "Só Limpou",         emoji: "✅" },
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
  0:  "Sola Central",
  1:  "Ponta do Casco",
  2:  "Parede Frontal Esq.",
  3:  "Parede Frontal Dir.",
  4:  "Sola Posterior Esq.",
  5:  "Sola Posterior Dir.",
  6:  "Talão Esq.",
  7:  "Parede Lateral Esq.",
  8:  "Talão Dir.",
  9:  "Parede Lateral Dir.",
  10: "Bulbo do Talão Esq.",
  11: "Bulbo do Talão Centro",
  12: "Bulbo do Talão Dir.",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  0: "Ausente",
  1: "Leve",
  2: "Médio",
  3: "Grave",
  4: "Muito Grave",
};

// Cor de fundo para zonas no mapa, por gravidade
export const ZONE_SEVERITY_COLOR: Record<Severity, { fill: string; stroke: string; text: string }> = {
  0: { fill: "#e5e7eb", stroke: "#9ca3af", text: "#374151" },
  1: { fill: "#fef9c3", stroke: "#ca8a04", text: "#713f12" },
  2: { fill: "#fed7aa", stroke: "#ea580c", text: "#7c2d12" },
  3: { fill: "#fecaca", stroke: "#dc2626", text: "#7f1d1d" },
  4: { fill: "#7f1d1d", stroke: "#450a0a", text: "#ffffff" },
};

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

function migrateFootEntry(f: any): FootEntry {
  // Migra dados de versões antigas
  const diseases: DiseaseEntry[] = [];
  if (f.diseases) {
    return f as FootEntry;
  }
  if (f.lesion && f.severity !== undefined && (f.severity as number) > 0) {
    const codeMap: Record<string, LesionCode> = {
      DD: "DD", SU: "SU", SB: "SH", WL: "TS", SH: "SH",
      TS: "TS", P: "P", ID: "DD", OUT: "SU", BU: "BU",
    };
    const newCode = codeMap[f.lesion] ?? "SU";
    diseases.push({ code: newCode, severity: f.severity as Severity });
  }
  return {
    foot: f.foot,
    ok: f.ok,
    zones: f.zone !== undefined ? [f.zone as Zone] : f.zones ?? [],
    diseases: diseases.length ? diseases : [],
    treatments: (f.treatments ?? (f.treatment && f.treatment !== "NADA" ? [f.treatment as TreatmentCode] : []))
      .map((c: string) => c === "BLOCO" ? "BLOCO_ON" : c) as TreatmentCode[],
    recheck: f.recheck,
    resolved: f.resolved,
    photo: f.photo,
  };
}

export function loadVisits(): Visit[] {
  if (typeof window === "undefined") return [];
  try {
    const v3Raw = localStorage.getItem(VISITS_KEY);
    if (v3Raw) return JSON.parse(v3Raw);

    // Migrar de versões anteriores
    const legacyKeys = ["casco.visits.v2", "casco.visits.v1"];
    for (const key of legacyKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const legacy: any[] = JSON.parse(raw);
        const migrated: Visit[] = legacy.map((v: any) => ({
          ...v,
          feet: (v.feet || []).map(migrateFootEntry),
        }));
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
  localStorage.setItem(VISITS_KEY, JSON.stringify(v));
}

export function addVisit(v: Visit) {
  const all = loadVisits();
  all.unshift(v);
  saveVisits(all);
}

export function deleteVisit(id: string) {
  saveVisits(loadVisits().filter((v) => v.id !== id));
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
  lastVisit: number;
  totalVisits: number;
  hasRecheck: boolean;
  hasResolved: boolean;
  worstSeverity: Severity;
}[] {
  const visits = loadVisits();
  const map = new Map<string, ReturnType<typeof allAnimals>[number]>();
  for (const v of visits) {
    const key = v.tag.toLowerCase();
    const hasRecheck = v.feet.some((f) => f.recheck);
    const hasResolved = v.feet.some((f) => f.resolved);
    const ws = footsWorstSeverity(v.feet);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        tag: v.tag,
        sex: v.sex,
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
      }
      if (hasRecheck) existing.hasRecheck = true;
      if (hasResolved) existing.hasResolved = true;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.lastVisit - a.lastVisit);
}

export function loadFarm(): FarmConfig {
  if (typeof window === "undefined") return { farmName: "", worker: "", configured: false };
  try {
    return (
      JSON.parse(localStorage.getItem(FARM_KEY) || "null") ?? {
        farmName: "",
        worker: "",
        configured: false,
      }
    );
  } catch {
    return { farmName: "", worker: "", configured: false };
  }
}

export function saveFarm(f: FarmConfig) {
  localStorage.setItem(FARM_KEY, JSON.stringify(f));
}

export function isTutorialDone(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function markTutorialDone() {
  localStorage.setItem(TUTORIAL_KEY, "1");
}

export function footWorstSeverity(foot: FootEntry): Severity {
  if (!foot.diseases?.length) return 0;
  return Math.max(0, ...foot.diseases.map((d) => d.severity)) as Severity;
}

export function footsWorstSeverity(feet: FootEntry[]): Severity {
  return feet.reduce<number>((acc, f) => Math.max(acc, footWorstSeverity(f)), 0) as Severity;
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

// Agrupa animais com recheck ativo por data de revisão (para o calendário)
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
      if (f.recheck && !f.resolved && f.recheckDate) {
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

  const visits: Visit[] = [
    // 1284 — DD + SH, 3 visitas
    { id: uid(), date: mkDate(45), createdAt: mkTs(45), tag: "1284", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "DD", severity: 3, zones: [6, 10] }], treatments: ["SPRAY"] }),
      f("FD"),
      f("TE", { ok: false, diseases: [{ code: "SH", severity: 2, zones: [0] }], treatments: ["TRIM"] }),
      f("TD"),
    ]},
    { id: uid(), date: mkDate(14), createdAt: mkTs(14), tag: "1284", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "DD", severity: 2, zones: [6] }], treatments: ["SPRAY", "BAND_ON"], recheck: true, recheckDate: mkDate(-7) }),
      f("FD"),
      f("TE", { ok: false, diseases: [{ code: "SH", severity: 1, zones: [0, 4] }], treatments: ["TRIM"] }),
      f("TD"),
    ]},
    { id: uid(), date: mkDate(0), createdAt: mkTs(0, -3600000), tag: "1284", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "DD", severity: 1, zones: [6] }], treatments: ["SPRAY"] }),
      f("FD"), f("TE"), f("TD"),
    ]},

    // 502 — SU grave, 2 visitas, curada
    { id: uid(), date: mkDate(30), createdAt: mkTs(30), tag: "502", sex: "vaca", feet: [
      f("FE"),
      f("FD", { ok: false, diseases: [{ code: "SU", severity: 4, zones: [5] }], treatments: ["TRIM", "BLOCO_ON", "BAND_ON"] }),
      f("TE"),
      f("TD", { ok: false, diseases: [{ code: "SU", severity: 3, zones: [5] }], treatments: ["TRIM", "BLOCO_ON"] }),
    ]},
    { id: uid(), date: mkDate(7), createdAt: mkTs(7), tag: "502", sex: "vaca", feet: [
      f("FE"),
      f("FD", { ok: false, diseases: [{ code: "SU", severity: 1, zones: [5] }], treatments: ["BLOCO_OFF", "SPRAY"], resolved: true }),
      f("TE"),
      f("TD", { ok: false, diseases: [{ code: "SU", severity: 1, zones: [5] }], treatments: ["SPRAY"], resolved: true }),
    ]},

    // 3871 — DD + HHE touro grave
    { id: uid(), date: mkDate(5), createdAt: mkTs(5), tag: "3871", sex: "touro", feet: [
      f("FE", { ok: false, diseases: [{ code: "DD", severity: 2, zones: [6, 10] }, { code: "HHE", severity: 2, zones: [10, 11] }], treatments: ["SPRAY", "SCORING"] }),
      f("FD", { ok: false, diseases: [{ code: "DD", severity: 3, zones: [8, 12] }, { code: "HHE", severity: 3, zones: [11, 12] }], treatments: ["SPRAY", "SCORING"] }),
      f("TE"), f("TD"),
    ]},

    // 94 — LB
    { id: uid(), date: mkDate(20), createdAt: mkTs(20), tag: "94", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "LB", severity: 2, zones: [2, 3] }], treatments: ["TRIM"] }),
      f("FD"), f("TE"), f("TD"),
    ]},

    // 2210 — FF grave, recheck
    { id: uid(), date: mkDate(3), createdAt: mkTs(3), tag: "2210", sex: "vaca", feet: [
      f("FE"), f("FD"),
      f("TE", { ok: false, diseases: [{ code: "FF", severity: 4, zones: [0, 6, 7] }], treatments: ["TRIM", "BAND_ON"], recheck: true, recheckDate: mkDate(-2) }),
      f("TD", { ok: false, diseases: [{ code: "DD", severity: 2, zones: [8] }], treatments: ["SPRAY"] }),
    ]},

    // 765 — TS
    { id: uid(), date: mkDate(10), createdAt: mkTs(10), tag: "765", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "TS", severity: 1, zones: [0] }], treatments: ["ALIVIO", "BLOCO_ON"] }),
      f("FD", { ok: false, diseases: [{ code: "TS", severity: 1, zones: [0] }], treatments: ["ALIVIO", "BLOCO_ON"] }),
      f("TE"), f("TD"),
    ]},

    // 1033 — HI recheck
    { id: uid(), date: mkDate(12), createdAt: mkTs(12), tag: "1033", sex: "vaca", feet: [
      f("FE"), f("FD"),
      f("TE", { ok: false, diseases: [{ code: "HI", severity: 3, zones: [0] }], treatments: ["TRIM", "BAND_ON"], recheck: true, recheckDate: mkDate(-5) }),
      f("TD"),
    ]},

    // 487 — WU
    { id: uid(), date: mkDate(8), createdAt: mkTs(8), tag: "487", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "WU", severity: 2, zones: [7] }], treatments: ["TRIM", "SPRAY"] }),
      f("FD"),
      f("TE", { ok: false, diseases: [{ code: "WU", severity: 2, zones: [9] }], treatments: ["TRIM", "SPRAY"] }),
      f("TD"),
    ]},

    // 3001 — descarte X + J
    { id: uid(), date: mkDate(1), createdAt: mkTs(1), tag: "3001", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "X", severity: 4, zones: [0, 1, 2, 3] }, { code: "J", severity: 4, zones: [1] }], treatments: ["NADA"] }),
      f("FD"), f("TE"), f("TD"),
    ]},

    // 88 — Tudo bom
    { id: uid(), date: mkDate(2), createdAt: mkTs(2), tag: "88", sex: "vaca", feet: [
      f("FE"), f("FD"), f("TE"), f("TD"),
    ]},

    // 2756 — TU ponta recheck
    { id: uid(), date: mkDate(6), createdAt: mkTs(6), tag: "2756", sex: "vaca", feet: [
      f("FE"),
      f("FD", { ok: false, diseases: [{ code: "TU", severity: 3, zones: [1] }], treatments: ["TRIM", "BAND_ON"], recheck: true, recheckDate: mkDate(-3) }),
      f("TE"),
      f("TD", { ok: false, diseases: [{ code: "TU", severity: 2, zones: [1] }], treatments: ["TRIM"] }),
    ]},

    // 391 — P perfuração
    { id: uid(), date: mkDate(15), createdAt: mkTs(15), tag: "391", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "P", severity: 3, zones: [0] }], treatments: ["TRIM", "BAND_ON", "BLOCO_ON"] }),
      f("FD"), f("TE"), f("TD"),
    ]},

    // 1100 — SH laminite 4 pés + recheck atrasado (2 dias atrás)
    { id: uid(), date: mkDate(4), createdAt: mkTs(4), tag: "1100", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "SH", severity: 2, zones: [0, 4] }], treatments: ["ALIVIO"], recheck: true, recheckDate: mkDate(2) }),
      f("FD", { ok: false, diseases: [{ code: "SH", severity: 2, zones: [0, 5] }], treatments: ["ALIVIO"] }),
      f("TE", { ok: false, diseases: [{ code: "SH", severity: 1, zones: [0] }], treatments: ["ALIVIO"] }),
      f("TD", { ok: false, diseases: [{ code: "SH", severity: 1, zones: [0] }], treatments: ["ALIVIO"] }),
    ]},

    // 654 — BU
    { id: uid(), date: mkDate(9), createdAt: mkTs(9), tag: "654", sex: "vaca", feet: [
      f("FE"),
      f("FD", { ok: false, diseases: [{ code: "BU", severity: 2, zones: [5] }], treatments: ["TRIM", "BLOCO_ON"] }),
      f("TE"), f("TD"),
    ]},

    // 2009 — LM + D3
    { id: uid(), date: mkDate(11), createdAt: mkTs(11), tag: "2009", sex: "vaca", feet: [
      f("FE", { ok: false, diseases: [{ code: "LM", severity: 2, zones: [7] }], treatments: ["SPRAY"], comments: ["D3"] }),
      f("FD"), f("TE"), f("TD"),
    ]},
  ];

  saveVisits(replace ? visits : [...visits, ...existing]);
}
