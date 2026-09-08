import type { AgendaItem } from "./casco-store";
import { agendaItemStatus, agendaStatusCounts, agendaStatusText } from "./agenda-status";

const TYPE_LABEL: Record<AgendaItem["type"], string> = {
  recheck: "Revisão",
  curative: "Curativo",
  preventive: "Preventivo",
  request: "Solicitação",
};

export function agendaReportData(items: AgendaItem[], referenceDate: string) {
  const sorted = [...items].sort(
    (left, right) => left.date.localeCompare(right.date) || left.tag.localeCompare(right.tag),
  );
  return {
    counts: agendaStatusCounts(sorted, referenceDate),
    rows: sorted.map((item) => ({
      status: agendaStatusText(item, referenceDate),
      statusKey: agendaItemStatus(item, referenceDate),
      date: new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR"),
      tag: item.tag,
      type: TYPE_LABEL[item.type],
      lote: item.lote ?? "-",
      detail: item.detail,
      employee: item.employee_name ?? "Equipe da fazenda",
    })),
  };
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function exportAgendaPdf(input: {
  items: AgendaItem[];
  referenceDate: string;
  farmName: string;
  scopeLabel: string;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const report = agendaReportData(input.items, input.referenceDate);
  const generatedAt = new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setFillColor(31, 91, 48);
  doc.rect(0, 0, width, 25, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Agenda de atendimentos", 12, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`${input.farmName} · ${input.scopeLabel}`, 12, 17);
  doc.text(`Emitido em ${generatedAt.toLocaleString("pt-BR")}`, width - 12, 17, {
    align: "right",
  });

  const cards = [
    ["Atrasadas", report.counts.overdue],
    ["Hoje", report.counts.today],
    ["Próximos 7 dias", report.counts.next7],
    ["Futuras", report.counts.later],
  ] as const;
  cards.forEach(([label, value], index) => {
    const cardWidth = (width - 27) / 4;
    const x = 12 + index * (cardWidth + 1);
    doc.setFillColor(244, 247, 244);
    doc.setDrawColor(207, 216, 208);
    doc.roundedRect(x, 31, cardWidth, 18, 2, 2, "FD");
    doc.setTextColor(31, 91, 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(String(value), x + 4, 39);
    doc.setTextColor(70, 78, 71);
    doc.setFontSize(7.5);
    doc.text(label.toUpperCase(), x + 4, 45);
  });

  autoTable(doc, {
    startY: 56,
    margin: { left: 10, right: 10, bottom: 14 },
    head: [["Situação", "Data", "Animal", "Tipo", "Lote", "Motivo / detalhe", "Responsável"]],
    body: report.rows.map((row) => [
      row.status,
      row.date,
      row.tag,
      row.type,
      row.lote,
      row.detail,
      row.employee,
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7.5, cellPadding: 2, valign: "middle" },
    headStyles: { fillColor: [31, 91, 48], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 244] },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: "bold" },
      1: { cellWidth: 22 },
      2: { cellWidth: 22, fontStyle: "bold" },
      3: { cellWidth: 24 },
      4: { cellWidth: 25 },
      5: { cellWidth: 105 },
      6: { cellWidth: 42 },
    },
  });
  if (report.rows.length === 0) {
    doc.setTextColor(90, 98, 91);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhum compromisso encontrado nos filtros selecionados.", 12, 68);
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(207, 216, 208);
    doc.line(10, height - 9, width - 10, height - 9);
    doc.setTextColor(90, 98, 91);
    doc.setFontSize(7);
    doc.text("Agenda gerada pelo Gestão de Cascos", 10, height - 5);
    doc.text(`Página ${page} de ${pageCount}`, width - 10, height - 5, { align: "right" });
  }

  doc.save(`agenda-${safeFilename(input.farmName)}-${generatedAt.toISOString().slice(0, 10)}.pdf`);
}
