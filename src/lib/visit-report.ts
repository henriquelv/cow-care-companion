import {
  FOOT_LABEL,
  TREATMENTS,
  diseaseDefinition,
  tacoLabel,
  visitBelongsToEmployee,
  visitHasTaco,
  visitIsVisible,
  type AgendaItem,
  type Visit,
} from "@/lib/casco-store";

export type VisitReportStatus = "all" | "normal" | "preventive" | "problem" | "recheck" | "taco";

export interface VisitReportFilters {
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
  withProblem: number;
  scheduledReviews: number;
  withTaco: number;
  tacosApplied: number;
}

function hasProblem(visit: Visit) {
  return visit.feet.some((foot) => !foot.ok && !foot.resolved && !foot.data_liberacao);
}

function hasRecheck(visit: Visit) {
  return visit.feet.some((foot) => foot.recheck && !foot.resolved && !foot.data_liberacao);
}

export function filterVisitsForReport(visits: Visit[], filters: VisitReportFilters) {
  return visits
    .filter(visitIsVisible)
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
          return !hasProblem(visit);
        case "preventive":
          return visit.preventivo === true;
        case "problem":
          return hasProblem(visit);
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
  const visibleVisits = visits.filter(visitIsVisible);
  return {
    visits: visibleVisits.length,
    animals: new Set(visibleVisits.map((visit) => visit.tag.trim().toLocaleLowerCase("pt-BR")))
      .size,
    preventive: visibleVisits.filter((visit) => visit.preventivo).length,
    normal: visibleVisits.filter((visit) => !hasProblem(visit)).length,
    withProblem: visibleVisits.filter(hasProblem).length,
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

function diagnosisSummary(visit: Visit) {
  if (!hasProblem(visit)) return visit.preventivo ? "Casco normal / preventivo" : "Casco normal";
  return visit.feet
    .filter((foot) => !foot.ok)
    .flatMap((foot) =>
      (foot.diseases ?? [])
        .filter((disease) => disease.severity > 0)
        .map(
          (disease) =>
            `${FOOT_LABEL[foot.foot]}: ${diseaseDefinition(disease.code)?.full ?? disease.code} G${disease.severity}`,
        ),
    )
    .join("; ");
}

function treatmentSummary(visit: Visit) {
  const treatments = Array.from(
    new Set(
      visit.feet.flatMap((foot) =>
        (foot.treatments ?? [])
          .map((code) => TREATMENTS.find((treatment) => treatment.code === code)?.label)
          .filter((label): label is string => Boolean(label)),
      ),
    ),
  );
  const tacos = visit.feet
    .filter((foot) => foot.taco)
    .map((foot) => `${FOOT_LABEL[foot.foot]}: ${tacoLabel(foot.taco)}`);
  return [...treatments, ...tacos].join(", ");
}

function reviewSummary(visit: Visit) {
  const plans = visit.feet.filter((foot) => foot.recheck && foot.recheckDate);
  if (!plans.length) return "-";
  return plans
    .map(
      (foot) =>
        `${foot.revisoes_necessarias ?? 1}x / ${foot.intervalo_revisao_dias ?? "data"}d (${FOOT_LABEL[foot.foot]})`,
    )
    .join("; ");
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export async function exportVisitsPdf(input: {
  visits: Visit[];
  agenda?: AgendaItem[];
  farmName: string;
  reportTitle: string;
  filters?: VisitReportFilters;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const visits = filterVisitsForReport(input.visits, input.filters ?? {});
  const metrics = visitReportMetrics(visits, input.agenda ?? []);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const generatedAt = new Date();

  doc.setFillColor(31, 91, 48);
  doc.rect(0, 0, 297, 26, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text(input.reportTitle, 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${input.farmName} | emitido em ${generatedAt.toLocaleString("pt-BR")}`, 12, 18);

  doc.setTextColor(35, 45, 37);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(
    `${metrics.visits} visitas   ${metrics.animals} animais   ${metrics.preventive} preventivos   ${metrics.withProblem} com problema   ${metrics.tacosApplied} tacos aplicados   ${metrics.scheduledReviews} revisões agendadas`,
    12,
    34,
  );

  autoTable(doc, {
    startY: 40,
    margin: { left: 10, right: 10 },
    head: [["Data", "Brinco", "Funcionário", "Lote", "Diagnóstico", "Tratamento", "Plano"]],
    body: visits.map((visit) => [
      new Date(visit.createdAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
      visit.tag,
      visit.employee_name ?? visit.visitante_nome ?? "-",
      visit.lote ?? "-",
      diagnosisSummary(visit),
      treatmentSummary(visit) || "-",
      reviewSummary(visit),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [242, 247, 242] },
    columnStyles: {
      0: { cellWidth: 27 },
      1: { cellWidth: 18, fontStyle: "bold" },
      2: { cellWidth: 30 },
      3: { cellWidth: 20 },
      4: { cellWidth: 76 },
      5: { cellWidth: 54 },
      6: { cellWidth: 37 },
    },
    didDrawPage: ({ pageNumber }) => {
      doc.setFontSize(8);
      doc.setTextColor(90, 98, 91);
      doc.text(`Página ${pageNumber}`, 276, 202);
    },
  });

  if (!visits.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("Nenhuma visita encontrada para os filtros selecionados.", 12, 50);
  }

  const suffix = input.filters?.employeeName || input.farmName || "relatorio";
  doc.save(`casqueamento-${safeFilename(suffix)}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
  return { count: visits.length };
}
