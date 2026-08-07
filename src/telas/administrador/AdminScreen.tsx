import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Database,
  Download,
  AlertTriangle,
  HeartPulse,
  Info,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/dominio/utils";
import { farmContextService } from "@/servicos/farm-context.service";
import { syncService } from "@/servicos/sync.service";
import {
  adminService,
  deviceDisplayName,
  isTechnicalDeviceName,
  type AdminEmployee,
  type AdminFarm,
  type AdminOverview,
} from "@/servicos/admin.service";
import { isSupabaseConfigured } from "@/servicos/supabase";
import {
  agendaByDate,
  allAnimals,
  loadFarm,
  loadVisits,
  todayISO,
  visitIsFinalized,
  type Visit,
} from "@/dominio/casco-store";
import {
  exportVisitsPdf,
  filterVisitsForReport,
  monthlyComparisonFromVisits,
  operationalBreakdownFromVisits,
  visitReportMetrics,
  type VisitReportStatus,
} from "@/dominio/visit-report";
import {
  MonthlyComparisonPanel,
  OperationalBreakdownPanel,
} from "@/componentes/metricas/OperationalAnalysis";

type AdminTab = "reports" | "data" | "farms" | "employees" | "devices" | "licenses" | "audit";

const EMPTY_OVERVIEW: AdminOverview = {
  farms: [],
  employees: [],
  devices: [],
  licenses: [],
  audit: [],
};

const ACTION_LABELS: Record<string, string> = {
  manager_session_started: "Acesso gerente iniciado",
  create_farm: "Fazenda criada",
  create_employee: "Funcionário criado",
  update_employee: "Funcionário atualizado",
  edit_employee: "Cadastro do funcionário atualizado",
  remove_employee: "Funcionário excluído da operação",
  cancel_visit: "Visita excluída com auditoria",
  remove_animal: "Animal excluído com auditoria",
  reset_employee_pin: "PIN redefinido",
  assign_employee_farm: "Acesso à fazenda alterado",
  update_device_status: "Aparelho atualizado",
  update_license_status: "Licença atualizada",
  update_farm: "Fazenda atualizada",
};

function formatDate(value?: string | null) {
  if (!value) return "Nunca";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function StatusBadge({ status, blockedLabel }: { status: string; blockedLabel?: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-[10px] font-black uppercase",
        active ? "bg-good/10 text-good" : "bg-danger/10 text-danger",
      )}
    >
      {active ? "Ativo" : status === "expired" ? "Expirado" : (blockedLabel ?? "Bloqueado")}
    </span>
  );
}

function MetricTile({
  value,
  label,
  help,
  tone = "primary",
}: {
  value: number;
  label: string;
  help: string;
  tone?: "primary" | "good" | "warn" | "danger";
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "font-display text-3xl font-black leading-none",
            tone === "primary" && "text-primary",
            tone === "good" && "text-good",
            tone === "warn" && "text-warn-foreground",
            tone === "danger" && "text-danger",
          )}
        >
          {value}
        </p>
        <Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="mt-2 text-xs font-black uppercase text-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{help}</p>
    </div>
  );
}

