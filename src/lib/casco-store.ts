// Armazenamento local simples para o caderninho de casco.
// Sem backend nesta primeira versão — tudo persiste em localStorage.

export type Sex = "vaca" | "touro";
export type FootKey = "FE" | "FD" | "TE" | "TD"; // Frente Esq/Dir, Trás Esq/Dir
export type Severity = 1 | 2 | 3 | 4;
export type LesionCode = "DD" | "SS" | "UL" | "LB" | "FI" | "OUT";
export type Treatment = "BLOCO" | "CURATIVO" | "SPRAY" | "NADA";

export interface FootEntry {
  foot: FootKey;
  ok: boolean;
  lesion?: LesionCode;
  severity?: Severity;
  treatment?: Treatment;
  photo?: string; // dataURL
}

export interface Visit {
  id: string;
  date: string; // ISO yyyy-mm-dd
  createdAt: number;
  tag: string; // brinco
  sex: Sex;
  feet: FootEntry[];
}

export interface FarmConfig {
  farmName: string;
  worker: string;
  configured: boolean;
}

const VISITS_KEY = "casco.visits.v1";
const FARM_KEY = "casco.farm.v1";

export const FOOT_LABEL: Record<FootKey, string> = {
  FE: "Frente Esq.",
  FD: "Frente Dir.",
  TE: "Trás Esq.",
  TD: "Trás Dir.",
};

export const LESIONS: { code: LesionCode; name: string; full: string }[] = [
  { code: "DD", name: "DD", full: "Dermatite Digital" },
  { code: "SS", name: "SOLA", full: "Úlcera de sola" },
  { code: "UL", name: "LINHA", full: "Doença da linha branca" },
  { code: "LB", name: "LIMAX", full: "Hiperplasia / Limax" },
  { code: "FI", name: "FISSURA", full: "Fissura / Erosão" },
  { code: "OUT", name: "OUTRO", full: "Outro" },
];

export const TREATMENTS: { code: Treatment; label: string }[] = [
  { code: "BLOCO", label: "Bloco" },
  { code: "CURATIVO", label: "Curativo" },
  { code: "SPRAY", label: "Spray" },
  { code: "NADA", label: "Nada" },
];

export function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function loadVisits(): Visit[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(VISITS_KEY) || "[]");
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

export function severityLabel(s: Severity) {
  return ["", "Leve", "Médio", "Grave", "Muito grave"][s];
}

export function severityBucket(s?: Severity): "leve" | "medio" | "grave" | null {
  if (!s) return null;
  if (s === 1) return "leve";
  if (s === 2) return "medio";
  return "grave";
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
