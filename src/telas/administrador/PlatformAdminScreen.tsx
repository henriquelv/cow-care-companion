import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity,
  Building2,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  ChevronLeft,
  CircleAlert,
  ClipboardCopy,
  Database,
  HardDrive,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Server,
  Eye,
  EyeOff,
  UserCog,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/dominio/utils";
import { ListSearch } from "@/componentes/comum/ListSearch";
import { ActionToast } from "@/componentes/comum/ActionToast";
import {
  platformAdminService,
  type PlatformClient,
  type PlatformEmployee,
  type PlatformFarm,
  type PlatformFarmSelection,
  type PlatformDiagnostics,
  type PlatformLocalDiagnostics,
  type PlatformOverview,
} from "@/servicos/platform-admin.service";

type EmployeeForm = {
  name: string;
  login_name: string;
  employee_code: string;
  pin: string;
  farm_id: string;
  is_admin: boolean;
};

const emptyEmployeeForm: EmployeeForm = {
  name: "",
  login_name: "",
  employee_code: "",
  pin: "1234",
  farm_id: "",
  is_admin: false,
};

function statusLabel(status: string) {
  return status === "active" ? "Ativo" : status === "blocked" ? "Bloqueado" : "Expirado";
}

const DIAGNOSTIC_LABELS: Record<string, string> = {
  manager_session_started: "Acesso administrativo confirmado",
  create_farm: "Fazenda criada",
  update_farm: "Fazenda atualizada",
  create_employee: "Funcionário criado",
  update_employee: "Funcionário atualizado",
  edit_employee: "Cadastro do funcionário atualizado",
  reset_employee_pin: "PIN de funcionário redefinido",
  cancel_visit: "Visita enviada para a lixeira",
  remove_animal: "Animal enviado para a lixeira",
  restore_visit: "Visita restaurada",
  restore_animal: "Animal restaurado",
};

