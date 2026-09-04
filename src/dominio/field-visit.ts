import type { Visit } from "./casco-store";

export function fieldVisitKey(
  visit: Pick<
    Visit,
    "work_session_id" | "farm_id" | "employee_id" | "employee_name" | "visitante_nome" | "date"
  >,
) {
  if (visit.work_session_id) return `session:${visit.work_session_id}`;

  const employee =
    visit.employee_id ??
    visit.employee_name?.trim().toLocaleLowerCase("pt-BR") ??
    visit.visitante_nome?.trim().toLocaleLowerCase("pt-BR") ??
    "sem-responsavel";
  return `legacy:${visit.farm_id ?? "sem-fazenda"}:${employee}:${visit.date}`;
}

export function countFieldVisits(visits: Visit[]) {
  return new Set(visits.map(fieldVisitKey)).size;
}
