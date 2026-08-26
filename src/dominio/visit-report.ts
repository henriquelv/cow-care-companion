import {
  COMMENTS,
  FOOT_LABEL,
  SEVERITY_LABEL,
  TREATMENTS,
  ZONE_LABEL,
  dateAfterMonths,
  diseaseDefinition,
  footWorstSeverity,
  tacoLabel,
  footsWorstSeverity,
  visitBelongsToEmployee,
  visitHasTaco,
  visitHasActiveProblem,
  visitIsFinalized,
  todayISO,
  type AgendaItem,
  type DiseaseDefinition,
  type FootKey,
  type LesionCode,
  type Severity,
  type Visit,
} from "@/dominio/casco-store";
import {
  billingForVisit,
  billingSummaryFromVisits,
  employeeBillingSummaries,
  formatCurrency,
  monthlyBillingSeries,
  normalizePricingConfig,
  type PricingConfig,
} from "@/dominio/billing";

export type VisitReportStatus =
  | "all"
  | "normal"
  | "preventive"
  | "problem"
  | "light"
  | "moderate"
  | "severe"
  | "recheck"
  | "taco";

export interface VisitReportFilters {
  farmId?: string;
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  employeeName?: string;
  lote?: string;
  status?: VisitReportStatus;
}

export interface VisitReportMetrics {
  visits: number;
  animals: number;
  preventive: number;
  normal: number;
  withoutProblem: number;
  withProblem: number;
  light: number;
  moderate: number;
  severe: number;
  reviewsPerformed: number;
  scheduledReviews: number;
  withTaco: number;
  tacosApplied: number;
}

export interface EmployeeReportRow extends VisitReportMetrics {
  employeeName: string;
}

export interface VisitReportCompositionRow {
  key: "preventive" | "problem" | "normal" | "recheck" | "taco";
  label: string;
  visits: number;
  animals: number;
  overlaps: boolean;
}

export interface OperationalDiseaseBreakdown {
  code: LesionCode;
  label: string;
  records: number;
  animals: number;
}

export interface OperationalFootBreakdown {
  foot: FootKey;
  label: string;
  records: number;
  animals: number;
}

export interface OperationalAnimalBreakdown {
  tag: string;
  visits: number;
  problemVisits: number;
  latestDate: string;
}

export interface OperationalBreakdown {
  diagnoses: number;
  problemFeet: number;
  severity: { normal: number; light: number; moderate: number; severe: number; total: number };
  diseases: OperationalDiseaseBreakdown[];
  feet: OperationalFootBreakdown[];
  animals: OperationalAnimalBreakdown[];
}

export type MonthlyEvolutionRow = MonthlyMetricSet;

export interface MonthlyMetricSet {
  prefix: string;
  label: string;
  visits: number;
  animals: number;
  preventive: number;
  withProblem: number;
  diagnoses: number;
}

export interface MonthlyComparison {
  current: MonthlyMetricSet;
  previous: MonthlyMetricSet;
}

export type FootReportStatus = "unrecorded" | "normal" | "problem" | "resolved" | "taco";

export interface FootReportCell {
  foot: FootKey;
  severity: Severity;
  status: FootReportStatus;
  text: string;
}

const REPORT_FOOT_ORDER: FootKey[] = ["FE", "FD", "TE", "TD"];

function hasProblem(visit: Visit) {
  return visitHasActiveProblem(visit);
}

function hasRecheck(visit: Visit) {
  return visit.feet.some((foot) => foot.recheck && !foot.resolved && !foot.data_liberacao);
}