export function PlatformAdminScreen({
  onExit,
  onOpenFarm,
}: {
  onExit: () => void;
  onOpenFarm: (
    selection: PlatformFarmSelection,
    destination?: "today" | "calendar" | "config",
  ) => Promise<void> | void;
}) {
  const [unlocked, setUnlocked] = useState(() => platformAdminService.isUnlocked());
  const [pin, setPin] = useState("");
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newFarmName, setNewFarmName] = useState("");
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const [resetTarget, setResetTarget] = useState<PlatformEmployee | null>(null);
  const [resetPin, setResetPin] = useState("1234");
  const [showResetPin, setShowResetPin] = useState(false);
  const [editingFarm, setEditingFarm] = useState<PlatformFarm | null>(null);
  const [editingFarmName, setEditingFarmName] = useState("");
  const [editingEmployee, setEditingEmployee] = useState<PlatformEmployee | null>(null);
  const [editingEmployeeForm, setEditingEmployeeForm] = useState({
    name: "",
    login_name: "",
    employee_code: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [diagnostics, setDiagnostics] = useState<PlatformDiagnostics | null>(null);
  const [localDiagnostics, setLocalDiagnostics] = useState<PlatformLocalDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsError, setDiagnosticsError] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [confirmSessionRepair, setConfirmSessionRepair] = useState(false);

  const selectedClient = useMemo(
    () =>
      overview?.clients.find((client) => client.id === selectedClientId) ??
      overview?.clients[0] ??
      null,
    [overview, selectedClientId],
  );
  const farms = useMemo(
    () => overview?.farms.filter((farm) => farm.client_id === selectedClient?.id) ?? [],
    [overview, selectedClient?.id],
  );
  const employees = useMemo(
    () => overview?.employees.filter((employee) => employee.client_id === selectedClient?.id) ?? [],
    [overview, selectedClient?.id],
  );
  const normalizedSearch = listSearch.trim().toLocaleLowerCase("pt-BR");
  const filteredClients =
    overview?.clients.filter((client) =>
      [client.name, client.activation_code, client.status].some((value) =>
        value.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
      ),
    ) ?? [];
  const filteredFarms = farms.filter((farm) =>
    [farm.name, farm.status].some((value) =>
      value.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
    ),
  );
  const filteredEmployees = employees.filter((employee) =>
    [
      employee.name,
      employee.login_name,
      employee.employee_code,
      employee.status,
      farmName(employee.farm_id),
    ].some((value) => value.toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
  );

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const next = await platformAdminService.overview();
      setOverview(next);
      setSelectedClientId((current) =>
        next.clients.some((client) => client.id === current)
          ? current
          : (next.clients[0]?.id ?? ""),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar os dados.");
    } finally {
      setLoading(false);
    }
  }

  async function runDiagnostics() {
    setDiagnosticsLoading(true);
    setDiagnosticsError("");
    try {
      const local = await platformAdminService.localDiagnostics();
      setLocalDiagnostics(local);
      setDiagnostics(await platformAdminService.diagnostics());
    } catch (reason) {
      setDiagnosticsError(
        reason instanceof Error ? reason.message : "Não foi possível verificar o sistema.",
      );
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  useEffect(() => {
    if (!unlocked) return;
    void refresh();
    void runDiagnostics();
  }, [unlocked]);

  useEffect(() => {
    if (!unlocked) return;
    const timer = window.setInterval(() => void runDiagnostics(), 5 * 60_000);
    return () => window.clearInterval(timer);
  }, [unlocked]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await platformAdminService.unlock(pin);
      setPin("");
      setUnlocked(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível liberar a conta.");
    } finally {
      setLoading(false);
    }
  }

  async function save(action: string, payload: Record<string, unknown>, success: string) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await platformAdminService.action(action, payload);
      await refresh();
      setMessage(success);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar a alteração.");
    } finally {
      setLoading(false);
    }
  }

  function farmName(farmId: string) {
    return overview?.farms.find((farm) => farm.id === farmId)?.name ?? "Sem fazenda";
  }

  async function copyDiagnostics() {
    if (!diagnostics || !localDiagnostics) return;
    const summary = {
      checked_at: diagnostics.checked_at,
      project_ref: localDiagnostics.projectRef,
      server_status: diagnostics.server_status,
      response_ms: diagnostics.response_ms,
      counts: diagnostics.counts,
      integrity: diagnostics.integrity,
      local: {
        online: localDiagnostics.online,
        service_worker_active: localDiagnostics.serviceWorkerActive,
        last_sync_at: localDiagnostics.lastSyncAt,
        pending_items: localDiagnostics.pendingItems,
        error_items: localDiagnostics.errorItems,
      },
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
      setMessage("Diagnóstico copiado sem senhas ou chaves de acesso.");
    } catch {
      setDiagnosticsError(
        "O navegador não permitiu copiar. Tente novamente em uma conexão segura.",
      );
    }
  }

  async function repairStaleWorkSessions() {
    setDiagnosticsLoading(true);
    setDiagnosticsError("");
    try {
      const result = await platformAdminService.closeStaleWorkSessions();
      setConfirmSessionRepair(false);
      setMessage(
        result.repairedCount === 1
          ? "1 sessão antiga foi encerrada sem apagar atendimentos."
          : `${result.repairedCount} sessões antigas foram encerradas sem apagar atendimentos.`,
      );
      await runDiagnostics();
    } catch (reason) {
      setDiagnosticsError(
        reason instanceof Error ? reason.message : "Não foi possível concluir a correção.",
      );
    } finally {
      setDiagnosticsLoading(false);
    }
  }

  async function openFarm(
    farm: PlatformFarm,
    destination: "today" | "calendar" | "config" = "today",
  ) {
    setLoading(true);
    setError("");
    try {
      const selection = await platformAdminService.openFarm(farm.id);
      await onOpenFarm(selection, destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível abrir esta fazenda.");
    } finally {
      setLoading(false);
    }
  }

  if (!unlocked) {
    return (
      <main className="min-h-[100dvh] bg-background px-4 py-6">
        <section className="mx-auto w-full max-w-md rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
          <button
            type="button"
            onClick={onExit}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface"
            aria-label="Sair da conta mestra"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-black uppercase">Conta mestra</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Administração central de empresas, fazendas, equipe e acessos. Confirme o PIN para abrir
            os dados.
          </p>
          <form className="mt-6 space-y-3" onSubmit={unlock}>
            <label className="block text-xs font-bold uppercase text-muted-foreground">
              PIN da conta mestra
              <input
                name="platform-pin"
                autoComplete="off"
                aria-label="PIN da conta mestra"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-center text-xl font-bold tracking-[0.18em] outline-none [-webkit-text-security:disc] focus:border-primary"
                placeholder="••••"
              />
            </label>
            <button
              disabled={loading || pin.length < 4}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"
            >
              {loading ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <LockKeyhole className="h-5 w-5" />
              )}
              Abrir administração
            </button>
          </form>
          {error ? (
            <p
              role="alert"
              className="mt-4 rounded-xl bg-destructive/10 px-3 py-3 text-sm font-bold text-destructive"
            >
              {error}
            </p>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-10">
      <header className="border-b-2 border-border bg-card px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-black uppercase sm:text-lg">
              Administração central
            </p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Conta mestra · empresas independentes
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} />
          </button>
          <button
            type="button"
            onClick={() => {
              platformAdminService.clear();
              onExit();
            }}
            className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface"
            aria-label="Sair da conta mestra"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive"
          >
            {error}
          </p>
        ) : null}
        <section
          className="rounded-lg border-2 border-border bg-card p-4"
          aria-labelledby="system-health-title"
        >
          <div className="flex flex-wrap items-start gap-3">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                diagnostics && diagnostics.issues_total === 0 && !diagnosticsError
                  ? "bg-good/10 text-good"
                  : diagnosticsError
                    ? "bg-danger/10 text-danger"
                    : "bg-warn/15 text-warn-foreground",
              )}
            >
              <Activity className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Exclusivo da conta 000
              </p>
              <h2 id="system-health-title" className="font-display text-lg font-black uppercase">
                Central de saúde do sistema
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Servidor, sincronização deste aparelho e integridade dos dados.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runDiagnostics()}
              disabled={diagnosticsLoading}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border-2 border-border bg-surface px-3 text-xs font-black uppercase disabled:opacity-50 sm:w-auto"
            >
              <RefreshCw
                className={cn("h-4 w-4", diagnosticsLoading && "animate-spin")}
                aria-hidden="true"
              />
              Verificar
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-surface text-center">
            <div className="min-w-0 px-2 py-3">
              <Server
                className={cn("mx-auto h-5 w-5", diagnosticsError ? "text-danger" : "text-good")}
                aria-hidden="true"
              />
              <strong className="mt-1 block text-xs uppercase">
                {diagnosticsError ? "Falha" : diagnostics ? "Online" : "Verificando"}
              </strong>
              <span className="block text-[9px] uppercase text-muted-foreground">Servidor</span>
            </div>
            <div className="min-w-0 px-2 py-3">
              {localDiagnostics?.online === false ? (
                <WifiOff className="mx-auto h-5 w-5 text-warn-foreground" aria-hidden="true" />
              ) : (
                <Wifi className="mx-auto h-5 w-5 text-good" aria-hidden="true" />
              )}
              <strong className="mt-1 block text-xs uppercase">
                {localDiagnostics
                  ? `${localDiagnostics.pendingItems + localDiagnostics.errorItems} pendência(s)`
                  : "Verificando"}
              </strong>
              <span className="block text-[9px] uppercase text-muted-foreground">
                Este aparelho
              </span>
            </div>
            <div className="min-w-0 px-2 py-3">
              {!diagnostics ? (
                <LoaderCircle
                  className="mx-auto h-5 w-5 animate-spin text-muted-foreground"
                  aria-hidden="true"
                />
              ) : diagnostics.issues_total === 0 ? (
                <CheckCircle2 className="mx-auto h-5 w-5 text-good" aria-hidden="true" />
              ) : (
                <CircleAlert className="mx-auto h-5 w-5 text-danger" aria-hidden="true" />
              )}
              <strong className="mt-1 block text-xs uppercase">
                {diagnostics ? diagnostics.issues_total : "—"}
              </strong>
              <span className="block text-[9px] uppercase text-muted-foreground">
                Alertas de dados
              </span>
            </div>
          </div>

          {diagnosticsError ? (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-danger/10 p-3 text-sm font-semibold text-danger"
            >
              {diagnosticsError} Confira a internet e execute a verificação novamente.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => setShowDiagnostics((current) => !current)}
            aria-expanded={showDiagnostics}
            className="mt-3 min-h-11 w-full rounded-lg bg-primary/10 px-3 text-sm font-black uppercase text-primary"
          >
            {showDiagnostics ? "Ocultar detalhes" : "Ver processos e erros"}
          </button>

          {showDiagnostics ? (
            <div className="mt-4 space-y-4 border-t border-border pt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-display text-sm font-black uppercase">Supabase</h3>
                  </div>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Projeto</dt>
                      <dd className="break-all text-right font-bold" translate="no">
                        {localDiagnostics?.projectRef ?? "Verificando"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Resposta</dt>
                      <dd className="font-bold tabular-nums">
                        {diagnostics ? `${diagnostics.response_ms} ms` : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Última verificação</dt>
                      <dd className="text-right font-bold tabular-nums">
                        {diagnostics
                          ? new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(diagnostics.checked_at))
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="rounded-lg bg-surface p-3">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-primary" aria-hidden="true" />
                    <h3 className="font-display text-sm font-black uppercase">Aplicativo local</h3>
                  </div>
                  <dl className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Modo offline pronto</dt>
                      <dd className="font-bold">
                        {localDiagnostics?.serviceWorkerActive ? "Sim" : "Ainda não"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Última sincronização</dt>
                      <dd className="text-right font-bold tabular-nums">
                        {localDiagnostics?.lastSyncAt
                          ? new Intl.DateTimeFormat("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(localDiagnostics.lastSyncAt))
                          : "Nunca neste aparelho"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Armazenamento usado</dt>
                      <dd className="font-bold tabular-nums">
                        {localDiagnostics?.storageUsedMb === undefined
                          ? "—"
                          : `${localDiagnostics.storageUsedMb} MB`}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <section aria-labelledby="integrity-title">
                <h3 id="integrity-title" className="font-display text-sm font-black uppercase">
                  Conferências automáticas
                </h3>
                <div className="mt-2 divide-y divide-border rounded-lg border border-border">
                  {[
                    ["Visitas sem animal cadastrado", diagnostics?.integrity.visits_without_animal],
                    [
                      "Visitas sem os 4 cascos avaliados",
                      diagnostics?.integrity.visits_incomplete_feet,
                    ],
                    ["Cascos vinculados à fazenda errada", diagnostics?.integrity.feet_wrong_farm],
                    [
                      "Funcionários ativos sem fazenda",
                      diagnostics?.integrity.employees_without_farm,
                    ],
                    [
                      "Visitas à fazenda abertas há mais de 12 h",
                      diagnostics?.integrity.work_sessions_stale,
                    ],
                    ["Fazendas ativas sem licença válida", diagnostics?.counts.licenses_invalid],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm"
                    >
                      {value === 0 ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-hidden="true" />
                      ) : (
                        <CircleAlert className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                      )}
                      <span className="min-w-0 flex-1">{label}</span>
                      <strong className="tabular-nums">{value ?? "—"}</strong>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  Casco normal também conta como avaliado. O alerta aparece somente quando falta o
                  registro de FE, FD, TE ou TD.
                </p>
                {(diagnostics?.integrity.work_sessions_stale ?? 0) > 0 ? (
                  <div className="mt-3 rounded-lg border-2 border-warn bg-warn/10 p-3">
                    <p className="text-sm font-bold text-foreground">
                      Existem visitas à fazenda esquecidas em andamento.
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      A correção encerra somente sessões abertas há mais de 12 horas. Os
                      atendimentos realizados não são apagados.
                    </p>
                    {confirmSessionRepair ? (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmSessionRepair(false)}
                          disabled={diagnosticsLoading}
                          className="min-h-11 rounded-lg border-2 border-border bg-card px-3 text-xs font-black uppercase"
                        >
                          Manter abertas
                        </button>
                        <button
                          type="button"
                          onClick={() => void repairStaleWorkSessions()}
                          disabled={diagnosticsLoading}
                          className="min-h-11 rounded-lg bg-primary px-3 text-xs font-black uppercase text-primary-foreground disabled:opacity-50"
                        >
                          Confirmar correção
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmSessionRepair(true)}
                        className="mt-3 min-h-11 w-full rounded-lg bg-primary px-3 text-xs font-black uppercase text-primary-foreground"
                      >
                        Corrigir sessões antigas
                      </button>
                    )}
                  </div>
                ) : null}
              </section>

              {localDiagnostics?.errorMessages.length ? (
                <section aria-labelledby="local-errors-title">
                  <h3 id="local-errors-title" className="font-display text-sm font-black uppercase">
                    Erros de sincronização deste aparelho
                  </h3>
                  <ul className="mt-2 space-y-2">
                    {localDiagnostics.errorMessages.map((errorMessage) => (
                      <li
                        key={errorMessage}
                        className="break-words rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger"
                      >
                        {errorMessage}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby="recent-events-title">
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id="recent-events-title"
                    className="font-display text-sm font-black uppercase"
                  >
                    Processos administrativos recentes
                  </h3>
                  <button
                    type="button"
                    onClick={() => void copyDiagnostics()}
                    disabled={!diagnostics || !localDiagnostics}
                    className="flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-border px-2 text-[10px] font-black uppercase disabled:opacity-50"
                  >
                    <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
                    Copiar
                  </button>
                </div>
                {diagnostics?.recent_events.length ? (
                  <ol className="mt-2 divide-y divide-border rounded-lg border border-border">
                    {diagnostics.recent_events.slice(0, 8).map((event, index) => (
                      <li
                        key={`${event.created_at}:${event.action}:${index}`}
                        className="px-3 py-2.5"
                      >
                        <p className="text-sm font-bold">
                          {DIAGNOSTIC_LABELS[event.action] ?? event.action.replaceAll("_", " ")}
                        </p>
                        <p className="mt-0.5 break-words text-[11px] text-muted-foreground">
                          {event.client_name ?? "Sistema"}
                          {event.employee_name ? ` · ${event.employee_name}` : ""} ·{" "}
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(new Date(event.created_at))}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-2 rounded-lg bg-surface p-3 text-sm text-muted-foreground">
                    Nenhum processo administrativo recente.
                  </p>
                )}
              </section>
            </div>
          ) : null}
        </section>

        <ListSearch
          value={listSearch}
          onChange={setListSearch}
          placeholder="Buscar empresa, fazenda ou funcionário"
          resultLabel="A busca filtra todas as listas desta administração"
        />

        <section className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="font-display font-black uppercase">Empresas</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Escolha uma empresa para administrar suas fazendas e funcionários. Os dados continuam
            isolados entre elas.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {filteredClients.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => setSelectedClientId(client.id)}
                className={cn(
                  "min-h-16 rounded-xl border-2 px-4 text-left",
                  selectedClient?.id === client.id
                    ? "border-primary bg-primary/5"
                    : "border-border bg-surface",
                )}
              >
                <span className="block font-display font-black uppercase">{client.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  Código {client.activation_code} · {statusLabel(client.status)}
                </span>
              </button>
            ))}
          </div>
        </section>

        {selectedClient ? (
          <>
            <section className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                <h2 className="font-display font-black uppercase">
                  Fazendas de {selectedClient.name}
                </h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {filteredFarms.map((farm) => (
                  <article
                    key={farm.id}
                    className="rounded-xl border-2 border-border bg-surface p-3"
                  >
                    <p className="font-display font-black uppercase">{farm.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{statusLabel(farm.status)}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                      <button
                        type="button"
                        disabled={loading || farm.status !== "active"}
                        onClick={() => void openFarm(farm)}
                        className="min-h-11 rounded-lg bg-primary px-2 py-2 text-xs font-bold uppercase leading-tight text-primary-foreground disabled:opacity-50 sm:px-3"
                      >
                        Abrir fazenda
                      </button>
                      <button
                        type="button"
                        disabled={loading || farm.status !== "active"}
                        onClick={() => void openFarm(farm, "calendar")}
                        className="flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 border-primary bg-card px-2 py-2 text-xs font-bold uppercase leading-tight text-primary disabled:opacity-50 sm:px-3"
                      >
                        <CalendarDays className="h-4 w-4" />
                        Agenda e PDF
                      </button>
                      {selectedClient.activation_code === "HULLSJOB" ? (
                        <button
                          type="button"
                          disabled={loading || farm.status !== "active"}
                          onClick={() => void openFarm(farm, "config")}
                          className="flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 border-primary bg-card px-2 py-2 text-xs font-bold uppercase leading-tight text-primary disabled:opacity-50 sm:px-3"
                        >
                          <CircleDollarSign className="h-4 w-4" />
                          Valores
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setEditingFarm(farm);
                          setEditingFarmName(farm.name);
                        }}
                        className="flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 border-border bg-card px-2 py-2 text-xs font-bold uppercase leading-tight sm:px-3"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          void save(
                            "update_farm",
                            {
                              farm_id: farm.id,
                              status: farm.status === "active" ? "blocked" : "active",
                            },
                            farm.status === "active" ? "Fazenda bloqueada." : "Fazenda reativada.",
                          )
                        }
                        className="col-span-2 min-h-11 rounded-lg border-2 border-border bg-card px-3 py-2 text-xs font-bold uppercase leading-tight sm:col-span-1"
                      >
                        {farm.status === "active" ? "Bloquear" : "Reativar"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <form
                className="mt-4 grid gap-2 rounded-xl bg-primary/5 p-3 sm:grid-cols-[1fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newFarmName.trim())
                    void save(
                      "create_farm",
                      { client_id: selectedClient.id, name: newFarmName },
                      "Nova fazenda cadastrada.",
                    ).then(() => setNewFarmName(""));
                }}
              >
                <input
                  name="new-farm-name"
                  autoComplete="off"
                  aria-label="Nome da nova fazenda"
                  value={newFarmName}
                  onChange={(event) => setNewFarmName(event.target.value)}
                  placeholder="Nome da nova fazenda"
                  className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
                />
                <button
                  disabled={loading || newFarmName.trim().length < 2}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  Adicionar fazenda
                </button>
              </form>
            </section>

            <section className="rounded-2xl border-2 border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h2 className="font-display font-black uppercase">Funcionários</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A senha nunca é exibida. Use redefinir PIN para criar um novo acesso quando
                necessário.
              </p>
              <div className="mt-4 grid gap-2">
                {filteredEmployees.map((employee) => (
                  <article
                    key={employee.id}
                    className="rounded-xl border-2 border-border bg-surface p-3"
                  >
                    <div className="flex gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary">
                        <UserCog className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-black uppercase">{employee.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {employee.login_name} · código {employee.employee_code} ·{" "}
                          {farmName(employee.farm_id)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-bold",
                          employee.status === "active" ? "text-good" : "text-destructive",
                        )}
                      >
                        {statusLabel(employee.status)}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingEmployee(employee);
                          setEditingEmployeeForm({
                            name: employee.name,
                            login_name: employee.login_name,
                            employee_code: employee.employee_code,
                          });
                        }}
                        className="flex min-h-10 items-center gap-1 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase"
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => setResetTarget(employee)}
                        className="min-h-10 rounded-lg bg-primary px-3 text-xs font-bold uppercase text-primary-foreground"
                      >
                        <KeyRound className="mr-1 inline h-4 w-4" />
                        Redefinir PIN
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          void save(
                            "update_employee",
                            {
                              employee_id: employee.id,
                              status: employee.status === "active" ? "blocked" : "active",
                            },
                            employee.status === "active"
                              ? "Funcionário bloqueado."
                              : "Funcionário reativado.",
                          )
                        }
                        className="min-h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase"
                      >
                        {employee.status === "active" ? "Bloquear" : "Reativar"}
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() =>
                          void save(
                            "update_employee",
                            { employee_id: employee.id, is_admin: !employee.is_admin },
                            employee.is_admin
                              ? "Acesso de gerente removido."
                              : "Acesso de gerente concedido.",
                          )
                        }
                        className="min-h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase"
                      >
                        {employee.is_admin ? "Remover gerente" : "Tornar gerente"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <form
                className="mt-4 space-y-3 rounded-xl bg-primary/5 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (employeeForm.farm_id)
                    void save("create_employee", employeeForm, "Funcionário cadastrado.").then(() =>
                      setEmployeeForm({ ...emptyEmployeeForm, farm_id: employeeForm.farm_id }),
                    );
                }}
              >
                <p className="font-display text-sm font-black uppercase">Novo funcionário</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    name="employee-name"
                    autoComplete="name"
                    aria-label="Nome completo do funcionário"
                    value={employeeForm.name}
                    onChange={(event) =>
                      setEmployeeForm((form) => ({ ...form, name: event.target.value }))
                    }
                    placeholder="Nome completo"
                    className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
                  />
                  <input
                    name="employee-login"
                    autoComplete="username"
                    aria-label="Login do funcionário"
                    value={employeeForm.login_name}
                    onChange={(event) =>
                      setEmployeeForm((form) => ({ ...form, login_name: event.target.value }))
                    }
                    placeholder="Login"
                    className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
                  />
                  <input
                    name="employee-code"
                    autoComplete="off"
                    aria-label="Código do funcionário"
                    value={employeeForm.employee_code}
                    onChange={(event) =>
                      setEmployeeForm((form) => ({ ...form, employee_code: event.target.value }))
                    }
                    placeholder="Código"
                    className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
                  />
                  <input
                    name="employee-pin"
                    autoComplete="off"
                    aria-label="PIN inicial do funcionário"
                    inputMode="numeric"
                    maxLength={6}
                    value={employeeForm.pin}
                    onChange={(event) =>
                      setEmployeeForm((form) => ({
                        ...form,
                        pin: event.target.value.replace(/\D/g, ""),
                      }))
                    }
                    placeholder="PIN inicial"
                    className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-center font-bold outline-none focus:border-primary"
                  />
                  <select
                    name="employee-farm"
                    aria-label="Fazenda do funcionário"
                    value={employeeForm.farm_id}
                    onChange={(event) =>
                      setEmployeeForm((form) => ({ ...form, farm_id: event.target.value }))
                    }
                    className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"
                  >
                    <option value="">Selecione a fazenda</option>
                    {farms
                      .filter((farm) => farm.status === "active")
                      .map((farm) => (
                        <option key={farm.id} value={farm.id}>
                          {farm.name}
                        </option>
                      ))}
                  </select>
                  <label className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      checked={employeeForm.is_admin}
                      onChange={(event) =>
                        setEmployeeForm((form) => ({ ...form, is_admin: event.target.checked }))
                      }
                    />
                    Gerente desta empresa
                  </label>
                </div>
                <button
                  disabled={
                    loading ||
                    !employeeForm.name.trim() ||
                    !employeeForm.login_name.trim() ||
                    !employeeForm.employee_code.trim() ||
                    !employeeForm.farm_id ||
                    employeeForm.pin.length < 4
                  }
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"
                >
                  <Plus className="h-5 w-5" />
                  Criar funcionário
                </button>
              </form>
            </section>
          </>
        ) : (
          <section className="rounded-2xl border-2 border-border bg-card p-6 text-center">
            <CircleAlert className="mx-auto h-8 w-8 text-warn" />
            <p className="mt-3 font-bold">Nenhuma empresa operacional cadastrada.</p>
          </section>
        )}
      </div>

      {message ? (
        <ActionToast
          toast={{ title: "Alteração concluída", message }}
          onClose={() => setMessage("")}
        />
      ) : null}

      {resetTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !loading && setResetTarget(null)}
        >
          <section
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-lg font-black uppercase">Redefinir PIN</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {resetTarget.name}. O PIN antigo é protegido e não pode ser consultado. Defina abaixo
              o novo PIN que será entregue ao usuário.
            </p>
            <div className="relative mt-4">
              <input
                name="reset-employee-pin"
                autoComplete="off"
                aria-label={`Novo PIN de ${resetTarget.name}`}
                type={showResetPin ? "text" : "password"}
                inputMode="numeric"
                maxLength={6}
                value={resetPin}
                onChange={(event) => setResetPin(event.target.value.replace(/\D/g, ""))}
                className="min-h-14 w-full rounded-xl border-2 border-border bg-surface px-14 text-center text-xl font-bold tracking-[0.18em] outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => setShowResetPin((visible) => !visible)}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-primary"
                aria-label={showResetPin ? "Ocultar novo PIN" : "Mostrar novo PIN"}
              >
                {showResetPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setResetTarget(null)}
                className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading || resetPin.length < 4}
                onClick={() =>
                  void save(
                    "reset_employee_pin",
                    { employee_id: resetTarget.id, pin: resetPin },
                    `Novo PIN salvo para ${resetTarget.name}.`,
                  ).then(() => {
                    setResetTarget(null);
                    setShowResetPin(false);
                  })
                }
                className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"
              >
                Salvar PIN
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {editingFarm ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !loading && setEditingFarm(null)}
        >
          <section
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-lg font-black uppercase">Editar fazenda</h2>
            <label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">
              Nome da fazenda
              <input
                name="edit-farm-name"
                autoComplete="off"
                value={editingFarmName}
                onChange={(event) => setEditingFarmName(event.target.value)}
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-base font-bold outline-none focus:border-primary"
              />
            </label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setEditingFarm(null)}
                className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={loading || editingFarmName.trim().length < 2}
                onClick={() =>
                  void save(
                    "update_farm",
                    { farm_id: editingFarm.id, name: editingFarmName, status: editingFarm.status },
                    "Fazenda atualizada.",
                  ).then(() => setEditingFarm(null))
                }
                className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {editingEmployee ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => !loading && setEditingEmployee(null)}
        >
          <section
            className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="font-display text-lg font-black uppercase">Editar funcionário</h2>
            <div className="mt-4 space-y-2">
              <input
                name="edit-employee-name"
                autoComplete="name"
                aria-label="Nome do funcionário"
                value={editingEmployeeForm.name}
                onChange={(event) =>
                  setEditingEmployeeForm((form) => ({ ...form, name: event.target.value }))
                }
                placeholder="Nome"
                className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary"
              />
              <input
                name="edit-employee-login"
                autoComplete="username"
                aria-label="Login do funcionário"
                value={editingEmployeeForm.login_name}
                onChange={(event) =>
                  setEditingEmployeeForm((form) => ({ ...form, login_name: event.target.value }))
                }
                placeholder="Login"
                className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary"
              />
              <input
                name="edit-employee-code"
                autoComplete="off"
                aria-label="Código do funcionário"
                value={editingEmployeeForm.employee_code}
                onChange={(event) =>
                  setEditingEmployeeForm((form) => ({ ...form, employee_code: event.target.value }))
                }
                placeholder="Código"
                className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary"
              />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setEditingEmployee(null)}
                className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  loading ||
                  !editingEmployeeForm.name.trim() ||
                  !editingEmployeeForm.login_name.trim() ||
                  !editingEmployeeForm.employee_code.trim()
                }
                onClick={() =>
                  void save(
                    "update_employee",
                    {
                      employee_id: editingEmployee.id,
                      ...editingEmployeeForm,
                      status: editingEmployee.status,
                      is_admin: editingEmployee.is_admin,
                    },
                    "Funcionário atualizado.",
                  ).then(() => setEditingEmployee(null))
                }
                className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