export function AdminScreen({
  onCorrectVisit,
  onManageAnimals,
  onDataChanged,
}: {
  onCorrectVisit?: (visit: Visit) => void;
  onManageAnimals?: () => void;
  onDataChanged?: () => void | Promise<void>;
}) {
  const context = farmContextService.getContext();
  const [unlocked, setUnlocked] = useState(() => adminService.isUnlocked());
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<AdminTab>("reports");
  const [overview, setOverview] = useState<AdminOverview>(EMPTY_OVERVIEW);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showFarmForm, setShowFarmForm] = useState(false);
  const [farmName, setFarmName] = useState("");
  const [farmMaxDevices, setFarmMaxDevices] = useState("10");
  const [editingFarm, setEditingFarm] = useState<AdminFarm | null>(null);
  const [farmEditForm, setFarmEditForm] = useState({ name: "", max_devices: "10" });
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    login_name: "",
    employee_code: "",
    pin: "",
    farm_id: context?.farm_id ?? "",
    is_admin: false,
  });
  const [resetEmployee, setResetEmployee] = useState<AdminEmployee | null>(null);
  const [resetPin, setResetPin] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<AdminEmployee | null>(null);
  const [removingEmployee, setRemovingEmployee] = useState<AdminEmployee | null>(null);
  const [employeeEditForm, setEmployeeEditForm] = useState({
    name: "",
    login_name: "",
    employee_code: "",
  });
  const today = todayISO();
  const [reportFrom, setReportFrom] = useState(`${today.slice(0, 7)}-01`);
  const [reportTo, setReportTo] = useState(today);
  const [reportScope, setReportScope] = useState<"mine" | "team">("team");
  const [reportEmployeeId, setReportEmployeeId] = useState("all");
  const [reportStatus, setReportStatus] = useState<VisitReportStatus>("all");
  const [reportLote, setReportLote] = useState("all");
  const [exportingPdf, setExportingPdf] = useState(false);
  const [dataMode, setDataMode] = useState<"visits" | "animals">("visits");
  const [dataSearch, setDataSearch] = useState("");
  const [removingData, setRemovingData] = useState<
    { kind: "visit"; visit: Visit } | { kind: "animal"; tag: string; totalVisits: number } | null
  >(null);
  const [dataRemovalReason, setDataRemovalReason] = useState("");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await adminService.overview());
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Não foi possível carregar os dados.";
      setError(message);
      if (message.includes("expirado")) setUnlocked(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (unlocked) void loadOverview();
  }, [loadOverview, unlocked]);

  useEffect(() => {
    const modalOpen = Boolean(
      editingFarm || editingEmployee || removingEmployee || removingData || resetEmployee,
    );
    if (!modalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setEditingEmployee(null);
      setEditingFarm(null);
      setRemovingEmployee(null);
      setRemovingData(null);
      setResetEmployee(null);
      setDataRemovalReason("");
      setResetPin("");
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [editingEmployee, editingFarm, removingData, removingEmployee, resetEmployee]);

  const farmNames = useMemo(
    () => new Map(overview.farms.map((farm) => [farm.id, farm.name])),
    [overview.farms],
  );
  const employeeNames = useMemo(
    () => new Map(overview.employees.map((employee) => [employee.id, employee.name])),
    [overview.employees],
  );
  const managedDevices = overview.devices.filter(
    (device) => !isTechnicalDeviceName(device.device_name),
  );
  const activeDeviceCount = managedDevices.filter((device) => device.status === "active").length;
  const blockedDeviceCount = managedDevices.length - activeDeviceCount;
  const farmEmployees = overview.employees.filter(
    (employee) => !context?.farm_id || employee.farm_ids.includes(context.farm_id),
  );
  const selectedReportEmployee = farmEmployees.find((employee) => employee.id === reportEmployeeId);
  const scopedEmployeeId =
    reportScope === "mine" ? context?.employee_id : selectedReportEmployee?.id;
  const scopedEmployeeName =
    reportScope === "mine" ? context?.employee_name : selectedReportEmployee?.name;
  const reportFilters = {
    farmId: context?.farm_id,
    dateFrom: reportFrom,
    dateTo: reportTo,
    employeeId: scopedEmployeeId,
    employeeName: scopedEmployeeName,
    lote: reportLote === "all" ? undefined : reportLote,
    status: reportStatus,
  };
  const teamReportVisits = filterVisitsForReport(loadVisits(), {
    farmId: context?.farm_id,
    dateFrom: reportFrom,
    dateTo: reportTo,
    lote: reportLote === "all" ? undefined : reportLote,
    status: reportStatus,
  });
  const mineReportVisits = filterVisitsForReport(loadVisits(), {
    farmId: context?.farm_id,
    dateFrom: reportFrom,
    dateTo: reportTo,
    employeeId: context?.employee_id,
    employeeName: context?.employee_name,
    lote: reportLote === "all" ? undefined : reportLote,
    status: reportStatus,
  });
  const employeeReportVisits = selectedReportEmployee
    ? filterVisitsForReport(loadVisits(), {
        farmId: context?.farm_id,
        dateFrom: reportFrom,
        dateTo: reportTo,
        employeeId: selectedReportEmployee.id,
        employeeName: selectedReportEmployee.name,
        lote: reportLote === "all" ? undefined : reportLote,
        status: reportStatus,
      })
    : [];
  const reportVisits =
    reportScope === "mine"
      ? mineReportVisits
      : selectedReportEmployee
        ? employeeReportVisits
        : teamReportVisits;
  const completeReportVisits = filterVisitsForReport(loadVisits(), {
    farmId: context?.farm_id,
    status: "all",
  });
  const completeReportMetrics = visitReportMetrics(completeReportVisits);
  const reportAgenda = Array.from(agendaByDate(today, scopedEmployeeId).values()).flat();
  const reportMetrics = visitReportMetrics(reportVisits, reportAgenda);
  const comparisonVisits = filterVisitsForReport(loadVisits(), {
    farmId: context?.farm_id,
    employeeId: scopedEmployeeId,
    employeeName: scopedEmployeeName,
    lote: reportLote === "all" ? undefined : reportLote,
    status: reportStatus,
  });
  const monthComparison = monthlyComparisonFromVisits(comparisonVisits, reportTo || today);
  const operationalBreakdown = operationalBreakdownFromVisits(reportVisits);
  const currentAnimals = allAnimals();
  const currentHerdMetrics = {
    registered: currentAnimals.length,
    visited: currentAnimals.filter((animal) => animal.totalVisits > 0).length,
    withProblem: currentAnimals.filter((animal) => animal.hasProblem).length,
    withoutProblem: currentAnimals.filter((animal) => animal.totalVisits > 0 && !animal.hasProblem)
      .length,
    light: currentAnimals.filter((animal) => animal.worstSeverity === 1).length,
    moderate: currentAnimals.filter((animal) => animal.worstSeverity === 2).length,
    severe: currentAnimals.filter((animal) => animal.worstSeverity === 3).length,
    withTaco: currentAnimals.filter((animal) => animal.hasTaco).length,
    withRecheck: currentAnimals.filter((animal) => animal.hasRecheck).length,
  };
  const employeeMetricRows = farmEmployees.map((employee) => {
    const visits = filterVisitsForReport(loadVisits(), {
      dateFrom: reportFrom,
      dateTo: reportTo,
      employeeId: employee.id,
      employeeName: employee.name,
      lote: reportLote === "all" ? undefined : reportLote,
      status: reportStatus,
    });
    return { employee, metrics: visitReportMetrics(visits) };
  });
  const normalizedDataSearch = dataSearch.trim().toLocaleLowerCase("pt-BR");
  const operationalVisits = loadVisits()
    .filter(visitIsFinalized)
    .filter(
      (visit) =>
        !normalizedDataSearch ||
        visit.tag.toLocaleLowerCase("pt-BR").includes(normalizedDataSearch) ||
        visit.employee_name?.toLocaleLowerCase("pt-BR").includes(normalizedDataSearch),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  const operationalAnimals = allAnimals().filter(
    (animal) =>
      !normalizedDataSearch || animal.tag.toLocaleLowerCase("pt-BR").includes(normalizedDataSearch),
  );

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await adminService.unlock(pin);
      setPin("");
      setUnlocked(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível liberar o acesso.");
    } finally {
      setLoading(false);
    }
  }

  async function runAction(action: string, payload: Record<string, unknown>, success: string) {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await adminService.action(action, payload);
      setNotice(success);
      await loadOverview();
      return true;
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Não foi possível concluir a ação.";
      setError(message);
      if (message.includes("expirado")) setUnlocked(false);
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function createFarm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction(
      "create_farm",
      { name: farmName, max_devices: Number(farmMaxDevices) || 10, grace_period_days: 7 },
      "Fazenda criada e vinculada ao seu acesso.",
    );
    setFarmName("");
    setFarmMaxDevices("10");
    setShowFarmForm(false);
  }

  function openFarmEdit(farm: AdminFarm) {
    setEditingFarm(farm);
    setFarmEditForm({ name: farm.name, max_devices: String(farm.max_devices) });
  }

  async function submitFarmEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingFarm) return;
    const updated = await runAction(
      "update_farm",
      {
        farm_id: editingFarm.id,
        name: farmEditForm.name,
        max_devices: Number(farmEditForm.max_devices) || editingFarm.max_devices,
        status: editingFarm.status,
      },
      `Fazenda ${farmEditForm.name} atualizada.`,
    );
    if (updated) setEditingFarm(null);
  }

  async function createEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runAction("create_employee", employeeForm, "Funcionário criado com sucesso.");
    setEmployeeForm({
      name: "",
      login_name: "",
      employee_code: "",
      pin: "",
      farm_id: context?.farm_id ?? overview.farms[0]?.id ?? "",
      is_admin: false,
    });
    setShowEmployeeForm(false);
  }

  async function submitResetPin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetEmployee) return;
    await runAction(
      "reset_employee_pin",
      { employee_id: resetEmployee.id, pin: resetPin },
      `PIN de ${resetEmployee.name} redefinido.`,
    );
    setResetEmployee(null);
    setResetPin("");
  }

  function openEmployeeEdit(employee: AdminEmployee) {
    setEditingEmployee(employee);
    setEmployeeEditForm({
      name: employee.name,
      login_name: employee.login_name,
      employee_code: employee.employee_code,
    });
  }

  async function submitEmployeeEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingEmployee) return;
    const updated = await runAction(
      "edit_employee",
      { employee_id: editingEmployee.id, ...employeeEditForm },
      `Cadastro de ${employeeEditForm.name} atualizado.`,
    );
    if (updated) setEditingEmployee(null);
  }

  async function removeEmployee() {
    if (!removingEmployee) return;
    const removed = await runAction(
      "remove_employee",
      { employee_id: removingEmployee.id },
      `${removingEmployee.name} foi excluído da equipe ativa. O histórico foi preservado.`,
    );
    if (removed) setRemovingEmployee(null);
  }

  async function removeOperationalData() {
    if (!removingData || !context) return;
    const reason = dataRemovalReason.trim();
    if (reason.length < 3) {
      setError("Informe o motivo da exclusão com pelo menos 3 caracteres.");
      return;
    }

    const removed =
      removingData.kind === "visit"
        ? await runAction(
            "cancel_visit",
            { visit_id: removingData.visit.id, reason },
            `Visita do animal ${removingData.visit.tag} excluída.`,
          )
        : await runAction(
            "remove_animal",
            { farm_id: context.farm_id, tag: removingData.tag, reason },
            `Animal ${removingData.tag} e seus atendimentos ativos foram excluídos.`,
          );

    if (!removed) return;
    setRemovingData(null);
    setDataRemovalReason("");
    await onDataChanged?.();
  }

  async function exportAdminPdf(mode: "complete" | "filtered") {
    setExportingPdf(true);
    setError("");
    try {
      const syncResult = await syncService.syncAll();
      if (!syncResult.ok && syncResult.message !== "Offline.") {
        throw new Error(syncResult.message || "Não foi possível atualizar os atendimentos.");
      }
      const complete = mode === "complete";
      await exportVisitsPdf({
        visits: loadVisits(),
        agenda: complete ? Array.from(agendaByDate(today).values()).flat() : reportAgenda,
        farmName: context?.farm_name || loadFarm().farmName || "Fazenda",
        reportTitle: complete
          ? "Relatório completo de casqueamento da fazenda"
          : reportScope === "mine"
            ? `Relatório de casqueamento · ${context?.employee_name ?? "Administrador"}`
            : selectedReportEmployee
              ? `Relatório de casqueamento · ${selectedReportEmployee.name}`
              : "Relatório de casqueamento da equipe",
        scopeLabel: complete
          ? "Todos os funcionários, tipos e datas da fazenda"
          : reportScope === "mine"
            ? `Somente ${context?.employee_name ?? "administrador"}`
            : selectedReportEmployee
              ? `Somente ${selectedReportEmployee.name}`
              : "Administrador e funcionários da fazenda",
        includeEmployeeBreakdown: complete || (reportScope === "team" && !selectedReportEmployee),
        filters: complete ? { farmId: context?.farm_id, status: "all" } : reportFilters,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível gerar o PDF.");
    } finally {
      setExportingPdf(false);
    }
  }

  if (!context?.is_admin) {
    return (
      <section className="py-12 text-center" aria-labelledby="admin-negado">
        <ShieldOff className="mx-auto h-12 w-12 text-danger" aria-hidden="true" />
        <h1 id="admin-negado" className="mt-4 font-display text-xl font-black uppercase">
          Acesso restrito
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          Somente o administrador da empresa pode alterar fazendas, equipe, aparelhos e licenças.
        </p>
      </section>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <section className="py-12 text-center">
        <ShieldOff className="mx-auto h-12 w-12 text-warn-foreground" aria-hidden="true" />
        <h1 className="mt-4 font-display text-xl font-black uppercase">Modo local</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A administração de contas fica disponível quando o servidor está configurado.
        </p>
      </section>
    );
  }

  if (!unlocked) {
    return (
      <section className="mx-auto max-w-md py-8" aria-labelledby="manager-title">
        <div className="border-b border-border pb-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <LockKeyhole className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 id="manager-title" className="mt-4 font-display text-xl font-black uppercase">
            Administração
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {context.employee_name}, confirme seu PIN para continuar.
          </p>
        </div>
        <form className="mt-5 space-y-3" onSubmit={unlock}>
          <label className="block">
            <span className="text-xs font-bold uppercase text-muted-foreground">Seu PIN</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={pin}
              onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              className="mt-1 min-h-14 w-full rounded-lg border-2 border-border bg-surface px-4 text-center text-xl font-bold outline-none [-webkit-text-security:disc] focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30"
              aria-label="PIN do administrador"
            />
          </label>
          <button
            type="submit"
            disabled={loading || pin.length < 4}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <ShieldCheck className="h-5 w-5" />
            )}
            Entrar
          </button>
        </form>
        {error ? (
          <p role="alert" className="mt-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; description: string; icon: typeof Building2 }> =
    [
      { id: "reports", label: "Desempenho", description: "Métricas e PDF", icon: BarChart3 },
      { id: "data", label: "Registros", description: "Visitas e animais", icon: Database },
      { id: "farms", label: "Fazendas", description: "Unidades separadas", icon: Building2 },
      { id: "employees", label: "Equipe", description: "Pessoas e acessos", icon: Users },
      { id: "devices", label: "Aparelhos", description: "Celulares e tablets", icon: Laptop },
      { id: "licenses", label: "Licença", description: "Validade do uso", icon: CalendarClock },
      { id: "audit", label: "Auditoria", description: "Ações realizadas", icon: ShieldCheck },
    ];

  return (
    <div className="space-y-5 pb-8">
      <section className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-muted-foreground">Empresa</p>
          <h1 className="truncate font-display text-xl font-black uppercase">
            {context.client_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestão de acesso e cobrança</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface text-primary"
          aria-label="Atualizar administração"
          title="Atualizar"
        >
          <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
        </button>
      </section>

      <div
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        role="tablist"
        aria-label="Administração"
      >
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
              className={cn(
                "flex min-h-16 items-center gap-2 rounded-lg border px-3 text-left",
                tab === item.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-xs font-black uppercase">{item.label}</span>
                <span
                  className={cn(
                    "mt-0.5 block text-[10px]",
                    tab === item.id ? "opacity-85" : "text-muted-foreground",
                  )}
                >
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p role="status" className="rounded-lg bg-good/10 p-3 text-sm font-semibold text-good">
          {notice}
        </p>
      ) : null}

      {tab === "reports" && (
        <section className="space-y-5" aria-labelledby="reports-title">
          <div>
            <h2 id="reports-title" className="font-display text-lg font-black uppercase">
              Desempenho da fazenda
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Atendimentos finalizados e situação atual dos animais desta fazenda.
            </p>
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-black uppercase">Filtros do período</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Os números de produção seguem estas escolhas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReportFrom(`${today.slice(0, 7)}-01`);
                  setReportTo(today);
                  setReportScope("team");
                  setReportEmployeeId("all");
                  setReportStatus("all");
                  setReportLote("all");
                }}
                className="min-h-10 shrink-0 rounded-lg bg-surface px-3 text-xs font-black uppercase text-primary"
              >
                Limpar
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <fieldset className="sm:col-span-2">
                <legend className="text-[10px] font-black uppercase text-muted-foreground">
                  Quem entra no relatório
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2 rounded-lg bg-surface p-1.5">
                  <button
                    type="button"
                    onClick={() => setReportScope("mine")}
                    aria-pressed={reportScope === "mine"}
                    className={cn(
                      "min-h-12 rounded-md px-3 text-left",
                      reportScope === "mine"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    <span className="block font-display text-xs font-black uppercase">
                      Só o meu
                    </span>
                    <span className="block text-[10px] opacity-80">
                      {mineReportVisits.length} visita(s) do administrador
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportScope("team")}
                    aria-pressed={reportScope === "team"}
                    className={cn(
                      "min-h-12 rounded-md px-3 text-left",
                      reportScope === "team"
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground",
                    )}
                  >
                    <span className="block font-display text-xs font-black uppercase">
                      Toda a equipe
                    </span>
                    <span className="block text-[10px] opacity-80">
                      {teamReportVisits.length} visita(s) de todos
                    </span>
                  </button>
                </div>
                <p className="mt-2 rounded-lg bg-background px-3 py-2 text-xs font-semibold text-foreground">
                  {reportScope === "team"
                    ? selectedReportEmployee
                      ? `Mostrando ${employeeReportVisits.length} visita(s) de ${selectedReportEmployee.name} neste período.`
                      : `Mostrando as ${teamReportVisits.length} visita(s) da equipe neste período.`
                    : `Mostrando ${mineReportVisits.length} visita(s) suas. Existem ${teamReportVisits.length} visita(s) da equipe neste período.`}
                </p>
              </fieldset>
              {reportScope === "team" && (
                <label className="sm:col-span-2">
                  <span className="text-[10px] font-black uppercase text-muted-foreground">
                    Funcionário analisado
                  </span>
                  <select
                    value={reportEmployeeId}
                    onChange={(event) => setReportEmployeeId(event.target.value)}
                    className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                  >
                    <option value="all">Toda a equipe reunida</option>
                    {farmEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    Escolha uma pessoa para aplicar os mesmos comparativos, doenças, pés e animais
                    somente aos atendimentos dela.
                  </span>
                </label>
              )}
              <label>
                <span className="text-[10px] font-black uppercase text-muted-foreground">
                  Tipo de atendimento
                </span>
                <select
                  value={reportStatus}
                  onChange={(event) => setReportStatus(event.target.value as VisitReportStatus)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                >
                  <option value="all">Todos os tipos</option>
                  <option value="preventive">Preventivo sem lesão</option>
                  <option value="normal">Sem lesão, não preventivo</option>
                  <option value="problem">Com problema</option>
                  <option value="light">Problema leve</option>
                  <option value="moderate">Problema moderado</option>
                  <option value="severe">Problema grave</option>
                  <option value="recheck">Com revisão</option>
                  <option value="taco">Com taco</option>
                </select>
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-muted-foreground">
                  Data inicial
                </span>
                <input
                  type="date"
                  value={reportFrom}
                  max={reportTo || undefined}
                  onChange={(event) => setReportFrom(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-[10px] font-black uppercase text-muted-foreground">
                  Data final
                </span>
                <input
                  type="date"
                  value={reportTo}
                  min={reportFrom || undefined}
                  onChange={(event) => setReportTo(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Lote</span>
                <select
                  value={reportLote}
                  onChange={(event) => setReportLote(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                >
                  <option value="all">Todos os lotes</option>
                  {loadFarm().lotes.map((lote) => (
                    <option key={lote} value={lote}>
                      {lote}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section aria-labelledby="production-title">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 id="production-title" className="font-display text-base font-black uppercase">
                Produção no período
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Atendimentos conta visitas finalizadas. Animais únicos conta brincos diferentes, então
              pode ser menor.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile
                value={reportMetrics.visits}
                label="Atendimentos"
                help="Visitas finalizadas no período"
              />
              <MetricTile
                value={reportMetrics.animals}
                label="Animais únicos"
                help="Brincos diferentes atendidos"
              />
              <MetricTile
                value={reportMetrics.withoutProblem}
                label="Sem lesão"
                help="Atendimentos sem problema ativo"
                tone="good"
              />
              <MetricTile
                value={reportMetrics.withProblem}
                label="Com problema"
                help="Atendimentos com problema ativo"
                tone="warn"
              />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MetricTile
                value={reportMetrics.preventive}
                label="Preventivos"
                help="Sem lesão e marcados como preventivo"
                tone="good"
              />
              <MetricTile
                value={reportMetrics.scheduledReviews}
                label="Revisões futuras"
                help="Datas geradas para estas visitas"
                tone="warn"
              />
              <MetricTile
                value={reportMetrics.withTaco}
                label="Ação de taco"
                help="Visitas com colocar, deixar ou retirar"
              />
              <MetricTile
                value={reportMetrics.tacosApplied}
                label="Tacos colocados"
                help="Quantidade colocada no período"
              />
            </div>
          </section>

          <section
            className="rounded-lg border border-border bg-card p-4"
            aria-labelledby="severity-title"
          >
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-danger" aria-hidden="true" />
              <h3 id="severity-title" className="font-display text-sm font-black uppercase">
                Gravidade das lesões
              </h3>
            </div>
            <div className="mt-3 grid grid-cols-3 divide-x divide-border text-center">
              <div className="px-2">
                <p className="font-display text-2xl font-black text-warn-foreground">
                  {reportMetrics.light}
                </p>
                <p className="text-[10px] font-black uppercase">Leves · G1</p>
              </div>
              <div className="px-2">
                <p className="font-display text-2xl font-black text-warn-foreground">
                  {reportMetrics.moderate}
                </p>
                <p className="text-[10px] font-black uppercase">Moderados · G2</p>
              </div>
              <div className="px-2">
                <p className="font-display text-2xl font-black text-danger">
                  {reportMetrics.severe}
                </p>
                <p className="text-[10px] font-black uppercase">Graves · G3</p>
              </div>
            </div>
          </section>

          <MonthlyComparisonPanel comparison={monthComparison} />

          <OperationalBreakdownPanel
            breakdown={operationalBreakdown}
            periodLabel={`período de ${new Date(`${reportFrom}T12:00:00`).toLocaleDateString("pt-BR")} a ${new Date(`${reportTo}T12:00:00`).toLocaleDateString("pt-BR")}`}
          />

          <section aria-labelledby="herd-title">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 id="herd-title" className="font-display text-base font-black uppercase">
                Situação atual dos animais
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Cada brinco aparece uma vez. Este bloco usa toda a evolução clínica e não muda com o
              período acima.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetricTile
                value={currentHerdMetrics.registered}
                label="Cadastrados"
                help="Total de brincos da fazenda"
              />
              <MetricTile
                value={currentHerdMetrics.visited}
                label="Já atendidos"
                help="Com pelo menos uma visita"
              />
              <MetricTile
                value={currentHerdMetrics.withoutProblem}
                label="Sem problema ativo"
                help="Situação clínica atual"
                tone="good"
              />
              <MetricTile
                value={currentHerdMetrics.withProblem}
                label="Em acompanhamento"
                help="Doença ou taco ainda ativo"
                tone="warn"
              />
              <MetricTile
                value={currentHerdMetrics.withRecheck}
                label="Revisão aberta"
                help="Animais com próxima revisão"
                tone="warn"
              />
              <MetricTile
                value={currentHerdMetrics.withTaco}
                label="Taco ativo"
                help="Ainda não foi retirado"
              />
            </div>
            <div className="mt-2 grid grid-cols-3 rounded-lg border border-border bg-card py-3 text-center">
              <div>
                <p className="font-display text-xl font-black">{currentHerdMetrics.light}</p>
                <p className="text-[9px] font-black uppercase">Leve</p>
              </div>
              <div className="border-x border-border">
                <p className="font-display text-xl font-black">{currentHerdMetrics.moderate}</p>
                <p className="text-[9px] font-black uppercase">Moderado</p>
              </div>
              <div>
                <p className="font-display text-xl font-black text-danger">
                  {currentHerdMetrics.severe}
                </p>
                <p className="text-[9px] font-black uppercase">Grave</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border-2 border-primary/30 bg-primary/5 p-4">
            <h3 className="font-display text-base font-black uppercase">Exportar relatório</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              O PDF completo ignora os filtros acima e inclui todo o histórico ativo da fazenda:
              preventivos, animais com problema e atendimentos normais.
            </p>
            <p className="mt-3 rounded-lg bg-card px-3 py-2 text-xs font-bold text-foreground">
              Completo: {completeReportMetrics.visits} atendimento(s) ·{" "}
              {completeReportMetrics.preventive} preventivo(s) · {completeReportMetrics.withProblem}{" "}
              com problema · {completeReportMetrics.normal} normal(is)
            </p>
            <button
              type="button"
              onClick={() => void exportAdminPdf("complete")}
              disabled={exportingPdf || completeReportMetrics.visits === 0}
              className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"
            >
              {exportingPdf ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Download className="h-5 w-5" />
              )}
              Baixar PDF completo da fazenda
            </button>
            <button
              type="button"
              onClick={() => void exportAdminPdf("filtered")}
              disabled={exportingPdf || reportVisits.length === 0}
              className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border-2 border-primary bg-card px-4 font-display text-sm font-black uppercase text-primary disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {reportScope === "mine"
                ? "Baixar meu PDF filtrado"
                : selectedReportEmployee
                  ? `Baixar PDF filtrado de ${selectedReportEmployee.name}`
                  : "Baixar PDF filtrado da equipe"}
            </button>
            <p className="mt-2 text-center text-xs leading-relaxed text-muted-foreground">
              Os dois formatos detalham cada visita e mostram separadamente FE, FD, TE e TD.
            </p>
          </section>

          {reportScope === "team" && !selectedReportEmployee && (
            <section>
              <h3 className="font-display text-base font-black uppercase">
                Produção por funcionário
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Mesma fazenda, período, lote e tipo escolhidos acima.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {employeeMetricRows.map(({ employee, metrics }) => (
                  <article
                    key={employee.id}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <p className="truncate font-display text-sm font-black uppercase">
                      {employee.name}
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="font-display text-xl font-black">{metrics.visits}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">Atend.</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black">{metrics.animals}</p>
                        <p className="text-[9px] uppercase text-muted-foreground">Animais</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black text-good">
                          {metrics.preventive}
                        </p>
                        <p className="text-[9px] uppercase text-muted-foreground">Prevent.</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black text-warn-foreground">
                          {metrics.light}
                        </p>
                        <p className="text-[9px] uppercase text-muted-foreground">Leves</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black text-warn-foreground">
                          {metrics.moderate}
                        </p>
                        <p className="text-[9px] uppercase text-muted-foreground">Moder.</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-black text-danger">
                          {metrics.severe}
                        </p>
                        <p className="text-[9px] uppercase text-muted-foreground">Graves</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </section>
      )}

      {tab === "data" && (
        <section className="space-y-4" aria-labelledby="data-title">
          <div>
            <h2 id="data-title" className="font-display text-lg font-black uppercase">
              Dados da fazenda
            </h2>
            <p className="text-xs text-muted-foreground">
              Corrija ou exclua registros somente da fazenda atual
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Tipo de dado">
            <button
              type="button"
              onClick={() => setDataMode("visits")}
              aria-pressed={dataMode === "visits"}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-xs font-black uppercase",
                dataMode === "visits"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              Visitas ({loadVisits().length})
            </button>
            <button
              type="button"
              onClick={() => setDataMode("animals")}
              aria-pressed={dataMode === "animals"}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-xs font-black uppercase",
                dataMode === "animals"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              Animais ({allAnimals().length})
            </button>
          </div>

          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={dataSearch}
              onChange={(event) => setDataSearch(event.target.value)}
              inputMode={dataMode === "animals" ? "numeric" : "search"}
              aria-label={dataMode === "animals" ? "Buscar animal" : "Buscar visita"}
              placeholder={
                dataMode === "animals" ? "Buscar brinco" : "Buscar brinco ou funcionário"
              }
              className="min-h-12 w-full rounded-lg border border-border bg-surface pl-11 pr-3 outline-none focus:border-primary"
            />
          </label>

          {dataMode === "visits" ? (
            <div className="divide-y divide-border border-y border-border">
              {operationalVisits.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhuma visita encontrada.
                </p>
              ) : (
                operationalVisits.slice(0, 100).map((visit) => (
                  <article key={visit.id} className="long-list-item py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-lg font-black uppercase">
                          Brinco {visit.tag}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(visit.createdAt).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                          {visit.employee_name ? " · " + visit.employee_name : ""}
                          {visit.lote ? " · lote " + visit.lote : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase",
                          visit.preventivo
                            ? "bg-good/10 text-good"
                            : "bg-warn/15 text-warn-foreground",
                        )}
                      >
                        {visit.preventivo ? "Preventivo" : "Clínico"}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => onCorrectVisit?.(visit)}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface px-3 text-xs font-bold"
                      >
                        <Pencil className="h-4 w-4 text-primary" /> Editar/corrigir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRemovingData({ kind: "visit", visit });
                          setDataRemovalReason("");
                        }}
                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-danger/10 px-3 text-xs font-bold text-danger"
                      >
                        <Trash2 className="h-4 w-4" /> Excluir
                      </button>
                    </div>
                  </article>
                ))
              )}
              {operationalVisits.length > 100 ? (
                <p className="py-3 text-center text-xs text-muted-foreground">
                  Mostrando as 100 visitas mais recentes. Use a busca para localizar outra.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {operationalAnimals.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Nenhum animal encontrado.
                </p>
              ) : (
                operationalAnimals.map((animal) => (
                  <article key={animal.tag} className="flex items-center gap-3 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-black uppercase">
                        Brinco {animal.tag}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {animal.totalVisits} visita(s)
                        {animal.lote ? " · lote " + animal.lote : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onManageAnimals}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-primary"
                      aria-label={"Editar animal " + animal.tag}
                      title="Editar cadastro"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRemovingData({
                          kind: "animal",
                          tag: animal.tag,
                          totalVisits: animal.totalVisits,
                        });
                        setDataRemovalReason("");
                      }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger"
                      aria-label={"Excluir animal " + animal.tag}
                      title="Excluir animal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))
              )}
            </div>
          )}

          <p className="rounded-lg bg-warn/10 p-3 text-xs text-warn-foreground">
            Exclusões retiram o registro da operação e dos relatórios, mas mantêm a auditoria de
            quem excluiu, quando e por quê.
          </p>
        </section>
      )}

      {tab === "farms" && (
        <section className="space-y-4" aria-labelledby="farms-title">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="farms-title" className="font-display text-lg font-black uppercase">
                Gestão de fazendas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cada fazenda possui animais, visitas, agenda e regras próprias.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowFarmForm((value) => !value)}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-black uppercase text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Adicionar
            </button>
          </div>
          <p className="flex items-start gap-2 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            Funcionários só enxergam as fazendas permitidas. Dados de uma fazenda nunca entram nos
            relatórios de outra.
          </p>
          {showFarmForm && (
            <form
              onSubmit={createFarm}
              className="rounded-lg border-2 border-primary/30 bg-card p-4"
            >
              <h3 className="font-display text-sm font-black uppercase">Adicionar fazenda</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="text-[10px] font-black uppercase text-muted-foreground">
                    Nome da fazenda
                  </span>
                  <input
                    required
                    value={farmName}
                    onChange={(event) => setFarmName(event.target.value)}
                    placeholder="Ex.: Fazenda Vitória"
                    className="mt-1 min-h-12 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </label>
                <label>
                  <span className="text-[10px] font-black uppercase text-muted-foreground">
                    Limite de celulares e tablets
                  </span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={100}
                    value={farmMaxDevices}
                    onChange={(event) => setFarmMaxDevices(event.target.value)}
                    className="mt-1 min-h-12 w-full rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShowFarmForm(false)}
                  className="min-h-12 rounded-lg border border-border bg-surface px-4 font-bold"
                >
                  Cancelar
                </button>
                <button
                  disabled={loading}
                  className="min-h-12 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
                >
                  Criar fazenda
                </button>
              </div>
            </form>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.farms.map((farm) => {
              const employeeCount = overview.employees.filter(
                (employee) => employee.status === "active" && employee.farm_ids.includes(farm.id),
              ).length;
              const deviceCount = overview.devices.filter(
                (device) => device.status === "active" && device.farm_id === farm.id,
              ).length;
              const license = overview.licenses.find((item) => item.farm_id === farm.id);
              return (
                <article key={farm.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Building2
                      className="mt-0.5 h-6 w-6 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-black uppercase">{farm.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Base de dados independente
                      </p>
                    </div>
                    <StatusBadge status={farm.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-3 divide-x divide-border text-center">
                    <div>
                      <dt className="text-[9px] font-black uppercase text-muted-foreground">
                        Equipe
                      </dt>
                      <dd className="font-display text-xl font-black">{employeeCount}</dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-black uppercase text-muted-foreground">
                        Aparelhos
                      </dt>
                      <dd className="font-display text-xl font-black">
                        {deviceCount}/{farm.max_devices}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[9px] font-black uppercase text-muted-foreground">
                        Licença
                      </dt>
                      <dd className="mt-1 text-[10px] font-black uppercase">
                        {license?.status === "active" ? "Ativa" : "Bloqueada"}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => openFarmEdit(farm)}
                      className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-surface px-3 text-xs font-black uppercase"
                    >
                      <Pencil className="h-4 w-4 text-primary" /> Editar
                    </button>
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        void runAction(
                          "update_farm",
                          {
                            farm_id: farm.id,
                            status: farm.status === "active" ? "blocked" : "active",
                          },
                          `Fazenda ${farm.status === "active" ? "bloqueada" : "reativada"}.`,
                        )
                      }
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black uppercase",
                        farm.status === "active"
                          ? "bg-danger/10 text-danger"
                          : "bg-good/10 text-good",
                      )}
                    >
                      {farm.status === "active" ? (
                        <ShieldOff className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      {farm.status === "active" ? "Bloquear" : "Reativar"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "employees" && (
        <section aria-labelledby="employees-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="employees-title" className="font-display text-lg font-black uppercase">
                Equipe
              </h2>
              <p className="text-xs text-muted-foreground">Login, PIN e acesso por fazenda</p>
            </div>
            <button
              type="button"
              onClick={() => setShowEmployeeForm((value) => !value)}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-black uppercase text-primary-foreground"
            >
              <UserPlus className="h-4 w-4" /> Novo
            </button>
          </div>
          {showEmployeeForm && (
            <form
              onSubmit={createEmployee}
              className="mb-4 grid gap-3 border-y border-border bg-surface/50 py-4 sm:grid-cols-2"
            >
              <input
                required
                value={employeeForm.name}
                onChange={(e) => setEmployeeForm((v) => ({ ...v, name: e.target.value }))}
                placeholder="Nome"
                aria-label="Nome do funcionário"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
              <input
                required
                value={employeeForm.login_name}
                onChange={(e) => setEmployeeForm((v) => ({ ...v, login_name: e.target.value }))}
                placeholder="Login"
                aria-label="Login do funcionário"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
              <input
                required
                value={employeeForm.employee_code}
                onChange={(e) => setEmployeeForm((v) => ({ ...v, employee_code: e.target.value }))}
                placeholder="Código, ex.: 004"
                aria-label="Código do funcionário"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
              <input
                required
                type="text"
                inputMode="numeric"
                maxLength={6}
                pattern="[0-9]{4,6}"
                value={employeeForm.pin}
                onChange={(e) =>
                  setEmployeeForm((v) => ({ ...v, pin: e.target.value.replace(/\D/g, "") }))
                }
                placeholder="PIN inicial"
                aria-label="PIN inicial"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none [-webkit-text-security:disc] focus:border-primary"
              />
              <select
                required
                value={employeeForm.farm_id}
                onChange={(e) => setEmployeeForm((v) => ({ ...v, farm_id: e.target.value }))}
                aria-label="Fazenda principal"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              >
                <option value="">Fazenda principal</option>
                {overview.farms
                  .filter((farm) => farm.status === "active")
                  .map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {farm.name}
                    </option>
                  ))}
              </select>
              <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-background px-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={employeeForm.is_admin}
                  onChange={(e) => setEmployeeForm((v) => ({ ...v, is_admin: e.target.checked }))}
                  className="h-5 w-5 accent-primary"
                />{" "}
                Administrador
              </label>
              <button
                disabled={loading}
                className="min-h-12 rounded-lg bg-primary px-4 font-bold text-primary-foreground sm:col-span-2"
              >
                Criar funcionário
              </button>
            </form>
          )}
          <div className="divide-y divide-border border-y border-border">
            {overview.employees.map((employee) => (
              <article key={employee.id} className="space-y-3 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display font-black text-primary">
                    {employee.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-black uppercase">{employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {employee.login_name} · código {employee.employee_code}
                    </p>
                  </div>
                  {employee.is_admin ? (
                    <span className="text-[10px] font-black uppercase text-primary">Gerente</span>
                  ) : null}
                  <StatusBadge status={employee.status} blockedLabel="Excluído" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openEmployeeEdit(employee)}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-bold"
                  >
                    <Pencil className="h-4 w-4 text-primary" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetEmployee(employee)}
                    className="flex min-h-10 items-center gap-2 rounded-lg bg-surface px-3 text-xs font-bold"
                  >
                    <KeyRound className="h-4 w-4 text-primary" /> Redefinir PIN
                  </button>
                  <button
                    type="button"
                    disabled={loading || employee.id === context.employee_id}
                    onClick={() => {
                      if (employee.status === "active") {
                        setRemovingEmployee(employee);
                        return;
                      }
                      void runAction(
                        "update_employee",
                        {
                          employee_id: employee.id,
                          status: "active",
                          is_admin: employee.is_admin,
                        },
                        "Funcionário restaurado e liberado para acessar o app.",
                      );
                    }}
                    className={cn(
                      "flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs font-bold disabled:opacity-40",
                      employee.status === "active"
                        ? "bg-danger/10 text-danger"
                        : "bg-surface text-primary",
                    )}
                  >
                    {employee.status === "active" ? (
                      <>
                        <Trash2 className="h-4 w-4" /> Excluir
                      </>
                    ) : (
                      "Restaurar acesso"
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={loading || employee.id === context.employee_id}
                    onClick={() =>
                      void runAction(
                        "update_employee",
                        {
                          employee_id: employee.id,
                          status: employee.status,
                          is_admin: !employee.is_admin,
                        },
                        employee.is_admin
                          ? "Acesso gerente removido."
                          : "Acesso gerente concedido.",
                      )
                    }
                    className="min-h-10 rounded-lg bg-surface px-3 text-xs font-bold disabled:opacity-40"
                  >
                    {employee.is_admin ? "Remover gerente" : "Tornar gerente"}
                  </button>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-black uppercase text-muted-foreground">
                    Fazendas permitidas
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {overview.farms.map((farm) => {
                      const assigned = employee.farm_ids.includes(farm.id);
                      return (
                        <button
                          key={farm.id}
                          type="button"
                          disabled={loading}
                          onClick={() =>
                            void runAction(
                              "assign_employee_farm",
                              { employee_id: employee.id, farm_id: farm.id, assigned: !assigned },
                              "Acesso às fazendas atualizado.",
                            )
                          }
                          className={cn(
                            "min-h-9 rounded-full border px-3 text-xs font-bold",
                            assigned
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground",
                          )}
                        >
                          {assigned ? <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" /> : null}
                          {farm.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "devices" && (
        <section aria-labelledby="devices-title">
          <h2 id="devices-title" className="font-display text-lg font-black uppercase">
            Aparelhos
          </h2>
          <div className="mb-3 rounded-lg border border-border bg-card p-3">
            <p className="text-sm font-bold">
              {activeDeviceCount} ativo(s) · {blockedDeviceCount} bloqueado(s)
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Entrar novamente no mesmo navegador apenas atualiza o último acesso. Um novo registro
              só deve surgir em outro celular, outro navegador ou após apagar os dados do site.
            </p>
          </div>
          <div className="divide-y divide-border border-y border-border">
            {managedDevices.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhum aparelho ativado.</p>
            ) : (
              managedDevices.map((device) => (
                <article key={device.id} className="flex flex-wrap items-center gap-3 py-4">
                  <Laptop className="h-6 w-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {deviceDisplayName(device.device_name)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {employeeNames.get(device.employee_id ?? "") ?? "Sem funcionário"} ·{" "}
                      {farmNames.get(device.farm_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Último acesso: {formatDate(device.last_seen_at)}
                    </p>
                  </div>
                  <StatusBadge status={device.status} />
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() =>
                      void runAction(
                        "update_device_status",
                        {
                          device_id: device.id,
                          status: device.status === "active" ? "blocked" : "active",
                        },
                        `Aparelho ${device.status === "active" ? "bloqueado" : "reativado"}.`,
                      )
                    }
                    className="min-h-10 rounded-lg bg-surface px-3 text-xs font-bold"
                  >
                    {device.status === "active" ? "Bloquear" : "Reativar"}
                  </button>
                </article>
              ))
            )}
          </div>
        </section>
      )}

      {tab === "licenses" && (
        <section aria-labelledby="licenses-title">
          <h2 id="licenses-title" className="font-display text-lg font-black uppercase">
            Licenças
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Controle de acesso comercial por fazenda
          </p>
          <div className="divide-y divide-border border-y border-border">
            {overview.licenses.map((license) => (
              <article key={license.id} className="space-y-3 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <CalendarClock className="h-6 w-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{farmNames.get(license.farm_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      Validade:{" "}
                      {license.expires_at ? formatDate(license.expires_at) : "Sem vencimento"}
                    </p>
                  </div>
                  <StatusBadge status={license.status} />
                </div>
                <p className="pl-0 text-xs text-muted-foreground sm:pl-9">
                  Validade gerenciada pelo fornecedor do sistema.
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "audit" && (
        <section aria-labelledby="audit-title">
          <h2 id="audit-title" className="font-display text-lg font-black uppercase">
            Auditoria
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">Últimas 50 ações administrativas</p>
          <ol className="divide-y divide-border border-y border-border">
            {overview.audit.length === 0 ? (
              <li className="py-6 text-sm text-muted-foreground">Nenhuma ação registrada.</li>
            ) : (
              overview.audit.map((entry) => (
                <li key={entry.id} className="flex gap-3 py-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold">
                      {ACTION_LABELS[entry.action] ?? entry.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {employeeNames.get(entry.employee_id ?? "") ?? "Sistema"} ·{" "}
                      {formatDate(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ol>
        </section>
      )}

      {editingFarm && (
        <div
          className="modal-viewport fixed inset-0 z-50 flex items-end bg-foreground/45 px-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-farm-title"
        >
          <form
            onSubmit={submitFarmEdit}
            className="modal-panel w-full max-w-md rounded-lg bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-farm-title" className="font-display text-lg font-black uppercase">
                  Editar fazenda
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Altere o nome e o limite de aparelhos desta unidade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingFarm(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface"
                aria-label="Fechar edição da fazenda"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Nome</span>
                <input
                  required
                  value={farmEditForm.name}
                  onChange={(event) =>
                    setFarmEditForm((form) => ({ ...form, name: event.target.value }))
                  }
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">
                  Limite de celulares e tablets
                </span>
                <input
                  required
                  type="number"
                  min={1}
                  max={100}
                  value={farmEditForm.max_devices}
                  onChange={(event) =>
                    setFarmEditForm((form) => ({ ...form, max_devices: event.target.value }))
                  }
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
            </div>
            <button
              disabled={loading}
              className="mt-4 min-h-12 w-full rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-50"
            >
              Salvar fazenda
            </button>
          </form>
        </div>
      )}

      {editingEmployee && (
        <div
          className="modal-viewport fixed inset-0 z-50 flex items-end bg-foreground/45 px-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-employee-title"
        >
          <form
            onSubmit={submitEmployeeEdit}
            className="modal-panel w-full max-w-md rounded-lg bg-background p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="edit-employee-title" className="font-display text-lg font-black uppercase">
                  Editar funcionário
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Nome, login e código de acesso</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface"
                aria-label="Fechar edição de funcionário"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Nome</span>
                <input
                  required
                  value={employeeEditForm.name}
                  onChange={(event) =>
                    setEmployeeEditForm((form) => ({ ...form, name: event.target.value }))
                  }
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Login</span>
                <input
                  required
                  value={employeeEditForm.login_name}
                  onChange={(event) =>
                    setEmployeeEditForm((form) => ({ ...form, login_name: event.target.value }))
                  }
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
              <label>
                <span className="text-xs font-bold uppercase text-muted-foreground">Código</span>
                <input
                  required
                  value={employeeEditForm.employee_code}
                  onChange={(event) =>
                    setEmployeeEditForm((form) => ({ ...form, employee_code: event.target.value }))
                  }
                  className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
                />
              </label>
            </div>
            <button
              disabled={loading}
              className="mt-4 min-h-12 w-full rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-50"
            >
              Salvar alterações
            </button>
          </form>
        </div>
      )}

      {removingEmployee && (
        <div
          className="modal-viewport fixed inset-0 z-50 flex items-end bg-foreground/45 px-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-employee-title"
        >
          <div className="modal-panel w-full max-w-sm rounded-lg bg-background p-5 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2
              id="remove-employee-title"
              className="mt-4 font-display text-lg font-black uppercase"
            >
              Excluir funcionário?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {removingEmployee.name} perderá o acesso imediatamente. As visitas, métricas e
              registros de auditoria serão mantidos e o acesso poderá ser restaurado depois.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRemovingEmployee(null)}
                className="min-h-12 rounded-lg bg-surface font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => void removeEmployee()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-danger px-3 font-bold text-danger-foreground disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Excluir acesso
              </button>
            </div>
          </div>
        </div>
      )}

      {removingData && (
        <div
          className="modal-viewport fixed inset-0 z-50 flex items-end bg-foreground/45 px-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-data-title"
        >
          <div className="modal-panel w-full max-w-sm rounded-lg bg-background p-5 shadow-2xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-danger/10 text-danger">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </div>
            <h2 id="remove-data-title" className="mt-4 font-display text-lg font-black uppercase">
              {removingData.kind === "visit" ? "Excluir visita?" : "Excluir animal?"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {removingData.kind === "visit"
                ? "A visita do brinco " +
                  removingData.visit.tag +
                  " sairá do histórico operacional e dos relatórios."
                : "O brinco " +
                  removingData.tag +
                  " e " +
                  removingData.totalVisits +
                  " visita(s) sairão da operação."}{" "}
              A auditoria será preservada.
            </p>
            <label className="mt-4 block">
              <span className="text-xs font-bold uppercase text-muted-foreground">
                Motivo obrigatório
              </span>
              <textarea
                required
                maxLength={300}
                value={dataRemovalReason}
                onChange={(event) => setDataRemovalReason(event.target.value)}
                placeholder="Ex.: registro duplicado"
                aria-label="Motivo da exclusão"
                className="mt-1 min-h-24 w-full resize-y rounded-lg border-2 border-border bg-surface p-3 outline-none focus:border-primary"
              />
            </label>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRemovingData(null);
                  setDataRemovalReason("");
                }}
                className="min-h-12 rounded-lg bg-surface font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading || dataRemovalReason.trim().length < 3}
                onClick={() => void removeOperationalData()}
                className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-danger px-3 font-bold text-danger-foreground disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {resetEmployee && (
        <div
          className="modal-viewport fixed inset-0 z-50 flex items-end bg-foreground/45 px-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pin-title"
        >
          <form
            onSubmit={submitResetPin}
            className="modal-panel w-full max-w-sm rounded-lg bg-background p-5 shadow-2xl"
          >
            <h2 id="reset-pin-title" className="font-display text-lg font-black uppercase">
              Novo PIN
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Redefinir o acesso de {resetEmployee.name}
            </p>
            <input
              required
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4,6}"
              maxLength={6}
              value={resetPin}
              onChange={(event) => setResetPin(event.target.value.replace(/\D/g, ""))}
              aria-label="Novo PIN do funcionário"
              className="mt-4 min-h-14 w-full rounded-lg border-2 border-border bg-surface px-4 text-center text-xl font-bold outline-none [-webkit-text-security:disc] focus:border-primary"
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setResetEmployee(null);
                  setResetPin("");
                }}
                className="min-h-12 rounded-lg bg-surface font-bold"
              >
                Cancelar
              </button>
              <button
                disabled={loading || resetPin.length < 4}
                className="min-h-12 rounded-lg bg-primary font-bold text-primary-foreground disabled:opacity-50"
              >
                Salvar PIN
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
