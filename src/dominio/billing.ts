import type { DiseaseDefinition, FootKey, TacoAction, Visit } from "./casco-store";

export interface PricingConfig {
  preventive: number;
  preventiveTiers: Array<{ min: number; max?: number; price: number }>;
  clinicalVisit: number;
  bandage: number;
  tacoApply: number;
  tacoMaintain: number;
  tacoRemove: number;
  diseases: Record<string, number>;
  travelPerKm: number;
}

export type BillingLineKind = "preventive" | "clinical" | "bandage" | "taco" | "disease" | "travel";

export interface BillingLine {
  key: string;
  kind: BillingLineKind;
  label: string;
  quantity: number;
  unitPrice: number;
  total: number;
  foot?: FootKey;
  diseaseCode?: string;
}

export interface VisitBillingSnapshot {
  currency: "BRL";
  capturedAt: string;
  lines: BillingLine[];
  total: number;
}

export interface VisitBillingResult extends VisitBillingSnapshot {
  estimated: boolean;
}

export interface BillingSummary {
  visits: number;
  total: number;
  averagePerVisit: number;
  estimatedVisits: number;
  lines: Array<{
    key: string;
    label: string;
    kind: BillingLineKind;
    quantity: number;
    total: number;
  }>;
}

export interface EmployeeBillingSummary extends BillingSummary {
  employeeId?: string;
  employeeName: string;
}

export interface MonthlyBillingPoint {
  prefix: string;
  label: string;
  total: number;
  visits: number;
}

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  preventive: 0,
  preventiveTiers: [],
  clinicalVisit: 0,
  bandage: 0,
  tacoApply: 0,
  tacoMaintain: 0,
  tacoRemove: 0,
  diseases: {},
  travelPerKm: 0,
};

export const HULLSJOB_DEFAULT_PRICING: PricingConfig = {
  preventive: 80,
  preventiveTiers: [
    { min: 1, max: 20, price: 80 },
    { min: 21, max: 40, price: 65 },
    { min: 41, price: 60 },
  ],
  clinicalVisit: 0,
  bandage: 35,
  tacoApply: 45,
  tacoMaintain: 0,
  tacoRemove: 0,
  diseases: { DD: 15 },
  travelPerKm: 3.3,
};

const TACO_LABELS: Record<TacoAction, string> = {
  apply: "Colocação de taco",
  maintain: "Manutenção de taco",
  remove: "Retirada de taco",
};

function money(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.round(numeric * 100) / 100;
}

function line(input: Omit<BillingLine, "quantity" | "total">): BillingLine {
  const unitPrice = money(input.unitPrice);
  return { ...input, unitPrice, quantity: 1, total: unitPrice };
}

export function normalizePricingConfig(value?: Partial<PricingConfig> | null): PricingConfig {
  return {
    preventive: money(value?.preventive),
    preventiveTiers: Array.isArray(value?.preventiveTiers)
      ? value.preventiveTiers
          .map((tier) => ({
            min: Math.max(1, Math.round(Number(tier.min) || 1)),
            max: tier.max ? Math.max(1, Math.round(Number(tier.max))) : undefined,
            price: money(tier.price),
          }))
          .sort((left, right) => left.min - right.min)
      : [],
    clinicalVisit: money(value?.clinicalVisit),
    bandage: money(value?.bandage),
    tacoApply: money(value?.tacoApply),
    tacoMaintain: money(value?.tacoMaintain),
    tacoRemove: money(value?.tacoRemove),
    diseases: Object.fromEntries(
      Object.entries(value?.diseases ?? {}).map(([code, price]) => [code, money(price)]),
    ),
    travelPerKm: money(value?.travelPerKm),
  };
}

export function pricingHasValues(pricing: PricingConfig) {
  return (
    pricing.preventive > 0 ||
    pricing.preventiveTiers.some((tier) => tier.price > 0) ||
    pricing.clinicalVisit > 0 ||
    pricing.bandage > 0 ||
    pricing.tacoApply > 0 ||
    pricing.tacoMaintain > 0 ||
    pricing.tacoRemove > 0 ||
    Object.values(pricing.diseases).some((price) => price > 0) ||
    pricing.travelPerKm > 0
  );
}

export function preventiveUnitPrice(pricing: PricingConfig, quantity = 1) {
  const normalizedQuantity = Math.max(1, Math.round(quantity));
  const tier = pricing.preventiveTiers.find(
    (item) => normalizedQuantity >= item.min && (!item.max || normalizedQuantity <= item.max),
  );
  return tier?.price ?? pricing.preventive;
}

function diseaseName(code: string, catalog: DiseaseDefinition[]) {
  return catalog.find((disease) => disease.code === code)?.full ?? code;
}

