import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  KeyRound,
  Laptop,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Pencil,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { farmContextService } from "@/services/farm-context.service";
import { adminService, type AdminEmployee, type AdminOverview } from "@/services/admin.service";
import { isSupabaseConfigured } from "@/services/supabase";
import { agendaByDate, loadFarm, loadVisits, todayISO } from "@/lib/casco-store";
import {
  exportVisitsPdf,
  filterVisitsForReport,
  visitReportMetrics,
  type VisitReportStatus,
} from "@/lib/visit-report";

type AdminTab = "reports" | "farms" | "employees" | "devices" | "licenses" | "audit";

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

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-full px-2.5 text-[10px] font-black uppercase",
        active ? "bg-good/10 text-good" : "bg-danger/10 text-danger",
      )}
    >
      {active ? "Ativo" : status === "expired" ? "Expirado" : "Bloqueado"}
    </span>
  );
}

export function AdminScreen() {
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
  const [employeeEditForm, setEmployeeEditForm] = useState({
    name: "",
    login_name: "",
    employee_code: "",
  });
  const today = todayISO();
  const [reportFrom, setReportFrom] = useState(`${today.slice(0, 7)}-01`);
  const [reportTo, setReportTo] = useState(today);
  const [reportEmployeeId, setReportEmployeeId] = useState("all");
  const [reportStatus, setReportStatus] = useState<VisitReportStatus>("all");
  const [reportLote, setReportLote] = useState("all");
  const [exportingPdf, setExportingPdf] = useState(false);

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

  const farmNames = useMemo(
    () => new Map(overview.farms.map((farm) => [farm.id, farm.name])),
    [overview.farms],
  );
  const employeeNames = useMemo(
    () => new Map(overview.employees.map((employee) => [employee.id, employee.name])),
    [overview.employees],
  );
  const reportEmployee = overview.employees.find((employee) => employee.id === reportEmployeeId);
  const reportFilters = {
    dateFrom: reportFrom,
    dateTo: reportTo,
    employeeId: reportEmployee?.id,
    employeeName: reportEmployee?.name,
    lote: reportLote === "all" ? undefined : reportLote,
    status: reportStatus,
  };
  const reportVisits = filterVisitsForReport(loadVisits(), reportFilters);
  const reportAgenda = Array.from(agendaByDate(today, reportEmployee?.id).values()).flat();
  const reportMetrics = visitReportMetrics(reportVisits, reportAgenda);
  const farmEmployees = overview.employees.filter(
    (employee) => !context?.farm_id || employee.farm_ids.includes(context.farm_id),
  );
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

  async function exportAdminPdf() {
    setExportingPdf(true);
    setError("");
    try {
      await exportVisitsPdf({
        visits: loadVisits(),
        agenda: reportAgenda,
        farmName: context?.farm_name || loadFarm().farmName || "Fazenda",
        reportTitle:
          reportEmployeeId === "all"
            ? "Relatório geral de casqueamento"
            : `Relatório de casqueamento · ${reportEmployee?.name ?? "Funcionário"}`,
        filters: reportFilters,
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

  const tabs: Array<{ id: AdminTab; label: string; icon: typeof Building2 }> = [
    { id: "reports", label: "Relatórios", icon: FileText },
    { id: "farms", label: "Fazendas", icon: Building2 },
    { id: "employees", label: "Equipe", icon: Users },
    { id: "devices", label: "Aparelhos", icon: Laptop },
    { id: "licenses", label: "Licenças", icon: CalendarClock },
    { id: "audit", label: "Auditoria", icon: ShieldCheck },
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
        className="-mx-4 overflow-x-auto border-b border-border px-4"
        role="tablist"
        aria-label="Administração"
      >
        <div className="flex min-w-max gap-1 pb-2">
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
                  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-black uppercase",
                  tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
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
              Produção da equipe
            </h2>
            <p className="text-xs text-muted-foreground">
              Filtros e PDF da fazenda atual, sem misturar outras fazendas
            </p>
          </div>

          <div className="grid gap-3 border-y border-border py-4 sm:grid-cols-2">
            <label>
              <span className="text-[10px] font-black uppercase text-muted-foreground">
                Funcionário
              </span>
              <select
                value={reportEmployeeId}
                onChange={(event) => setReportEmployeeId(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
              >
                <option value="all">Toda a equipe</option>
                {farmEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="text-[10px] font-black uppercase text-muted-foreground">Tipo</span>
              <select
                value={reportStatus}
                onChange={(event) => setReportStatus(event.target.value as VisitReportStatus)}
                className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
              >
                <option value="all">Todos</option>
                <option value="preventive">Preventivos</option>
                <option value="normal">Cascos normais</option>
                <option value="problem">Com problema</option>
                <option value="recheck">Com revisão</option>
              </select>
            </label>
            <label>
              <span className="text-[10px] font-black uppercase text-muted-foreground">De</span>
              <input
                type="date"
                value={reportFrom}
                max={reportTo || undefined}
                onChange={(event) => setReportFrom(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="text-[10px] font-black uppercase text-muted-foreground">Até</span>
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

          <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-3">
            {[
              ["Visitas", reportMetrics.visits],
              ["Animais", reportMetrics.animals],
              ["Preventivos", reportMetrics.preventive],
              ["Normais", reportMetrics.normal],
              ["Problemas", reportMetrics.withProblem],
              ["Revisões", reportMetrics.scheduledReviews],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="border-b border-r border-border px-2 py-3 text-center"
              >
                <p className="font-display text-2xl font-black text-primary">{value}</p>
                <p className="text-[9px] font-bold uppercase text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void exportAdminPdf()}
            disabled={exportingPdf}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"
          >
            {exportingPdf ? (
              <LoaderCircle className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            Exportar PDF filtrado
          </button>

          {reportEmployeeId === "all" && (
            <div>
              <h3 className="font-display text-sm font-black uppercase">Por funcionário</h3>
              <div className="mt-2 divide-y divide-border border-y border-border">
                {employeeMetricRows.map(({ employee, metrics }) => (
                  <div
                    key={employee.id}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {metrics.animals} animal(is) · {metrics.preventive} preventivo(s)
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-xl font-black">{metrics.visits}</p>
                      <p className="text-[9px] uppercase text-muted-foreground">Visitas</p>
                    </div>
                    <div className="text-center">
                      <p className="font-display text-xl font-black text-warn-foreground">
                        {metrics.withProblem}
                      </p>
                      <p className="text-[9px] uppercase text-muted-foreground">Problemas</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "farms" && (
        <section aria-labelledby="farms-title">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 id="farms-title" className="font-display text-lg font-black uppercase">
                Fazendas
              </h2>
              <p className="text-xs text-muted-foreground">Dados sempre separados por fazenda</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFarmForm((value) => !value)}
              className="flex min-h-11 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-black uppercase text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Nova
            </button>
          </div>
          {showFarmForm && (
            <form
              onSubmit={createFarm}
              className="mb-4 grid gap-3 border-y border-border bg-surface/50 py-4 sm:grid-cols-[1fr_8rem_auto]"
            >
              <input
                required
                value={farmName}
                onChange={(event) => setFarmName(event.target.value)}
                placeholder="Nome da fazenda"
                aria-label="Nome da nova fazenda"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
              <input
                required
                type="number"
                min={1}
                max={100}
                value={farmMaxDevices}
                onChange={(event) => setFarmMaxDevices(event.target.value)}
                aria-label="Limite de aparelhos"
                className="min-h-12 rounded-lg border border-border bg-background px-3 outline-none focus:border-primary"
              />
              <button
                disabled={loading}
                className="min-h-12 rounded-lg bg-primary px-4 font-bold text-primary-foreground"
              >
                Criar
              </button>
            </form>
          )}
          <div className="divide-y divide-border border-y border-border">
            {overview.farms.map((farm) => (
              <article key={farm.id} className="flex items-center gap-3 py-4">
                <Building2 className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-black uppercase">{farm.name}</p>
                  <p className="text-xs text-muted-foreground">Até {farm.max_devices} aparelhos</p>
                </div>
                <StatusBadge status={farm.status} />
                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    void runAction(
                      "update_farm",
                      { farm_id: farm.id, status: farm.status === "active" ? "blocked" : "active" },
                      `Fazenda ${farm.status === "active" ? "bloqueada" : "reativada"}.`,
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface text-primary"
                  aria-label={
                    farm.status === "active" ? `Bloquear ${farm.name}` : `Reativar ${farm.name}`
                  }
                  title={farm.status === "active" ? "Bloquear" : "Reativar"}
                >
                  {farm.status === "active" ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </button>
              </article>
            ))}
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
                  <StatusBadge status={employee.status} />
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
                    onClick={() =>
                      void runAction(
                        "update_employee",
                        {
                          employee_id: employee.id,
                          status: employee.status === "active" ? "blocked" : "active",
                          is_admin: employee.is_admin,
                        },
                        `Funcionário ${employee.status === "active" ? "bloqueado" : "reativado"}.`,
                      )
                    }
                    className="min-h-10 rounded-lg bg-surface px-3 text-xs font-bold disabled:opacity-40"
                  >
                    {employee.status === "active" ? "Remover acesso" : "Restaurar acesso"}
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
          <p className="mb-3 text-xs text-muted-foreground">
            Bloquear interrompe a próxima sincronização
          </p>
          <div className="divide-y divide-border border-y border-border">
            {overview.devices.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhum aparelho ativado.</p>
            ) : (
              overview.devices.map((device) => (
                <article key={device.id} className="flex items-center gap-3 py-4">
                  <Laptop className="h-6 w-6 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">
                      {employeeNames.get(device.employee_id ?? "") ?? "Sem funcionário"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {farmNames.get(device.farm_id)} · {formatDate(device.last_seen_at)}
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

      {editingEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-foreground/45 p-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-employee-title"
        >
          <form
            onSubmit={submitEmployeeEdit}
            className="w-full max-w-md rounded-lg bg-background p-5 shadow-2xl"
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

      {resetEmployee && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-foreground/45 p-3 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-pin-title"
        >
          <form
            onSubmit={submitResetPin}
            className="w-full max-w-sm rounded-lg bg-background p-5 shadow-2xl"
          >
            <h2 id="reset-pin-title" className="font-display text-lg font-black uppercase">
              Novo PIN
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Redefinir o acesso de {resetEmployee.name}
            </p>
            <input
              autoFocus
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
