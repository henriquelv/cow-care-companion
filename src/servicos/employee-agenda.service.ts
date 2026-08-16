import {
  agendaByDateFromVisits,
  dateAfterMonths,
  normalizeSeverity,
  todayISO,
  visitHasActiveProblem,
  visitIsFinalized,
  type AgendaItem,
  type FootEntry,
  type Sex,
  type Visit,
} from "@/dominio/casco-store";
import { isSupabaseConfigured, requireSupabase } from "./supabase";
import { localdb } from "./localdb";

interface AgendaFarm {
  id: string;
  name: string;
}

interface RemoteVisitRow {
  id: string;
  farm_id: string;
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
  payload?: Visit;
}

export interface EmployeeAgendaItem extends AgendaItem {
  farm_id: string;
  farm_name: string;
}

export interface EmployeeAgendaResult {
  items: EmployeeAgendaItem[];
  source: "remote" | "local";
}

function normalizeVisit(row: RemoteVisitRow): Visit {
  const payload = row.payload;
  const feet = (payload?.feet ?? []).map(
    (foot): FootEntry => ({
      ...foot,
      diseases: (foot.diseases ?? []).map((disease) => ({
        ...disease,
        severity: normalizeSeverity(disease.severity),
      })),
    }),
  );

  return {
    id: payload?.id ?? row.id,
    farm_id: row.farm_id,
    date: payload?.date ?? row.date ?? todayISO(),
    createdAt:
      payload?.createdAt ?? (row.created_at ? new Date(row.created_at).getTime() : Date.now()),
    tag: payload?.tag ?? row.tag ?? "",
    sex: payload?.sex ?? row.sex ?? "vaca",
    lote: payload?.lote ?? row.lote,
    preventivo: payload?.preventivo ?? row.preventivo,
    nextPreventiveDate: payload?.nextPreventiveDate,
    visitante_nome: payload?.visitante_nome ?? row.visitante_nome,
    employee_id: payload?.employee_id ?? row.employee_id,
    employee_name: payload?.employee_name ?? row.employee_name,
    device_id: payload?.device_id ?? row.device_id,
    feet,
  };
}

function buildAgenda(visits: Visit[], employeeId: string, farms: AgendaFarm[]) {
  const farmNames = new Map(farms.map((farm) => [farm.id, farm.name]));
  const clinicalItems = Array.from(
    agendaByDateFromVisits(visits, todayISO(), employeeId).values(),
  ).flat();
  const groupedVisits = new Map<string, Visit[]>();

  for (const visit of visits.filter(visitIsFinalized)) {
    if (!visit.farm_id) continue;
    const key = `${visit.farm_id}:${visit.tag.trim().toLocaleLowerCase("pt-BR")}`;
    groupedVisits.set(key, [...(groupedVisits.get(key) ?? []), visit]);
  }

  const preventiveItems = Array.from(groupedVisits.values()).flatMap((animalVisits) => {
    const ordered = [...animalVisits].sort((left, right) => right.createdAt - left.createdAt);
    if (visitHasActiveProblem(ordered[0])) return [];
    const latestPreventive = ordered.find((visit) => visit.preventivo);
    if (!latestPreventive || latestPreventive.employee_id !== employeeId) return [];
    const date = latestPreventive.nextPreventiveDate ?? dateAfterMonths(6, latestPreventive.date);
    return [
      {
        id: `preventive_${latestPreventive.farm_id}_${latestPreventive.tag}_${date}`,
        visit_id: latestPreventive.id,
        farm_id: latestPreventive.farm_id,
        date,
        type: "preventive" as const,
        tag: latestPreventive.tag,
        sex: latestPreventive.sex,
        lote: latestPreventive.lote,
        feet: [],
        title: "Casqueamento preventivo",
        detail: "Programado seis meses após o último preventivo",
        overdue: date < todayISO(),
        employee_id: latestPreventive.employee_id,
        employee_name: latestPreventive.employee_name ?? latestPreventive.visitante_nome,
      },
    ];
  });

  return [...clinicalItems, ...preventiveItems]
    .flat()
    .filter((item): item is AgendaItem & { farm_id: string } => Boolean(item.farm_id))
    .map(
      (item): EmployeeAgendaItem => ({
        ...item,
        farm_id: item.farm_id,
        farm_name: farmNames.get(item.farm_id) ?? "Fazenda",
      }),
    )
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        a.date.localeCompare(b.date) ||
        a.farm_name.localeCompare(b.farm_name) ||
        a.tag.localeCompare(b.tag),
    );
}

async function loadLocalVisits(farmIds: string[]) {
  if (!farmIds.length) return [];
  const rows = await localdb.hoof_visits.where("farm_id").anyOf(farmIds).toArray();
  return rows.map((row) => normalizeVisit(row.data as RemoteVisitRow));
}

export const employeeAgendaService = {
  async load(employeeId: string, farms: AgendaFarm[]): Promise<EmployeeAgendaResult> {
    const farmIds = farms.map((farm) => farm.id);
    const canUseRemote =
      isSupabaseConfigured &&
      typeof navigator !== "undefined" &&
      navigator.onLine !== false &&
      farmIds.length > 0;

    if (canUseRemote) {
      const supabase = requireSupabase();
      const { data, error } = await supabase.rpc("hoof_employee_agenda");
      if (!error) {
        const visits = ((data ?? []) as RemoteVisitRow[])
          .map((row) => normalizeVisit(row))
          .filter(
            (visit) => visit.employee_id === employeeId && farmIds.includes(visit.farm_id ?? ""),
          );
        return { items: buildAgenda(visits, employeeId, farms), source: "remote" };
      }
    }

    const visits = await loadLocalVisits(farmIds);
    return { items: buildAgenda(visits, employeeId, farms), source: "local" };
  },
};