export function billingLinesForVisit(
  visit: Visit,
  pricingInput: PricingConfig,
  catalog: DiseaseDefinition[],
): BillingLine[] {
  const pricing = normalizePricingConfig(pricingInput);
  const lines: BillingLine[] = [];

  if (visit.preventivo) {
    lines.push(
      line({
        key: "preventive",
        kind: "preventive",
        label: "Casqueamento preventivo",
        unitPrice: preventiveUnitPrice(pricing, visit.preventiveBatchSize),
      }),
    );
  } else {
    lines.push(
      line({
        key: "clinical",
        kind: "clinical",
        label: "Atendimento clínico",
        unitPrice: pricing.clinicalVisit,
      }),
    );
  }

  for (const foot of visit.feet) {
    for (const disease of foot.diseases ?? []) {
      if (disease.severity <= 0) continue;
      lines.push(
        line({
          key: `disease:${disease.code}`,
          kind: "disease",
          label: diseaseName(disease.code, catalog),
          unitPrice: pricing.diseases[disease.code] ?? 0,
          foot: foot.foot,
          diseaseCode: disease.code,
        }),
      );
    }

    if ((foot.treatments ?? []).includes("BAND_ON") && foot.taco?.action !== "apply") {
      lines.push(
        line({
          key: "bandage",
          kind: "bandage",
          label: "Curativo",
          unitPrice: pricing.bandage,
          foot: foot.foot,
        }),
      );
    }

    if (foot.taco) {
      const price =
        foot.taco.action === "apply"
          ? pricing.tacoApply
          : foot.taco.action === "maintain"
            ? pricing.tacoMaintain
            : pricing.tacoRemove;
      lines.push(
        line({
          key: `taco:${foot.taco.action}`,
          kind: "taco",
          label: TACO_LABELS[foot.taco.action],
          unitPrice: price,
          foot: foot.foot,
        }),
      );
    }
  }

  if ((visit.travelKm ?? 0) > 0 && pricing.travelPerKm > 0) {
    const quantity = Math.round((visit.travelKm ?? 0) * 10) / 10;
    const unitPrice = pricing.travelPerKm;
    lines.push({
      key: "travel",
      kind: "travel",
      label: `Deslocamento (${quantity.toLocaleString("pt-BR")} km)`,
      quantity,
      unitPrice,
      total: money(quantity * unitPrice),
    });
  }

  return lines;
}

export function createVisitBillingSnapshot(
  visit: Visit,
  pricing: PricingConfig,
  catalog: DiseaseDefinition[],
  capturedAt = new Date().toISOString(),
): VisitBillingSnapshot | undefined {
  const normalized = normalizePricingConfig(pricing);
  if (!pricingHasValues(normalized)) return undefined;
  const lines = billingLinesForVisit(visit, normalized, catalog);
  return {
    currency: "BRL",
    capturedAt,
    lines,
    total: money(lines.reduce((total, item) => total + item.total, 0)),
  };
}

export function billingForVisit(
  visit: Visit,
  pricing: PricingConfig,
  catalog: DiseaseDefinition[],
): VisitBillingResult {
  if (visit.billing) return { ...visit.billing, estimated: false };
  const lines = billingLinesForVisit(visit, pricing, catalog);
  return {
    currency: "BRL",
    capturedAt: new Date(visit.completedAt ?? visit.createdAt).toISOString(),
    lines,
    total: money(lines.reduce((total, item) => total + item.total, 0)),
    estimated: true,
  };
}

function visibleVisit(visit: Visit) {
  return visit.status === undefined || visit.status === "active";
}

export function billingSummaryFromVisits(
  visits: Visit[],
  pricing: PricingConfig,
  catalog: DiseaseDefinition[],
): BillingSummary {
  const relevant = visits.filter(visibleVisit);
  const aggregated = new Map<string, BillingSummary["lines"][number]>();
  let total = 0;
  let estimatedVisits = 0;

  for (const visit of relevant) {
    const billing = billingForVisit(visit, pricing, catalog);
    total += billing.total;
    if (billing.estimated) estimatedVisits += 1;
    for (const item of billing.lines) {
      const current = aggregated.get(item.key);
      aggregated.set(item.key, {
        key: item.key,
        label: item.label,
        kind: item.kind,
        quantity: (current?.quantity ?? 0) + item.quantity,
        total: money((current?.total ?? 0) + item.total),
      });
    }
  }

  const normalizedTotal = money(total);
  return {
    visits: relevant.length,
    total: normalizedTotal,
    averagePerVisit: relevant.length > 0 ? money(normalizedTotal / relevant.length) : 0,
    estimatedVisits,
    lines: Array.from(aggregated.values()).sort(
      (left, right) => right.total - left.total || left.label.localeCompare(right.label, "pt-BR"),
    ),
  };
}

export function employeeBillingSummaries(
  visits: Visit[],
  pricing: PricingConfig,
  catalog: DiseaseDefinition[],
): EmployeeBillingSummary[] {
  const groups = new Map<string, { employeeId?: string; employeeName: string; visits: Visit[] }>();
  for (const visit of visits.filter(visibleVisit)) {
    const employeeName = visit.employee_name ?? visit.visitante_nome ?? "Sem responsável";
    const key = visit.employee_id ?? `name:${employeeName.toLocaleLowerCase("pt-BR")}`;
    const group = groups.get(key) ?? { employeeId: visit.employee_id, employeeName, visits: [] };
    group.visits.push(visit);
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((group) => ({
      employeeId: group.employeeId,
      employeeName: group.employeeName,
      ...billingSummaryFromVisits(group.visits, pricing, catalog),
    }))
    .sort(
      (left, right) =>
        right.total - left.total || left.employeeName.localeCompare(right.employeeName),
    );
}

export function monthlyBillingSeries(
  visits: Visit[],
  pricing: PricingConfig,
  catalog: DiseaseDefinition[],
  referenceDate: string,
  months = 6,
): MonthlyBillingPoint[] {
  const reference = new Date(`${referenceDate.slice(0, 7)}-01T12:00:00`);
  return Array.from({ length: Math.max(1, months) }, (_, index) => {
    const date = new Date(reference);
    date.setMonth(date.getMonth() - (months - index - 1));
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const monthVisits = visits.filter(
      (visit) => visibleVisit(visit) && visit.date.startsWith(prefix),
    );
    return {
      prefix,
      label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""),
      total: billingSummaryFromVisits(monthVisits, pricing, catalog).total,
      visits: monthVisits.length,
    };
  });
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
