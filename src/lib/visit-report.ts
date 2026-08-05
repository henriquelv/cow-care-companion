import {
  FOOT_LABEL,
  TREATMENTS,
  diseaseDefinition,
  tacoLabel,
  footsWorstSeverity,
  visitBelongsToEmployee,
  visitHasTaco,
  visitIsFinalized,
  type AgendaItem,
  type Visit,
} from "@/lib/casco-store";

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

function hasProblem(visit: Visit) {
  return visit.feet.some((foot) => !foot.ok && !foot.resolved && !foot.data_liberacao);
}

function hasRecheck(visit: Visit) {
  return visit.feet.some((foot) => foot.recheck && !foot.resolved && !foot.data_liberacao);
}

export function filterVisitsForReport(visits: Visit[], filters: VisitReportFilters) {
  return visits
    .filter(visitIsFinalized)
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

function diagnosisSummary(visit: Visit) {
  if (!hasProblem(visit)) return visit.preventivo ? "Casco normal / preventivo" : "Casco normal";
  const diagnoses = visit.feet
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
  return (
    diagnoses ||
    (visitHasTaco(visit)
      ? "Acompanhamento de taco, sem lesão ativa"
      : "Problema sem lesão informada")
  );
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
    .map((foot) => {
      const date = new Date(`${foot.recheckDate}T12:00:00`).toLocaleDateString("pt-BR");
      const count = foot.revisoes_necessarias ?? 1;
      return foot.intervalo_revisao_dias
        ? `${count} revisão(ões) a cada ${foot.intervalo_revisao_dias} dias · próxima ${date} (${FOOT_LABEL[foot.foot]})`
        : `Revisão em ${date} (${FOOT_LABEL[foot.foot]})`;
    })
    .join("; ");
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
  filters?: VisitReportFilters;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const visits = filterVisitsForReport(input.visits, input.filters ?? {});
  const metrics = visitReportMetrics(visits, input.agenda ?? []);
  const employees = input.includeEmployeeBreakdown ? employeeReportBreakdown(visits) : [];
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
    { label: "Atendimentos", value: metrics.visits, color: [31, 91, 48] as const },
    { label: "Animais únicos", value: metrics.animals, color: [31, 91, 48] as const },
    { label: "Preventivos", value: metrics.preventive, color: [52, 120, 67] as const },
    { label: "Sem lesão", value: metrics.withoutProblem, color: [52, 120, 67] as const },
    { label: "Com problema", value: metrics.withProblem, color: [174, 109, 20] as const },
    {
      label: "Revisões na agenda",
      value: metrics.scheduledReviews,
      color: [174, 109, 20] as const,
    },
    { label: "Visitas com taco", value: metrics.withTaco, color: [73, 86, 76] as const },
    { label: "Tacos colocados", value: metrics.tacosApplied, color: [73, 86, 76] as const },
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

  doc.setFillColor(252, 248, 237);
  doc.setDrawColor(225, 206, 160);
  doc.roundedRect(12, 88, pageWidth - 24, 13, 2, 2, "FD");
  doc.setTextColor(80, 65, 34);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(
    `GRAVIDADE DAS LESÕES     G1 Leves: ${metrics.light}     G2 Moderados: ${metrics.moderate}     G3 Graves: ${metrics.severe}`,
    17,
    96,
  );

  if (input.includeEmployeeBreakdown) {
    doc.setTextColor(35, 45, 37);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Produção por funcionário", 12, 110);
    autoTable(doc, {
      startY: 114,
      margin: { left: 12, right: 12 },
      head: [["Funcionário", "Atend.", "Animais", "Preventivos", "Problemas", "G1", "G2", "G3"]],
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
      "Os indicadores acima e o detalhamento consideram somente os atendimentos do administrador.",
      12,
      113,
    );
  }

  if (visits.length) {
    doc.addPage();
    doc.setFillColor(31, 91, 48);
    doc.rect(0, 0, pageWidth, 16, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Detalhamento dos atendimentos", 12, 10);
    autoTable(doc, {
      startY: 21,
      margin: { left: 10, right: 10, bottom: 13 },
      head: [
        ["Data e hora", "Brinco", "Funcionário", "Lote", "Diagnóstico", "Tratamento", "Revisão"],
      ],
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
      styles: { font: "helvetica", fontSize: 7.2, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [244, 247, 244] },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 17, fontStyle: "bold" },
        2: { cellWidth: 27 },
        3: { cellWidth: 18 },
        4: { cellWidth: 67 },
        5: { cellWidth: 51 },
        6: { cellWidth: 63 },
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