export function filterVisitsForReport(visits: Visit[], filters: VisitReportFilters) {
  return visits
    .filter(visitIsFinalized)
    .filter((visit) => !filters.farmId || !visit.farm_id || visit.farm_id === filters.farmId)
    .filter(
      (visit) =>
        !filters.employeeId ||
        visitBelongsToEmployee(visit, filters.employeeId, filters.employeeName),
    )
    .filter((visit) => !filters.dateFrom || visit.date >= filters.dateFrom)
    .filter((visit) => !filters.dateTo || visit.date <= filters.dateTo)
    .filter((visit) => !filters.lote || visit.lote === filters.lote)
    .filter((visit) => {
      switch (filters.status ?? "all") {
        case "normal":
          return !hasProblem(visit) && !visit.preventivo;
        case "preventive":
          return visit.preventivo === true && !hasProblem(visit);
        case "problem":
          return hasProblem(visit);
        case "light":
          return footsWorstSeverity(visit.feet) === 1;
        case "moderate":
          return footsWorstSeverity(visit.feet) === 2;
        case "severe":
          return footsWorstSeverity(visit.feet) === 3;
        case "recheck":
          return hasRecheck(visit);
        case "taco":
          return visitHasTaco(visit);
        default:
          return true;
      }
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function visitReportMetrics(visits: Visit[], agenda: AgendaItem[] = []): VisitReportMetrics {
  const visibleVisits = visits.filter(visitIsFinalized);
  return {
    visits: visibleVisits.length,
    animals: new Set(visibleVisits.map((visit) => visit.tag.trim().toLocaleLowerCase("pt-BR")))
      .size,
    preventive: visibleVisits.filter((visit) => visit.preventivo && !hasProblem(visit)).length,
    normal: visibleVisits.filter((visit) => !hasProblem(visit) && !visit.preventivo).length,
    withoutProblem: visibleVisits.filter((visit) => !hasProblem(visit)).length,
    withProblem: visibleVisits.filter(hasProblem).length,
    light: visibleVisits.filter((visit) => footsWorstSeverity(visit.feet) === 1).length,
    moderate: visibleVisits.filter((visit) => footsWorstSeverity(visit.feet) === 2).length,
    severe: visibleVisits.filter((visit) => footsWorstSeverity(visit.feet) === 3).length,
    reviewsPerformed: visibleVisits.filter((visit) =>
      visit.feet.some((foot) => (foot.numero_revisoes ?? 0) > 1),
    ).length,
    scheduledReviews: agenda.filter((item) =>
      visibleVisits.some((visit) => visit.id === item.visit_id),
    ).length,
    withTaco: visibleVisits.filter(visitHasTaco).length,
    tacosApplied: visibleVisits.reduce(
      (count, visit) => count + visit.feet.filter((foot) => foot.taco?.action === "apply").length,
      0,
    ),
  };
}

export function visitReportComposition(visits: Visit[]): VisitReportCompositionRow[] {
  const visibleVisits = visits.filter(visitIsFinalized);
  const rows: Array<{
    key: VisitReportCompositionRow["key"];
    label: string;
    overlaps: boolean;
    matches: (visit: Visit) => boolean;
  }> = [
    {
      key: "preventive",
      label: "Preventivo sem problema",
      overlaps: false,
      matches: (visit) => visit.preventivo === true && !hasProblem(visit),
    },
    {
      key: "problem",
      label: "Clínico com doença ou taco ativo",
      overlaps: false,
      matches: hasProblem,
    },
    {
      key: "normal",
      label: "Normal, não preventivo",
      overlaps: false,
      matches: (visit) => !visit.preventivo && !hasProblem(visit),
    },
    {
      key: "recheck",
      label: "Com revisão marcada",
      overlaps: true,
      matches: hasRecheck,
    },
    {
      key: "taco",
      label: "Com ação de taco",
      overlaps: true,
      matches: visitHasTaco,
    },
  ];

  return rows.map((row) => {
    const matchingVisits = visibleVisits.filter(row.matches);
    return {
      key: row.key,
      label: row.label,
      visits: matchingVisits.length,
      animals: new Set(matchingVisits.map((visit) => visit.tag.trim().toLocaleLowerCase("pt-BR")))
        .size,
      overlaps: row.overlaps,
    };
  });
}

export function operationalBreakdownFromVisits(visits: Visit[]): OperationalBreakdown {
  const visibleVisits = visits.filter(visitIsFinalized);
  const diseases = new Map<
    LesionCode,
    { code: LesionCode; label: string; records: number; animals: Set<string> }
  >();
  const feet = new Map<
    FootKey,
    { foot: FootKey; label: string; records: number; animals: Set<string> }
  >();
  const animals = new Map<string, OperationalAnimalBreakdown>();
  let diagnoses = 0;
  let problemFeet = 0;
  const severity = { normal: 0, light: 0, moderate: 0, severe: 0, total: 0 };

  for (const visit of visibleVisits) {
    const normalizedTag = visit.tag.trim().toLocaleLowerCase("pt-BR");
    const animal = animals.get(normalizedTag) ?? {
      tag: visit.tag.trim(),
      visits: 0,
      problemVisits: 0,
      latestDate: visit.date,
    };
    animal.visits += 1;
    if (hasProblem(visit)) animal.problemVisits += 1;
    if (visit.date > animal.latestDate) animal.latestDate = visit.date;
    animals.set(normalizedTag, animal);

    for (const foot of visit.feet) {
      const activeDiseases = (foot.diseases ?? []).filter((disease) => disease.severity > 0);
      const footSeverity = activeDiseases.reduce<Severity>(
        (worst, disease) => Math.max(worst, disease.severity) as Severity,
        0,
      );
      severity.total += 1;
      if (footSeverity === 0) severity.normal += 1;
      if (footSeverity === 1) severity.light += 1;
      if (footSeverity === 2) severity.moderate += 1;
      if (footSeverity === 3) severity.severe += 1;
      const hasRecordedProblem = activeDiseases.length > 0 || Boolean(foot.taco);
      if (hasRecordedProblem) {
        problemFeet += 1;
        const row = feet.get(foot.foot) ?? {
          foot: foot.foot,
          label: FOOT_LABEL[foot.foot],
          records: 0,
          animals: new Set<string>(),
        };
        row.records += 1;
        row.animals.add(normalizedTag);
        feet.set(foot.foot, row);
      }

      for (const disease of activeDiseases) {
        diagnoses += 1;
        const definition = diseaseDefinition(disease.code);
        const row = diseases.get(disease.code) ?? {
          code: disease.code,
          label: definition?.full ?? disease.code,
          records: 0,
          animals: new Set<string>(),
        };
        row.records += 1;
        row.animals.add(normalizedTag);
        diseases.set(disease.code, row);
      }
    }
  }

  return {
    diagnoses,
    problemFeet,
    severity,
    diseases: Array.from(diseases.values())
      .map((row) => ({ ...row, animals: row.animals.size }))
      .sort((left, right) => right.records - left.records || left.label.localeCompare(right.label)),
    feet: (["FE", "FD", "TE", "TD"] as FootKey[]).map((foot) => {
      const row = feet.get(foot);
      return {
        foot,
        label: FOOT_LABEL[foot],
        records: row?.records ?? 0,
        animals: row?.animals.size ?? 0,
      };
    }),
    animals: Array.from(animals.values()).sort(
      (left, right) =>
        right.visits - left.visits ||
        right.problemVisits - left.problemVisits ||
        left.tag.localeCompare(right.tag, "pt-BR"),
    ),
  };
}

function monthMetricSet(visits: Visit[], prefix: string): MonthlyMetricSet {
  const monthVisits = visits.filter(
    (visit) => visitIsFinalized(visit) && visit.date.startsWith(prefix),
  );
  const metrics = visitReportMetrics(monthVisits);
  const breakdown = operationalBreakdownFromVisits(monthVisits);
  const date = new Date(`${prefix}-01T12:00:00`);
  return {
    prefix,
    label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    visits: metrics.visits,
    animals: metrics.animals,
    preventive: metrics.preventive,
    withProblem: metrics.withProblem,
    diagnoses: breakdown.diagnoses,
  };
}

export function monthlyComparisonFromVisits(
  visits: Visit[],
  referenceDate: string,
): MonthlyComparison {
  const currentPrefix = referenceDate.slice(0, 7);
  const previousDate = new Date(`${currentPrefix}-01T12:00:00`);
  previousDate.setMonth(previousDate.getMonth() - 1);
  const previousPrefix = `${previousDate.getFullYear()}-${String(previousDate.getMonth() + 1).padStart(2, "0")}`;
  return {
    current: monthMetricSet(visits, currentPrefix),
    previous: monthMetricSet(visits, previousPrefix),
  };
}

export function sixMonthEvolutionFromVisits(
  visits: Visit[],
  referenceDate: string,
): MonthlyEvolutionRow[] {
  const reference = new Date(`${referenceDate.slice(0, 7)}-01T12:00:00`);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(reference);
    date.setMonth(reference.getMonth() - (5 - index));
    const prefix = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return monthMetricSet(visits, prefix);
  });
}

export function employeeReportBreakdown(visits: Visit[]): EmployeeReportRow[] {
  const groups = new Map<string, { name: string; visits: Visit[] }>();
  for (const visit of visits.filter(visitIsFinalized)) {
    const name = visit.employee_name?.trim() || visit.visitante_nome?.trim() || "Sem responsável";
    const key = visit.employee_id?.trim() || name.toLocaleLowerCase("pt-BR");
    const group = groups.get(key) ?? { name, visits: [] };
    group.visits.push(visit);
    groups.set(key, group);
  }
  return Array.from(groups.values())
    .map((group) => ({ employeeName: group.name, ...visitReportMetrics(group.visits) }))
    .sort((left, right) => left.employeeName.localeCompare(right.employeeName, "pt-BR"));
}

function formatShortDate(value?: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

export function visitFootReportCells(visit: Visit): FootReportCell[] {
  return REPORT_FOOT_ORDER.map((footKey) => {
    const foot = visit.feet.find((entry) => entry.foot === footKey);
    if (!foot) {
      return { foot: footKey, severity: 0, status: "unrecorded", text: "SEM REGISTRO" };
    }

    const severity = footWorstSeverity(foot);
    const activeDisease = !foot.resolved && !foot.data_liberacao && !foot.ok && severity > 0;
    const status: FootReportStatus =
      foot.resolved || Boolean(foot.data_liberacao)
        ? "resolved"
        : activeDisease
          ? "problem"
          : foot.taco
            ? "taco"
            : "normal";
    const lines: string[] = [];

    if (status === "normal") {
      lines.push(visit.preventivo ? "CASCO NORMAL · PREVENTIVO" : "CASCO NORMAL");
    } else if (status === "resolved") {
      lines.push("CURADO / LIBERADO");
    } else if (status === "taco") {
      lines.push("SEM LESÃO ATIVA");
    }

    for (const disease of foot.diseases ?? []) {
      if (disease.severity <= 0) continue;
      const definition = diseaseDefinition(disease.code);
      lines.push(
        `${definition?.full ?? disease.code} · G${disease.severity} ${SEVERITY_LABEL[disease.severity]}`,
      );
    }

    const zones = foot.zones ?? [];
    if (zones.length > 0) {
      lines.push(`Região: ${zones.map((zone) => ZONE_LABEL[zone]).join(", ")}`);
    }

    const treatments = (foot.treatments ?? [])
      .map((code) => TREATMENTS.find((treatment) => treatment.code === code)?.label)
      .filter((label): label is string => Boolean(label));
    if (treatments.length > 0) lines.push(`Trat.: ${treatments.join(", ")}`);
    if (foot.taco) lines.push(`Taco: ${tacoLabel(foot.taco)}`);

    const comments = (foot.comments ?? [])
      .map((code) => COMMENTS.find((comment) => comment.code === code)?.label)
      .filter((label): label is string => Boolean(label));
    if (comments.length > 0) lines.push(`Obs.: ${comments.join(", ")}`);
    if (foot.nota?.trim()) lines.push(`Nota: ${foot.nota.trim()}`);

    if (foot.recheck && foot.recheckDate) {
      const count = foot.revisoes_necessarias ?? 1;
      const interval = foot.intervalo_revisao_dias;
      lines.push(
        interval
          ? `Revisão: ${count}x a cada ${interval} dias · próxima ${formatShortDate(foot.recheckDate)}`
          : `Revisão: ${formatShortDate(foot.recheckDate)}`,
      );
    }
    if (foot.data_liberacao) lines.push(`Liberação: ${formatShortDate(foot.data_liberacao)}`);

    return { foot: footKey, severity, status, text: lines.join("\n") || "SEM INFORMAÇÃO" };
  });
}

function reportStatusLabel(status?: VisitReportStatus) {
  const labels: Record<VisitReportStatus, string> = {
    all: "Todos os atendimentos",
    normal: "Sem lesão, não preventivo",
    preventive: "Preventivo sem lesão",
    problem: "Com problema",
    light: "Problema leve (G1)",
    moderate: "Problema moderado (G2)",
    severe: "Problema grave (G3)",
    recheck: "Com revisão marcada",
    taco: "Com taco",
  };
  return labels[status ?? "all"];
}

export async function exportVisitsPdf(input: {
  visits: Visit[];
  agenda?: AgendaItem[];
  farmName: string;
  reportTitle: string;
  scopeLabel?: string;
  includeEmployeeBreakdown?: boolean;
  pricing?: PricingConfig;
  catalog?: DiseaseDefinition[];
  filters?: VisitReportFilters;
  reportType?: "client" | "internal";
  includeValues?: boolean;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const visits = filterVisitsForReport(input.visits, input.filters ?? {});
  const metrics = visitReportMetrics(visits, input.agenda ?? []);
  const pricing = normalizePricingConfig(input.pricing);
  const billingCatalog =
    input.catalog ??
    Array.from(
      new Set(
        visits.flatMap((visit) =>
          visit.feet.flatMap((foot) => (foot.diseases ?? []).map((disease) => disease.code)),
        ),
      ),
    ).flatMap((code) => {
      const definition = diseaseDefinition(code);
      return definition ? [definition] : [];
    });
  const showValues = Boolean(input.includeValues && input.pricing);
  const financial = billingSummaryFromVisits(visits, pricing, billingCatalog);
  const financialEmployees = employeeBillingSummaries(visits, pricing, billingCatalog);
  const financialMonths = monthlyBillingSeries(
    visits,
    pricing,
    billingCatalog,
    input.filters?.dateTo ?? todayISO(),
    6,
  );
  const composition = visitReportComposition(visits);
  const employees = input.includeEmployeeBreakdown ? employeeReportBreakdown(visits) : [];
  const detailedVisits = [...visits]
    .sort(
      (left, right) =>
        left.tag.localeCompare(right.tag, "pt-BR", { numeric: true }) ||
        right.createdAt - left.createdAt,
    )
    .map((visit) => ({ visit, feet: visitFootReportCells(visit) }));
  const feetEvaluated = detailedVisits.reduce(
    (total, detail) => total + detail.feet.filter((foot) => foot.status !== "unrecorded").length,
    0,
  );
  const feetInTreatment = detailedVisits.reduce(
    (total, detail) =>
      total +
      detail.feet.filter((foot) => foot.status === "problem" || foot.status === "taco").length,
    0,
  );
  const feetWithoutActiveLesion = detailedVisits.reduce(
    (total, detail) =>
      total +
      detail.feet.filter((foot) => foot.status === "normal" || foot.status === "resolved").length,
    0,
  );
  const feetWithTaco = detailedVisits.reduce(
    (total, detail) => total + detail.visit.feet.filter((foot) => Boolean(foot.taco)).length,
    0,
  );
  const feetBySeverity = (severity: Severity) =>
    detailedVisits.reduce(
      (total, detail) =>
        total +
        detail.feet.filter((foot) => foot.status === "problem" && foot.severity === severity)
          .length,
      0,
    );
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generatedAt = new Date();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const scope =
    input.scopeLabel || input.filters?.employeeName || "Administrador e funcionários da fazenda";
  const formatDate = (value?: string) =>
    value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "sem limite";
  const period = `${formatDate(input.filters?.dateFrom)} a ${formatDate(input.filters?.dateTo)}`;
  const filterDescription = [
    `Período: ${period}`,
    `Tipo: ${reportStatusLabel(input.filters?.status)}`,
    input.filters?.lote ? `Lote: ${input.filters.lote}` : "Todos os lotes",
  ].join("  |  ");

  if (input.reportType === "internal") {
    doc.setFillColor(31, 91, 48);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`${input.reportTitle} · Relatório interno`, 10, 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${input.farmName} · ${scope} · ${period}`, 10, 15);

    const compactFoot = (visit: Visit, footKey: FootKey) => {
      const foot = visit.feet.find((entry) => entry.foot === footKey);
      if (!foot) return "-";
      const diseases = (foot.diseases ?? [])
        .filter((disease) => disease.severity > 0)
        .map((disease) => {
          const zones = disease.zones?.length ? disease.zones : (foot.zones ?? []);
          return `${disease.code} G${disease.severity}${zones.length ? ` Z${zones.join("/")}` : ""}`;
        });
      if (foot.taco)
        diseases.push(
          `Taco ${foot.taco.action === "apply" ? "+" : foot.taco.action === "remove" ? "-" : "="}`,
        );
      return diseases.length > 0 ? diseases.join(" · ") : "OK";
    };
    const headers = ["Animal / visita", "FE", "FD", "TE", "TD", "Tratamento", "Revisão"];
    if (showValues) headers.push("Valor");
    autoTable(doc, {
      startY: 27,
      margin: { top: 27, left: 6, right: 6, bottom: 11 },
      head: [headers],
      body: detailedVisits.map(({ visit }) => {
        const treatments = Array.from(
          new Set(
            visit.feet.flatMap((foot) => [
              ...(foot.treatments ?? []).map(
                (code) => TREATMENTS.find((treatment) => treatment.code === code)?.label ?? code,
              ),
              ...(foot.taco ? [`${foot.foot}: ${tacoLabel(foot.taco)}`] : []),
            ]),
          ),
        );
        const reviews = visit.feet
          .filter((foot) => foot.recheck && foot.recheckDate)
          .map((foot) => `${foot.foot} ${formatShortDate(foot.recheckDate)}`);
        const row = [
          `${visit.tag}\n${formatShortDate(visit.date)} · ${visit.employee_name ?? visit.visitante_nome ?? "Sem responsável"}`,
          ...REPORT_FOOT_ORDER.map((foot) => compactFoot(visit, foot)),
          treatments.length > 0
            ? treatments.join(" · ")
            : visit.preventivo
              ? "Preventivo"
              : "Sem tratamento",
          reviews.length > 0
            ? reviews.join(" · ")
            : visit.preventivo
              ? `Preventivo ${formatShortDate(visit.nextPreventiveDate ?? dateAfterMonths(6, visit.date))}`
              : "-",
        ];
        if (showValues) {
          row.push(formatCurrency(billingForVisit(visit, pricing, billingCatalog).total));
        }
        return row;
      }),
      theme: "grid",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 5.8,
        cellPadding: 1.1,
        overflow: "linebreak",
        valign: "top",
      },
      headStyles: {
        fillColor: [31, 91, 48],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 6.4,
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold" },
        1: { cellWidth: 26 },
        2: { cellWidth: 26 },
        3: { cellWidth: 26 },
        4: { cellWidth: 26 },
        5: { cellWidth: 55 },
        6: { cellWidth: showValues ? 45 : 67 },
        ...(showValues ? { 7: { cellWidth: 20, halign: "right" } } : {}),
      },
      alternateRowStyles: { fillColor: [244, 247, 244] },
    });

    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setTextColor(100, 108, 101);
      doc.setFontSize(7);
      doc.text(`Página ${page} de ${pageCount}`, pageWidth - 8, pageHeight - 5, {
        align: "right",
      });
    }
    const suffix = input.filters?.employeeName || input.farmName || "relatorio";
    doc.save(`interno-${safeFilename(suffix)}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
    return { count: visits.length };
  }

  doc.setFillColor(31, 91, 48);
  doc.rect(0, 0, pageWidth, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(input.reportTitle, 12, 11, { maxWidth: 210 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(input.farmName, 12, 18);
  doc.text(`Emitido em ${generatedAt.toLocaleString("pt-BR")}`, pageWidth - 12, 18, {
    align: "right",
  });

  doc.setTextColor(35, 45, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`Escopo: ${scope}`, 12, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(filterDescription, 12, 40, { maxWidth: pageWidth - 24 });

  const metricCards = [
    { label: "Visitas realizadas", value: metrics.visits, color: [31, 91, 48] as const },
    { label: "Vacas vistas", value: metrics.animals, color: [31, 91, 48] as const },
    { label: "Cascos avaliados", value: feetEvaluated, color: [52, 120, 67] as const },
    { label: "Cascos em acompanhamento", value: feetInTreatment, color: [174, 109, 20] as const },
    { label: "Preventivos", value: metrics.preventive, color: [52, 120, 67] as const },
    { label: "Com problema", value: metrics.withProblem, color: [174, 109, 20] as const },
    {
      label: "Revisões na agenda",
      value: metrics.scheduledReviews,
      color: [174, 109, 20] as const,
    },
    { label: "Visitas com taco", value: metrics.withTaco, color: [73, 86, 76] as const },
  ];
  const cardGap = 4;
  const cardWidth = (pageWidth - 24 - cardGap * 3) / 4;
  metricCards.forEach((card, index) => {
    const column = index % 4;
    const row = Math.floor(index / 4);
    const x = 12 + column * (cardWidth + cardGap);
    const y = 46 + row * 20;
    doc.setFillColor(244, 247, 244);
    doc.setDrawColor(207, 216, 208);
    doc.roundedRect(x, y, cardWidth, 16, 2, 2, "FD");
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(String(card.value), x + 4, y + 7);
    doc.setTextColor(70, 78, 71);
    doc.setFontSize(7.5);
    doc.text(card.label.toUpperCase(), x + 4, y + 12.5, { maxWidth: cardWidth - 8 });
  });

  const legend = [
    {
      label: "Cascos sem lesão / curados",
      value: feetWithoutActiveLesion,
      fill: [232, 244, 234] as const,
    },
    { label: "Cascos com taco", value: feetWithTaco, fill: [232, 239, 248] as const },
    { label: "Cascos G1 · Leve", value: feetBySeverity(1), fill: [224, 242, 249] as const },
    { label: "Cascos G2 · Moderado", value: feetBySeverity(2), fill: [255, 246, 196] as const },
    { label: "Cascos G3 · Grave", value: feetBySeverity(3), fill: [250, 224, 224] as const },
  ];
  const legendWidth = (pageWidth - 24) / legend.length;
  legend.forEach((item, index) => {
    const x = 12 + index * legendWidth;
    doc.setFillColor(item.fill[0], item.fill[1], item.fill[2]);
    doc.setDrawColor(205, 212, 206);
    doc.rect(x, 88, legendWidth, 13, "FD");
    doc.setTextColor(53, 61, 54);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${item.label}: ${item.value}`, x + 4, 96);
  });

  doc.setTextColor(35, 45, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Composição do relatório", 12, 110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text(
    "As três primeiras linhas abrangem todos os atendimentos. Revisão e taco são controles adicionais e podem repetir animais.",
    12,
    114,
  );
  autoTable(doc, {
    startY: 118,
    margin: { left: 12, right: 12 },
    head: [["Tipo de atendimento", "Visitas realizadas", "Vacas vistas", "Leitura"]],
    body: composition.map((row) => [
      row.label,
      row.visits,
      row.animals,
      row.overlaps ? "Pode coincidir com outras linhas" : "Categoria principal",
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.2, cellPadding: 1.5, valign: "middle" },
    headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 92, fontStyle: "bold" },
      1: { cellWidth: 24, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
      3: { cellWidth: 75 },
    },
    alternateRowStyles: { fillColor: [244, 247, 244] },
  });
  const compositionEndY =
    (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 154;

  if (input.includeEmployeeBreakdown) {
    doc.setTextColor(35, 45, 37);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Produção por funcionário", 12, compositionEndY + 7);
    autoTable(doc, {
      startY: compositionEndY + 11,
      margin: { left: 12, right: 12 },
      head: [
        ["Funcionário", "Visitas", "Vacas vistas", "Preventivos", "Problemas", "G1", "G2", "G3"],
      ],
      body: employees.map((employee) => [
        employee.employeeName,
        employee.visits,
        employee.animals,
        employee.preventive,
        employee.withProblem,
        employee.light,
        employee.moderate,
        employee.severe,
      ]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2, halign: "center" },
      headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
      columnStyles: { 0: { halign: "left", cellWidth: 60, fontStyle: "bold" } },
      alternateRowStyles: { fillColor: [244, 247, 244] },
    });
  } else {
    doc.setTextColor(70, 78, 71);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(
      "Os indicadores e o detalhamento consideram somente os atendimentos do responsável indicado no escopo.",
      12,
      compositionEndY + 9,
    );
  }

  if (showValues) {
    doc.addPage();
    doc.setFillColor(31, 91, 48);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text("Resumo financeiro", 12, 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`${input.farmName} · ${period}`, 12, 16);

    const financialCards = [
      ["Valor produzido", formatCurrency(financial.total)],
      ["Visitas cobradas", String(financial.visits)],
      ["Média por visita", formatCurrency(financial.averagePerVisit)],
      ["Visitas estimadas", String(financial.estimatedVisits)],
    ];
    financialCards.forEach(([label, value], index) => {
      const width = (pageWidth - 27) / 4;
      const x = 12 + index * (width + 1);
      doc.setFillColor(244, 247, 244);
      doc.setDrawColor(207, 216, 208);
      doc.roundedRect(x, 29, width, 20, 2, 2, "FD");
      doc.setTextColor(31, 91, 48);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(value, x + 4, 38);
      doc.setTextColor(70, 78, 71);
      doc.setFontSize(7);
      doc.text(label.toUpperCase(), x + 4, 44);
    });

    doc.setTextColor(35, 45, 37);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Evolução dos últimos seis meses", 12, 59);
    autoTable(doc, {
      startY: 63,
      margin: { left: 12, right: 12 },
      head: [financialMonths.map((month) => month.label.toUpperCase())],
      body: [
        financialMonths.map((month) => formatCurrency(month.total)),
        financialMonths.map((month) => `${month.visits} visita(s)`),
      ],
      theme: "grid",
      styles: { font: "helvetica", fontSize: 7.5, cellPadding: 1.6, halign: "center" },
      headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 247, 244] },
    });
    const monthsEndY =
      (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 83;

    doc.setTextColor(35, 45, 37);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Composição dos serviços", 12, monthsEndY + 8);
    autoTable(doc, {
      startY: monthsEndY + 12,
      margin: { left: 12, right: 12 },
      head: [["Serviço", "Ocorrências", "Valor"]],
      body: financial.lines.map((item) => [item.label, item.quantity, formatCurrency(item.total)]),
      theme: "grid",
      styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 150, fontStyle: "bold" },
        1: { cellWidth: 35, halign: "center" },
        2: { cellWidth: 55, halign: "right" },
      },
      alternateRowStyles: { fillColor: [244, 247, 244] },
    });

    if (input.includeEmployeeBreakdown) {
      const servicesEndY =
        (doc as typeof doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 95;
      doc.setTextColor(35, 45, 37);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Valores por funcionário", 12, servicesEndY + 8);
      autoTable(doc, {
        startY: servicesEndY + 12,
        margin: { left: 12, right: 12 },
        head: [["Funcionário", "Visitas", "Valor", "Média"]],
        body: financialEmployees.map((employee) => [
          employee.employeeName,
          employee.visits,
          formatCurrency(employee.total),
          formatCurrency(employee.averagePerVisit),
        ]),
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 110, fontStyle: "bold" },
          1: { cellWidth: 40, halign: "center" },
          2: { cellWidth: 55, halign: "right" },
          3: { cellWidth: 55, halign: "right" },
        },
        alternateRowStyles: { fillColor: [244, 247, 244] },
      });
    }

    if (financial.estimatedVisits > 0) {
      doc.setTextColor(132, 87, 17);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(
        `${financial.estimatedVisits} visita(s) anterior(es) à tabela usam os valores atuais como estimativa.`,
        12,
        pageHeight - 12,
      );
    }
  }

  if (visits.length) {
    doc.addPage();
    autoTable(doc, {
      startY: 23,
      margin: { top: 23, left: 8, right: 8, bottom: 13 },
      head: [
        [
          "Animal",
          "Visita",
          "FE\nFrente esq.",
          "FD\nFrente dir.",
          "TE\nTrás esq.",
          "TD\nTrás dir.",
          "Situação",
        ],
      ],
      body: detailedVisits.map(({ visit, feet }) => {
        const reviewFeet = feet.filter((foot) => foot.text.includes("Revisão:"));
        const situation = [
          visit.preventivo ? "CASQUEAMENTO PREVENTIVO" : "ATENDIMENTO CLÍNICO",
          visit.preventivo
            ? `Próximo preventivo: ${formatShortDate(visit.nextPreventiveDate ?? dateAfterMonths(6, visit.date))}`
            : "",
          showValues
            ? `Valor: ${formatCurrency(billingForVisit(visit, pricing, billingCatalog).total)}${visit.billing ? "" : " (estimado)"}`
            : "",
          reviewFeet.length > 0
            ? `Revisão em ${reviewFeet.map((foot) => foot.foot).join(", ")}`
            : "Sem revisão marcada",
          visit.correction_of_id ? "Correção auditável" : "",
          visit.correction_reason ? `Motivo: ${visit.correction_reason}` : "",
        ].filter(Boolean);
        return [
          `${visit.tag}\n${visit.sex === "vaca" ? "Vaca" : "Touro"}`,
          `${new Date(visit.createdAt).toLocaleString("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
          })}\n${visit.employee_name ?? visit.visitante_nome ?? "Sem responsável"}\nLote: ${visit.lote ?? "-"}`,
          ...feet.map((foot) => foot.text),
          situation.join("\n"),
        ];
      }),
      theme: "grid",
      rowPageBreak: "avoid",
      showHead: "everyPage",
      styles: {
        font: "helvetica",
        fontSize: 6.4,
        cellPadding: 1.7,
        overflow: "linebreak",
        valign: "top",
        lineColor: [190, 200, 192],
      },
      headStyles: {
        fillColor: [31, 91, 48],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 7.3,
        valign: "middle",
        halign: "center",
      },
      columnStyles: {
        0: { cellWidth: 20, fontStyle: "bold", fontSize: 7.5, halign: "center" },
        1: { cellWidth: 34 },
        2: { cellWidth: 48 },
        3: { cellWidth: 48 },
        4: { cellWidth: 48 },
        5: { cellWidth: 48 },
        6: { cellWidth: 35 },
      },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index < 2 || data.column.index > 5) return;
        const foot = detailedVisits[data.row.index]?.feet[data.column.index - 2];
        if (!foot) return;
        const fillByStatus: Record<FootReportStatus, [number, number, number]> = {
          unrecorded: [242, 242, 242],
          normal: [232, 244, 234],
          resolved: [226, 243, 230],
          taco: [232, 239, 248],
          problem:
            foot.severity >= 3
              ? [250, 224, 224]
              : foot.severity === 2
                ? [255, 246, 196]
                : [224, 242, 249],
        };
        data.cell.styles.fillColor = fillByStatus[foot.status];
        if (foot.status === "problem" && foot.severity >= 3) {
          data.cell.styles.textColor = [145, 30, 30];
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage: () => {
        doc.setFillColor(31, 91, 48);
        doc.rect(0, 0, pageWidth, 16, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Detalhamento por animal, visita e casco", 8, 9.5);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.text(`${input.farmName} · ${scope}`, pageWidth - 8, 9.5, { align: "right" });
      },
    });
  } else {
    doc.setTextColor(90, 98, 91);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum atendimento encontrado para os filtros escolhidos.", 12, 128);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(215, 220, 216);
    doc.line(10, pageHeight - 9, pageWidth - 10, pageHeight - 9);
    doc.setTextColor(100, 108, 101);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`${input.farmName} · Gestão de Cascos`, 10, pageHeight - 5);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - 10, pageHeight - 5, { align: "right" });
  }

  const suffix = input.filters?.employeeName || input.farmName || "relatorio";
  doc.save(`casqueamento-${safeFilename(suffix)}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
  return { count: visits.length };
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
