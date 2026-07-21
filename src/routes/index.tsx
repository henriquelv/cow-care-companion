import { useEffect, useRef, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  ArrowLeft,
  Save,
  Trash2,
  Cog,
  History,
  Calendar,
  CalendarDays,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  HelpCircle,
  SlidersHorizontal,
  BarChart3,
  Users,
  Scissors,
  CheckCircle2,
  Camera,
  User,
  Pencil,
  Download,
  Upload,
  Database,
  ShieldCheck,
  RefreshCw,
  LogOut,
  CalendarPlus,
  Bandage,
  WifiOff,
} from "lucide-react";
import {
  FOOT_LABEL,
  LESIONS,
  TREATMENTS,
  COMMENTS,
  QUICK_RECHECK_OPTIONS,
  addVisit,
  createPreventiveVisit,
  dateAfterDays,
  exportBackupJson,
  importBackupJson,
  loadLastBackupAt,
  loadFarm,
  loadVisits,
  saveFarm,
  agendaByDate,
  curativeFollowups,
  curativeMetrics,
  severityBucket,
  todayISO,
  uid,
  visitsByTag,
  visitsForDay,
  allAnimals,
  footWorstSeverity,
  footsWorstSeverity,
  preventiveList,
  type DiseaseEntry,
  type FarmConfig,
  type FootEntry,
  type FootKey,
  type LesionCode,
  type PreventiveAnimal,
  type RegisteredAnimal,
  type Sex,
  type Severity,
  type TreatmentCode,
  type Visit,
  type AgendaItem,
} from "@/lib/casco-store";
import { DiseasePicker } from "@/components/casco/DiseasePicker";
import { HelpModal } from "@/components/casco/Tutorial";
import { cn } from "@/lib/utils";
import {
  activationService,
  type RemoteClient,
  type RemoteEmployee,
  type RemoteFarm,
} from "@/services/activation.service";
import { farmContextService } from "@/services/farm-context.service";
import { isSupabaseConfigured } from "@/services/supabase";
import { syncService } from "@/services/sync.service";
import { getPhotoDisplayUrl, mediaRef, savePhotoBlob } from "@/services/media.service";

export const Route = createFileRoute("/")({
  component: Index,
});

type Filters = {
  dateFrom: string;
  dateTo: string;
  diseases: LesionCode[];
  feet: FootKey[];
  minSeverity: Severity;
  treatments: TreatmentCode[];
  status: "all" | "problem" | "ok" | "recheck" | "curado";
};

const EMPTY_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  diseases: [],
  feet: [],
  minSeverity: 0,
  treatments: [],
  status: "all",
};

function hasActiveFilters(f: Filters): boolean {
  return (
    !!f.dateFrom ||
    !!f.dateTo ||
    f.diseases.length > 0 ||
    f.feet.length > 0 ||
    f.minSeverity > 0 ||
    f.treatments.length > 0 ||
    f.status !== "all"
  );
}

type Screen =
  | { name: "today" }
  | { name: "register"; tag?: string }
  | { name: "history"; tag: string }
  | { name: "summary" }
  | { name: "config" }
  | { name: "filters" }
  | { name: "calendar" }
  | { name: "preventivo" };

function newDraft(tag = ""): Visit {
  return {
    id: uid(),
    date: todayISO(),
    createdAt: Date.now(),
    tag,
    sex: "vaca",
    feet: (["FE", "FD", "TE", "TD"] as FootKey[]).map((f) => ({
      foot: f,
      ok: true,
      zones: [],
      diseases: [],
      treatments: [],
    })),
  };
}

export function Index() {
  const [farm, setFarm] = useState<FarmConfig>(() => loadFarm());
  const [activated, setActivated] = useState(() => farmContextService.isActivated());
  const [syncInfo, setSyncInfo] = useState<"idle" | "syncing" | "ok" | "error" | "offline">("idle");
  const [screen, setScreen] = useState<Screen>({ name: "today" });
  const [tick, setTick] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [homeFilters, setHomeFilters] = useState<Filters>(EMPTY_FILTERS);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = () => setTick((t) => t + 1);
  const goToday = () => setScreen({ name: "today" });

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function openEdit(tag: string) {
    setScreen({ name: "register", tag });
  }

  async function runSync() {
    if (!isSupabaseConfigured) {
      setSyncInfo("ok");
      return;
    }
    if (!farmContextService.isActivated()) return;
    if (!navigator.onLine) {
      setSyncInfo("offline");
      return;
    }
    setSyncInfo("syncing");
    try {
      const result = await syncService.syncAll();
      setSyncInfo(result.ok ? "ok" : "error");
      if (!result.ok && result.message) showToast(result.message);
      refresh();
    } catch (error) {
      setSyncInfo("error");
      showToast(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  }

  useEffect(() => {
    if (activated) {
      farmContextService.ensureTrial();
      void runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activated]);

  if (!activated) {
    return (
      <ActivationScreen
        onActivated={(destination) => {
          const ctx = farmContextService.getContext();
          const nextFarm = {
            ...loadFarm(),
            farmName: ctx?.farm_name ?? "",
            worker: ctx?.employee_name ?? "",
            configured: true,
          };
          saveFarm(nextFarm);
          setFarm(nextFarm);
          setActivated(true);
          setScreen(destination === "calendar" ? { name: "calendar" } : { name: "today" });
          refresh();
        }}
      />
    );
  }

  const isHomeLevel =
    screen.name === "today" ||
    screen.name === "calendar" ||
    screen.name === "summary" ||
    screen.name === "preventivo";

  const helpScreen =
    screen.name === "register"
      ? "register"
      : screen.name === "history"
        ? "history"
        : screen.name === "summary"
          ? "summary"
          : screen.name === "preventivo"
            ? "today"
            : "today";

  return (
    <div className="app-bottom-space min-h-screen overflow-x-hidden">
      <a href="#conteudo-principal" className="skip-link">
        Pular para conteúdo
      </a>
      <Header
        farm={farm}
        onConfig={() => setScreen({ name: "config" })}
        showBack={!isHomeLevel}
        onBack={goToday}
        screen={screen.name}
        onHelp={() => setShowHelp(true)}
        syncInfo={syncInfo}
        onSync={runSync}
        onDeactivate={() => {
          if (!confirm("Trocar a fazenda deste aparelho e voltar para a seleção?")) return;
          farmContextService.clearContext();
          setActivated(false);
        }}
      />

      <AppStatusStrip />

      <main id="conteudo-principal" className="mx-auto max-w-2xl px-4 pt-4" key={tick}>
        {screen.name === "today" && (
          <TodayScreen
            onNew={() => setScreen({ name: "register" })}
            onEdit={(tag) => openEdit(tag)}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
            onSummary={() => setScreen({ name: "summary" })}
            onCalendar={() => setScreen({ name: "calendar" })}
            onFilters={() => setScreen({ name: "filters" })}
            filters={homeFilters}
            onClearFilters={() => setHomeFilters(EMPTY_FILTERS)}
          />
        )}
        {screen.name === "register" && (
          <RegisterScreen
            initialTag={screen.tag ?? ""}
            farm={farm}
            onSave={(v) => {
              addVisit(v);
              void runSync();
              refresh();
              showToast(
                v.preventivo
                  ? "Casqueamento preventivo registrado! ✂️"
                  : "Visita registrada com sucesso! 🐄",
              );
              goToday();
            }}
            onCancel={goToday}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
          />
        )}
        {screen.name === "history" && (
          <HistoryScreen
            tag={screen.tag}
            onBack={goToday}
            onCorrect={(tag) => setScreen({ name: "register", tag })}
          />
        )}
        {screen.name === "summary" && <SummaryScreen />}
        {screen.name === "calendar" && (
          <CalendarScreen onOpenHistory={(tag) => setScreen({ name: "history", tag })} />
        )}
        {screen.name === "filters" && (
          <FiltersScreen
            current={homeFilters}
            onApply={(f) => {
              setHomeFilters(f);
              goToday();
            }}
            onBack={goToday}
          />
        )}
        {screen.name === "config" && (
          <ConfigScreen
            farm={farm}
            onSave={(f) => {
              saveFarm(f);
              setFarm(f);
              goToday();
            }}
            onImport={() => {
              setFarm(loadFarm());
              refresh();
              showToast("Backup importado neste aparelho.");
              goToday();
            }}
          />
        )}
        {screen.name === "preventivo" && (
          <PreventiveScreen
            diasThreshold={farm.dias_para_preventivo}
            onNew={(tag) => setScreen({ name: "register", tag })}
            onQuickPreventive={(animal) => {
              addVisit(
                createPreventiveVisit({
                  tag: animal.tag,
                  sex: animal.sex,
                  lote: animal.lote,
                  visitante_nome: farm.worker || undefined,
                }),
              );
              void runSync();
              refresh();
              showToast(`Preventivo OK registrado: ${animal.tag}`);
            }}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav
        aria-label="Navegação principal"
        className="safe-bottom fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-background/95 backdrop-blur-sm"
      >
        <div className="mx-auto flex max-w-2xl items-stretch">
          <NavTab
            icon={<Users className="h-5 w-5" />}
            label="Animais"
            active={screen.name === "today"}
            onClick={goToday}
            ariaLabel="Tela de animais"
          />
          <NavTab
            icon={<Scissors className="h-5 w-5" />}
            label="Preventivo"
            active={screen.name === "preventivo"}
            onClick={() => setScreen({ name: "preventivo" })}
            ariaLabel="Lista de casqueamento preventivo"
          />
          <button
            aria-label="Nova visita"
            onClick={() => setScreen({ name: "register" })}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground stamp shadow-lg transition-transform active:scale-95">
              <Plus className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
            </div>
            <span className="text-[10px] font-bold uppercase text-primary">Nova</span>
          </button>
          <NavTab
            icon={<CalendarDays className="h-5 w-5" />}
            label="Calendário"
            active={screen.name === "calendar"}
            onClick={() => setScreen({ name: "calendar" })}
            ariaLabel="Calendário de revisões"
          />
          <NavTab
            icon={<BarChart3 className="h-5 w-5" />}
            label="Resumo"
            active={screen.name === "summary"}
            onClick={() => setScreen({ name: "summary" })}
            ariaLabel="Resumo estatístico"
          />
        </div>
      </nav>

      {showHelp && <HelpModal screen={helpScreen} onClose={() => setShowHelp(false)} />}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-foreground/95 px-4 py-3.5 text-background shadow-2xl"
        >
          <CheckCircle2 className="h-5 w-5 shrink-0 text-good" aria-hidden="true" />
          <p className="font-display text-sm uppercase">{toast}</p>
        </div>
      )}
    </div>
  );
}

/* ───────────── Ativação ───────────── */
function ActivationScreen({
  onActivated,
}: {
  onActivated: (destination?: "home" | "calendar") => void;
}) {
  const [code, setCode] = useState("");
  const [client, setClient] = useState<RemoteClient | null>(null);
  const [farms, setFarms] = useState<RemoteFarm[]>([]);
  const [farm, setFarm] = useState<RemoteFarm | null>(null);
  const [employee, setEmployee] = useState<RemoteEmployee | null>(null);
  const [employeeLogin, setEmployeeLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function validateCode() {
    setError("");
    if (!code.trim()) {
      setError("Digite o link ou código da empresa.");
      return;
    }
    setLoading(true);
    try {
      const result = await activationService.validateActivationCode(code);
      setClient(result.client);
      setFarms([]);
      setFarm(null);
      setEmployee(null);
      setEmployeeLogin("");
      setPassword("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setClient(null);
      setFarms([]);
      setFarm(null);
      setEmployee(null);
      setError(message || "Não foi possível validar o código.");
    } finally {
      setLoading(false);
    }
  }

  async function authenticateEmployee() {
    if (!client) return;
    setError("");
    setLoading(true);
    try {
      const result = await activationService.authenticateEmployee(
        client.activation_code,
        employeeLogin,
        password,
      );
      setClient(result.client);
      setEmployee(result.employee);
      setFarms(result.farms);
      setFarm(result.farms.length === 1 ? result.farms[0] : null);
      setPassword("");
    } catch (err) {
      setEmployee(null);
      setFarms([]);
      setFarm(null);
      setError(err instanceof Error ? err.message : "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function activate(destination: "home" | "calendar") {
    if (!client || !farm || !employee) return;
    setError("");
    setLoading(true);
    try {
      await activationService.activate(farm, employee, client);
      onActivated(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível ativar este aparelho.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background px-3 py-5 sm:px-4">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full min-w-0 max-w-2xl flex-col justify-center">
        <section className="w-full min-w-0 overflow-hidden rounded-3xl border-2 border-border bg-card p-4 shadow-sm stamp sm:p-6">
          <div className="mb-6 flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground stamp sm:h-16 sm:w-16">
              <ShieldCheck className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="break-words font-display text-xl font-black uppercase leading-tight sm:text-2xl">
                Acessar empresa
              </p>
              <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
                Identifique-se e escolha onde vai trabalhar.
              </p>
            </div>
          </div>

          <div className="mb-5 grid min-w-0 grid-cols-3 gap-1.5 text-center sm:gap-2">
            {["Link", "Funcionário", "Fazenda"].map((label, index) => {
              const active =
                index === 0
                  ? !client
                  : index === 1
                    ? Boolean(client && !employee)
                    : Boolean(employee);
              const done =
                index === 0 ? Boolean(client) : index === 1 ? Boolean(employee) : Boolean(farm);
              return (
                <div
                  key={label}
                  className={cn(
                    "min-w-0 rounded-xl border px-1 py-2 text-[9px] font-black uppercase sm:px-2 sm:text-[10px]",
                    done
                      ? "border-good/40 bg-good/10 text-good"
                      : active
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-surface text-muted-foreground",
                  )}
                >
                  {index + 1}. {label}
                </div>
              );
            })}
          </div>

          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void validateCode();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Link ou código da empresa
              </span>
              <input
                name="link-fazenda"
                aria-label="Link ou código da empresa"
                value={code}
                onChange={(event) => {
                  setCode(event.target.value);
                  setClient(null);
                  setFarms([]);
                  setFarm(null);
                  setEmployee(null);
                  setEmployeeLogin("");
                  setPassword("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void validateCode();
                }}
                placeholder="Digite seu código"
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint="go"
                spellCheck={false}
                className="min-w-0 w-full rounded-2xl border-2 border-border bg-surface px-3 py-4 text-center font-display text-xl font-black uppercase outline-none focus:border-primary sm:px-4 sm:text-3xl"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="tap-lg flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-display text-lg uppercase text-primary-foreground stamp disabled:cursor-not-allowed"
            >
              {loading && !farm ? <RefreshCw className="h-5 w-5 animate-spin" /> : null}
              Continuar
            </button>
          </form>

          {client && (
            <div className="mt-5 space-y-4 rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">Cliente</p>
                  <p className="font-display text-xl font-black uppercase">{client.name}</p>
                </div>
                <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-black uppercase text-muted-foreground">
                  {client.activation_code}
                </span>
              </div>

              {!employee ? (
                <div className="space-y-3 rounded-2xl border-2 border-border bg-card p-3">
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    Identificação do funcionário
                  </p>
                  <input
                    name="login-funcionario"
                    aria-label="Nome ou código do funcionário"
                    value={employeeLogin}
                    onChange={(event) => setEmployeeLogin(event.target.value)}
                    placeholder="Nome ou código"
                    autoComplete="username"
                    className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 font-display text-lg outline-none focus:border-primary"
                  />
                  <input
                    name="senha-funcionario"
                    aria-label="Senha do funcionário"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void authenticateEmployee();
                    }}
                    placeholder="Senha"
                    autoComplete="current-password"
                    className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 font-display text-lg outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={authenticateEmployee}
                    disabled={!employeeLogin.trim() || !password || loading}
                    className={cn(
                      "tap-lg flex w-full items-center justify-center gap-2 rounded-xl py-4 font-display uppercase",
                      employeeLogin.trim() && password && !loading
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {loading ? (
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                    Entrar como funcionário
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-3">
                    <User className="h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-black uppercase">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Código {employee.employee_code}
                      </p>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-good" />
                  </div>

                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    Escolha a fazenda
                  </p>
                  <div className="grid gap-2">
                    {farms.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setFarm(item)}
                        className={cn(
                          "flex min-h-14 items-center justify-between rounded-xl border-2 px-4 py-3 text-left",
                          farm?.id === item.id
                            ? "border-primary bg-card text-foreground"
                            : "border-border bg-surface text-muted-foreground",
                        )}
                      >
                        <span className="font-display text-base font-black uppercase">
                          {item.name}
                        </span>
                        {farm?.id === item.id ? (
                          <CheckCircle2 className="h-5 w-5 text-good" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => void activate("calendar")}
                      disabled={!farm || loading}
                      className="tap-lg flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-card px-3 font-display text-sm uppercase text-primary"
                    >
                      <CalendarDays className="h-5 w-5" />
                      Visualizar agenda
                    </button>
                    <button
                      type="button"
                      onClick={() => void activate("home")}
                      disabled={!farm || loading}
                      className="tap-lg flex min-h-14 items-center justify-center gap-2 rounded-xl bg-good px-3 font-display text-sm uppercase text-good-foreground stamp"
                    >
                      {loading ? (
                        <RefreshCw className="h-5 w-5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5" />
                      )}
                      Entrar na fazenda
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger"
            >
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* ───────────── Header ───────────── */
function Header({
  farm,
  onConfig,
  showBack,
  onBack,
  screen,
  onHelp,
  syncInfo,
  onSync,
  onDeactivate,
}: {
  farm: FarmConfig;
  onConfig: () => void;
  showBack: boolean;
  onBack: () => void;
  screen: string;
  onHelp: () => void;
  syncInfo: "idle" | "syncing" | "ok" | "error" | "offline";
  onSync: () => void;
  onDeactivate?: () => void;
}) {
  const titles: Record<string, string> = {
    today: "",
    calendar: "Calendário",
    register: "Nova Visita",
    history: "Histórico",
    summary: "Resumo",
    config: "Configuração",
    filters: "Filtros",
    preventivo: "Casqueamento Preventivo",
  };

  return (
    <header className="sticky top-0 z-10 border-b-2 border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="tap flex h-12 w-12 items-center justify-center rounded-full bg-surface"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-6 w-6" />
          </button>
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-xl stamp">
            🐄
          </div>
        )}
        <div className="flex-1 min-w-0 leading-tight">
          {titles[screen] ? (
            <p className="font-display text-lg uppercase">{titles[screen]}</p>
          ) : (
            <button
              onClick={onConfig}
              aria-label="Abrir configuração da fazenda"
              className="text-left w-full"
            >
              <p className="font-display text-base uppercase leading-tight truncate">
                {farm.farmName || "Toque para configurar"}
              </p>
              <p className="text-xs text-muted-foreground leading-tight">
                {farm.worker ? `${farm.worker} · ` : ""}
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            </button>
          )}
        </div>
        <button
          onClick={onSync}
          className={cn(
            "tap flex h-12 w-12 items-center justify-center rounded-full bg-surface",
            syncInfo === "ok" && "text-good-foreground",
            syncInfo === "error" && "text-danger",
            syncInfo === "offline" && "text-warn-foreground",
          )}
          aria-label="Sincronizar dados da fazenda"
          title={
            syncInfo === "syncing"
              ? "Sincronizando"
              : syncInfo === "ok"
                ? "Tudo salvo"
                : syncInfo === "offline"
                  ? "Offline"
                  : "Sincronizar"
          }
        >
          <RefreshCw className={cn("h-5 w-5", syncInfo === "syncing" && "animate-spin")} />
        </button>
        {onDeactivate && (
          <button
            onClick={onDeactivate}
            className="tap flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted-foreground"
            aria-label="Desativar aparelho"
            title="Desativar aparelho"
          >
            <LogOut className="h-5 w-5" />
          </button>
        )}
        <button
          onClick={onHelp}
          className="tap flex h-12 w-12 items-center justify-center rounded-full bg-surface text-primary"
          aria-label="Ajuda"
        >
          <HelpCircle className="h-6 w-6" />
        </button>
        <button
          onClick={onConfig}
          className="tap flex h-12 w-12 items-center justify-center rounded-full bg-surface"
          aria-label="Configuração"
        >
          <Cog className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/* ───────────── Home — Todos os Animais ───────────── */
function TodayScreen({
  onNew,
  onEdit,
  onOpenHistory,
  onSummary,
  onCalendar,
  onFilters,
  filters,
  onClearFilters,
}: {
  onNew: () => void;
  onEdit: (tag: string) => void;
  onOpenHistory: (tag: string) => void;
  onSummary: () => void;
  onCalendar: () => void;
  onFilters: () => void;
  filters: Filters;
  onClearFilters: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"revisao" | "com_problema" | "ok" | "cadastrados">("revisao");

  const visits = useMemo(() => loadVisits().sort((a, b) => b.createdAt - a.createdAt), []);
  const animals = useMemo(() => allAnimals(), []);

  const latestVisit = useMemo(() => {
    const m = new Map<string, Visit>();
    for (const v of visits) {
      const key = v.tag.toLowerCase();
      if (!m.has(key)) m.set(key, v);
    }
    return m;
  }, [visits]);

  const totalWithProblem = animals.filter((a) => a.worstSeverity > 0).length;
  const totalSevere = animals.filter((a) => a.worstSeverity >= 3).length;
  const totalRecheck = animals.filter((a) => a.hasRecheck).length;
  const totalRegisteredOnly = animals.filter((a) => a.totalVisits === 0).length;
  const curatives = useMemo(() => curativeFollowups(), []);
  const curativesUrgent = curatives.filter(
    (item) => item.status === "overdue" || item.status === "today",
  ).length;
  const recheckAnimals = useMemo(() => {
    const today = todayISO();
    return animals
      .filter((a) => a.hasRecheck)
      .map((a) => {
        const lv = latestVisit.get(a.tag.toLowerCase());
        const nextDate = lv?.feet
          .filter((f) => f.recheck && !f.resolved && !f.data_liberacao && f.recheckDate)
          .map((f) => f.recheckDate!)
          .sort()[0];
        return { ...a, nextDate, overdue: Boolean(nextDate && nextDate < today) };
      })
      .sort((a, b) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return (a.nextDate ?? "9999-12-31").localeCompare(b.nextDate ?? "9999-12-31");
      });
  }, [animals, latestVisit]);

  const filtered = useMemo(() => {
    let list = animals;
    if (search.trim()) {
      list = list.filter((a) => a.tag.toLowerCase().includes(search.toLowerCase()));
    }
    if (filters.status === "problem") list = list.filter((a) => a.worstSeverity > 0);
    if (filters.status === "ok") list = list.filter((a) => a.worstSeverity === 0);
    if (filters.status === "recheck") list = list.filter((a) => a.hasRecheck);
    if (filters.status === "curado") list = list.filter((a) => a.hasResolved);
    if (filters.minSeverity > 0) list = list.filter((a) => a.worstSeverity >= filters.minSeverity);
    if (filters.diseases.length > 0) {
      list = list.filter((a) => {
        const lv = latestVisit.get(a.tag.toLowerCase());
        return lv?.feet.some((f) =>
          f.diseases?.some((d) => d.severity > 0 && filters.diseases.includes(d.code)),
        );
      });
    }
    if (filters.feet.length > 0) {
      list = list.filter((a) => {
        const lv = latestVisit.get(a.tag.toLowerCase());
        return lv?.feet.some((f) => !f.ok && filters.feet.includes(f.foot));
      });
    }
    if (filters.treatments.length > 0) {
      list = list.filter((a) => {
        const lv = latestVisit.get(a.tag.toLowerCase());
        return lv?.feet.some((f) =>
          (f.treatments ?? []).some((t) => filters.treatments.includes(t)),
        );
      });
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom + "T00:00:00").getTime();
      list = list.filter((a) => a.lastVisit >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo + "T23:59:59").getTime();
      list = list.filter((a) => a.lastVisit <= to);
    }
    if (tab === "revisao") list = list.filter((a) => a.hasRecheck);
    if (tab === "com_problema") list = list.filter((a) => a.worstSeverity > 0 && !a.hasRecheck);
    if (tab === "ok") list = list.filter((a) => a.worstSeverity === 0 && a.totalVisits > 0);
    if (tab === "cadastrados") list = list.filter((a) => a.totalVisits === 0);
    return list;
  }, [animals, search, filters, latestVisit, tab]);

  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-foreground p-4 text-background shadow-sm">
        <p className="text-xs font-bold uppercase text-background/65">Trabalho de campo</p>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-xl font-black uppercase">Registrar atendimento</p>
            <p className="mt-1 text-xs text-background/70">Brinco, pés, problema e tratamento</p>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"
            aria-label="Iniciar nova visita"
          >
            <Plus className="h-7 w-7" strokeWidth={3} />
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCalendar}
          className="rounded-2xl border-2 border-warn/35 bg-warn/10 p-4 text-left"
        >
          <CalendarDays className="h-5 w-5 text-warn-foreground" />
          <p className="mt-3 font-display text-3xl font-black leading-none">{totalRecheck}</p>
          <p className="mt-1 text-xs font-bold uppercase text-warn-foreground">Revisões abertas</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Abrir agenda</p>
        </button>
        <button
          type="button"
          onClick={onCalendar}
          className={cn(
            "rounded-2xl border-2 p-4 text-left",
            curativesUrgent > 0
              ? "border-danger/35 bg-danger/10"
              : "border-primary/25 bg-primary/10",
          )}
        >
          <Bandage
            className={cn("h-5 w-5", curativesUrgent > 0 ? "text-danger" : "text-primary")}
          />
          <p className="mt-3 font-display text-3xl font-black leading-none">{curatives.length}</p>
          <p className="mt-1 text-xs font-bold uppercase">Curativos abertos</p>
          <p
            className={cn(
              "mt-1 text-[11px]",
              curativesUrgent > 0 ? "text-danger" : "text-muted-foreground",
            )}
          >
            {curativesUrgent > 0 ? `${curativesUrgent} exige(m) atenção` : "Todos dentro do prazo"}
          </p>
        </button>
      </div>

      {totalRecheck > 0 && (
        <div className="sticky top-[73px] z-10 -mx-4 px-4 py-2 bg-background/95 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setTab("revisao")}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left shadow-sm",
              recheckAnimals.some((a) => a.overdue)
                ? "border-danger bg-danger/10"
                : "border-warn bg-warn/10",
            )}
          >
            <Clock className="h-6 w-6 shrink-0 text-warn-foreground" />
            <div className="flex-1">
              <p className="font-display text-sm font-black uppercase text-warn-foreground">
                {totalRecheck} animal(is) aguardando revisão
              </p>
              {recheckAnimals.some((a) => a.overdue) && (
                <p className="text-xs font-bold text-danger">Há revisões atrasadas</p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Busca + Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            name="busca-brinco"
            aria-label="Buscar pelo brinco"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pelo brinco…"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            spellCheck={false}
            className="tap w-full rounded-2xl border-2 border-border bg-card pl-12 pr-4 font-display text-xl uppercase outline-none focus:border-primary"
            style={{ height: 56 }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <button
          onClick={onFilters}
          className={cn(
            "tap flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 transition-all",
            filtersActive
              ? "border-primary bg-primary text-primary-foreground stamp"
              : "border-border bg-card",
          )}
          aria-label="Filtros"
        >
          <SlidersHorizontal className="h-6 w-6" />
        </button>
      </div>

      {filtersActive && (
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-primary">Filtros ativos</span>
          <button
            onClick={onClearFilters}
            className="rounded-full bg-muted px-3 py-1 text-xs font-display uppercase text-muted-foreground"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Resumo do dia */}
      <button
        onClick={onSummary}
        className="tap-lg flex w-full items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 text-left active:scale-[0.99] transition-transform"
        aria-label="Ver resumo do dia"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
          📊
        </span>
        <div>
          <p className="font-display text-base font-black uppercase">Resumo do Dia</p>
          <p className="text-xs text-muted-foreground">Visitas, gravidade e lesões de hoje</p>
        </div>
        <ChevronRight className="ml-auto h-5 w-5 shrink-0 text-muted-foreground" />
      </button>

      <div className="grid grid-cols-3 gap-2">
        <CompactStat label="Problemas" value={totalWithProblem} tone="warn" />
        <CompactStat label="Graves" value={totalSevere} tone="danger" />
        <CompactStat label="Sem visita" value={totalRegisteredOnly} />
      </div>

      {/* Abas operacionais */}
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["revisao", `Revisão (${totalRecheck})`, "⏰"],
            ["com_problema", `Problema (${totalWithProblem})`, "⚠️"],
            ["ok", "OK", "✅"],
            ["cadastrados", `Cadastrados (${totalRegisteredOnly})`, "📋"],
          ] as [typeof tab, string, string][]
        ).map(([val, label, emoji]) => (
          <button
            key={val}
            type="button"
            onClick={() => setTab(val)}
            aria-pressed={tab === val}
            className={cn(
              "tap rounded-xl border-2 px-2 py-3 font-display text-sm uppercase",
              tab === val
                ? "border-primary bg-primary text-primary-foreground stamp"
                : "border-border bg-surface",
            )}
          >
            {emoji} {label}
          </button>
        ))}
      </div>

      {/* Separador: Lista de Animais */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Lista de Animais
        </p>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {filtered.length} de {animals.length} animal(is)
        </p>
        {/* Legenda dos pés */}
        <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
          <div className="grid grid-cols-2 gap-0.5">
            <span className="flex h-4 w-4 items-center justify-center rounded bg-border/60 font-black">
              FE
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded bg-border/60 font-black">
              FD
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded bg-border/60 font-black">
              TE
            </span>
            <span className="flex h-4 w-4 items-center justify-center rounded bg-border/60 font-black">
              TD
            </span>
          </div>
          <span className="leading-tight">
            F=Frente T=Trás
            <br />
            E=Esq. D=Dir.
          </span>
        </div>
      </div>

      {/* Lista */}
      {animals.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">🐄</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum animal cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Toque em Nova para começar</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-display text-base uppercase">Nenhum resultado</p>
          <button
            onClick={() => {
              setSearch("");
              onClearFilters();
            }}
            className="mt-3 rounded-full bg-muted px-4 py-2 text-sm font-display uppercase text-muted-foreground"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((a) => {
            const lv = latestVisit.get(a.tag.toLowerCase());
            const badFeet = lv?.feet.filter((f) => !f.ok && !f.resolved && !f.data_liberacao) ?? [];
            const hasProblema = a.worstSeverity > 0;
            const recheckDates =
              lv?.feet
                .filter((f) => f.recheck && !f.resolved && !f.data_liberacao && f.recheckDate)
                .map((f) => f.recheckDate!)
                .sort() ?? [];
            const nextRecheck = recheckDates[0];
            const recheckOverdue = Boolean(nextRecheck && nextRecheck < todayISO());
            const registeredOnly = a.totalVisits === 0;

            return (
              <li
                key={a.tag}
                className="overflow-hidden rounded-2xl border-2 border-border/60 shadow-sm"
              >
                {/* Faixa de cor no topo */}
                <div
                  className={cn(
                    "h-2 w-full",
                    recheckOverdue
                      ? "bg-danger"
                      : a.hasRecheck
                        ? "bg-warn"
                        : a.worstSeverity >= 3
                          ? "bg-danger"
                          : a.worstSeverity >= 1
                            ? "bg-warn"
                            : "bg-good",
                  )}
                />

                {/* Conteúdo principal */}
                <button
                  onClick={() => onEdit(a.tag)}
                  className="flex w-full items-center gap-4 bg-card px-4 py-4 text-left active:bg-surface transition-colors"
                >
                  {/* Brinco + sexo + lote */}
                  <div className="shrink-0 text-center w-16">
                    <p className="font-display text-4xl font-black leading-none">{a.tag}</p>
                    <p className="text-2xl leading-none mt-1">{a.sex === "vaca" ? "🐄" : "🐂"}</p>
                    {a.lote && (
                      <span className="mt-1 inline-block rounded-md bg-primary/15 px-2 py-0.5 text-[11px] font-black uppercase text-primary">
                        {a.lote}
                      </span>
                    )}
                  </div>

                  {/* Divisor */}
                  <div className="h-16 w-px shrink-0 bg-border/50" />

                  {/* Status */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "font-display text-xl font-black leading-tight",
                        !hasProblema
                          ? "text-good-foreground"
                          : a.worstSeverity >= 3
                            ? "text-danger"
                            : "text-warn-foreground",
                      )}
                    >
                      {registeredOnly
                        ? "📋 Sem visita"
                        : recheckOverdue
                          ? "⏰ Revisão atrasada"
                          : a.hasRecheck
                            ? "⏰ Revisão marcada"
                            : !hasProblema
                              ? "✅ Tudo OK"
                              : a.worstSeverity >= 3
                                ? "🚨 Problema Grave"
                                : "⚠️ Com Problema"}
                    </p>

                    {/* Pés com problema */}
                    {badFeet.length > 0 && (
                      <p className="mt-1 text-sm text-muted-foreground leading-snug">
                        {badFeet
                          .map((ft) => {
                            const topD = ft.diseases
                              ?.filter((d) => d.severity > 0)
                              .sort((x, y) => y.severity - x.severity)[0];
                            const l = LESIONS.find((x) => x.code === topD?.code);
                            return `${FOOT_LABEL[ft.foot]}${l ? ` · ${l.emoji} ${l.name}` : ""}`;
                          })
                          .join("\n")}
                      </p>
                    )}

                    {/* Badges */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.hasRecheck && (
                        <span
                          className={cn(
                            "rounded-md px-2 py-0.5 text-[11px] font-bold uppercase",
                            recheckOverdue
                              ? "bg-danger/15 text-danger"
                              : "bg-warn/20 text-warn-foreground",
                          )}
                        >
                          {recheckOverdue ? "Atrasada" : "Revisão"}{" "}
                          {nextRecheck
                            ? new Date(`${nextRecheck}T12:00:00`).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                              })
                            : ""}
                        </span>
                      )}
                      {a.hasResolved && (
                        <span className="rounded-md bg-good/20 px-2 py-0.5 text-[11px] font-bold uppercase text-good-foreground">
                          ✅ Curado
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {registeredOnly
                        ? "Animal cadastrado, ainda sem visita"
                        : `${a.totalVisits} visita(s) · ${new Date(a.lastVisit).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            },
                          )}`}
                    </p>
                  </div>

                  {/* Indicador 2×2 dos pés */}
                  <div className="shrink-0 grid grid-cols-2 gap-1">
                    {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
                      const ft = lv?.feet.find((x) => x.foot === k);
                      const ws = ft ? footWorstSeverity(ft) : 0;
                      return (
                        <div
                          key={k}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-black text-white",
                            !ft || ft.ok ? "bg-good/80" : ws >= 3 ? "bg-danger" : "bg-warn",
                          )}
                        >
                          {k}
                        </div>
                      );
                    })}
                  </div>
                </button>

                {/* Botão histórico */}
                <button
                  onClick={() => onOpenHistory(a.tag)}
                  className="flex w-full items-center justify-center gap-2 border-t border-border/40 bg-surface/60 py-2.5 text-sm font-bold uppercase text-muted-foreground active:bg-surface"
                >
                  <History className="h-4 w-4" />
                  Ver Histórico · {a.totalVisits} visita(s)
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function NavTab({
  icon,
  label,
  active,
  onClick,
  ariaLabel,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl transition-all",
          active && "bg-primary/10",
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function AppStatusStrip() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const context = farmContextService.getContext();
  const trial = farmContextService.getTrialStatus();

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return (
    <div className="border-b border-border bg-surface/90">
      <div className="mx-auto flex max-w-2xl items-center gap-2 overflow-x-auto px-4 py-2 text-[11px] font-bold">
        <span className="whitespace-nowrap text-foreground">{context?.farm_name ?? "Fazenda"}</span>
        <span aria-hidden="true" className="text-border">
          •
        </span>
        <span
          className={cn(
            "flex items-center gap-1 whitespace-nowrap",
            online ? "text-good-foreground" : "text-warn-foreground",
          )}
        >
          {online ? <CheckCircle2 className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? "Online" : "Offline — salvando no aparelho"}
        </span>
        {trial && (
          <>
            <span aria-hidden="true" className="text-border">
              •
            </span>
            <span className={cn("whitespace-nowrap", trial.expired && "text-danger")}>
              {trial.expired ? "Teste encerrado" : `Teste: ${trial.daysRemaining} dia(s)`}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function LocalDataNotice() {
  const lastBackupAt = loadLastBackupAt();

  return (
    <aside
      role="note"
      className="flex items-start gap-3 rounded-2xl border-2 border-primary/25 bg-primary/10 px-4 py-3 text-primary"
    >
      <Database className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-display text-sm font-black uppercase leading-tight">
          Dados salvos neste aparelho
        </p>
        <p className="mt-0.5 text-xs leading-snug text-foreground/75">
          Use o modo gerente para exportar backup.
          {lastBackupAt && (
            <>
              {" "}
              Último backup automático:{" "}
              {new Intl.DateTimeFormat("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(lastBackupAt))}
              .
            </>
          )}
        </p>
      </div>
    </aside>
  );
}

function CascoPhoto({
  photo,
  alt,
  className,
}: {
  photo?: string;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState(photo ?? "");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    setSrc(photo ?? "");
    void getPhotoDisplayUrl(photo).then((url) => {
      if (cancelled) {
        if (url.startsWith("blob:")) URL.revokeObjectURL(url);
        return;
      }
      objectUrl = url.startsWith("blob:") ? url : "";
      setSrc(url);
    });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo]);

  if (!src) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface text-xs font-bold uppercase text-muted-foreground",
          className,
        )}
      >
        Sem foto
      </div>
    );
  }

  return <img src={src} alt={alt} loading="lazy" decoding="async" className={className} />;
}

function BigStat({
  emoji,
  label,
  value,
  tone,
  onClick,
  active,
}: {
  emoji: string;
  label: string;
  value: number;
  tone: "neutral" | "warn" | "danger";
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border-2 p-4 text-center stamp w-full transition-all active:scale-95",
        active && "ring-2 ring-primary ring-offset-1",
        tone === "warn" && value > 0 ? "border-warn/40 bg-warn/10" : "border-border bg-card",
        tone === "danger" && value > 0
          ? "border-danger/40 bg-danger/10"
          : tone !== "warn"
            ? "border-border bg-card"
            : "",
        tone === "neutral" && "border-border bg-card",
      )}
    >
      <p className="text-2xl leading-none">{emoji}</p>
      <p
        className={cn(
          "mt-1 font-display text-4xl font-black leading-none",
          tone === "warn" && value > 0 && "text-warn-foreground",
          tone === "danger" && value > 0 && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
    </button>
  );
}

function CompactStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-3 text-center">
      <p
        className={cn(
          "font-display text-2xl font-black leading-none",
          tone === "warn" && value > 0 && "text-warn-foreground",
          tone === "danger" && value > 0 && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionButton({
  emoji,
  label,
  onClick,
}: {
  emoji: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="tap-lg flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-border bg-card font-display uppercase stamp active:scale-95 transition-transform"
    >
      <span className="text-3xl">{emoji}</span>
      <span className="text-sm leading-tight text-center">{label}</span>
    </button>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "tap shrink-0 rounded-full border-2 px-4 font-display text-sm uppercase transition-all",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
      )}
    >
      {label}
    </button>
  );
}

function VisitRow({ v, onClick }: { v: Visit; onClick: () => void }) {
  const bad = v.feet.filter((f) => !f.ok);
  const worst = footsWorstSeverity(v.feet);
  const hasRecheck = v.feet.some((f) => f.recheck);
  const hasResolved = v.feet.some((f) => f.resolved);
  const tone =
    bad.length === 0
      ? "border-good/60 bg-good/5"
      : worst >= 3
        ? "border-danger/60 bg-danger/5"
        : "border-warn/60 bg-warn/5";

  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "tap-lg flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-4 text-left active:scale-[0.99] transition-transform",
          tone,
        )}
      >
        <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-surface font-display">
          <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
          <span className="text-2xl font-black leading-none">{v.tag || "—"}</span>
          <span className="text-lg leading-none">{v.sex === "vaca" ? "🐄" : "🐂"}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-base uppercase">
            {bad.length === 0 ? "✅ Tudo bom" : `${bad.length} pé(s) c/ problema`}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(v.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            {hasRecheck && " · ⏰ Revisão"}
            {hasResolved && " · ✅ Curado"}
          </p>
          {bad.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {bad.slice(0, 3).map((f) => {
                const ws = footWorstSeverity(f);
                const topDisease = f.diseases
                  ?.filter((d) => d.severity > 0)
                  .sort((a, b) => b.severity - a.severity)[0];
                const lesion = LESIONS.find((l) => l.code === topDisease?.code);
                return (
                  <span
                    key={f.foot}
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px] font-display uppercase",
                      ws >= 3 ? "bg-danger text-danger-foreground" : "bg-warn text-warn-foreground",
                    )}
                  >
                    {f.foot} {lesion?.name ?? ""}
                  </span>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
            const f = v.feet.find((x) => x.foot === k)!;
            const ws = footWorstSeverity(f);
            return (
              <span
                key={k}
                className={cn(
                  "h-5 w-4 rounded-sm",
                  f.ok
                    ? "bg-good/70"
                    : ws >= 3
                      ? "bg-danger"
                      : ws >= 1
                        ? "bg-warn"
                        : "bg-danger/50",
                )}
              />
            );
          })}
        </div>
      </button>
    </li>
  );
}

/* ───────────── Filtros ───────────── */
function FiltersScreen({
  current,
  onApply,
  onBack,
}: {
  current: Filters;
  onApply: (f: Filters) => void;
  onBack: () => void;
}) {
  const [f, setF] = useState<Filters>(current);

  function toggleDisease(code: LesionCode) {
    setF((p) => ({
      ...p,
      diseases: p.diseases.includes(code)
        ? p.diseases.filter((c) => c !== code)
        : [...p.diseases, code],
    }));
  }
  function toggleFoot(key: FootKey) {
    setF((p) => ({
      ...p,
      feet: p.feet.includes(key) ? p.feet.filter((k) => k !== key) : [...p.feet, key],
    }));
  }
  function toggleTreatment(code: TreatmentCode) {
    setF((p) => ({
      ...p,
      treatments: p.treatments.includes(code)
        ? p.treatments.filter((c) => c !== code)
        : [...p.treatments, code],
    }));
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Status */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Status
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ["all", "Todos", ""],
              ["problem", "Com Problema", "⚠️"],
              ["ok", "Sem Problema", "✅"],
              ["recheck", "Revisão", "⏰"],
              ["curado", "Curado", "🟢"],
            ] as [Filters["status"], string, string][]
          ).map(([val, label, emoji]) => (
            <button
              key={val}
              type="button"
              onClick={() => setF((p) => ({ ...p, status: val }))}
              className={cn(
                "tap rounded-xl border-2 px-3 py-2 font-display text-sm uppercase",
                f.status === val
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              {emoji} {label}
            </button>
          ))}
        </div>
      </section>

      {/* Gravidade mínima */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Gravidade mínima
        </p>
        <div className="grid grid-cols-5 gap-2">
          {([0, 1, 2, 3] as Severity[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setF((p) => ({ ...p, minSeverity: s }))}
              className={cn(
                "tap rounded-xl border-2 px-2 py-3 font-display text-sm uppercase",
                f.minSeverity === s
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              {s === 0 ? "—" : `G${s}`}
            </button>
          ))}
        </div>
      </section>

      {/* Pé */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Pé afetado
        </p>
        <div className="grid grid-cols-4 gap-2">
          {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => toggleFoot(k)}
              className={cn(
                "tap rounded-xl border-2 px-3 py-4 font-display text-base uppercase",
                f.feet.includes(k)
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      </section>

      {/* Doenças */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Doença
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {LESIONS.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => toggleDisease(l.code)}
              className={cn(
                "tap flex items-center gap-2 rounded-xl border-2 px-2 py-2 text-left",
                f.diseases.includes(l.code)
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              <span className="text-lg leading-none shrink-0">{l.emoji}</span>
              <span className="font-display text-xs uppercase leading-tight">{l.name}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Tratamento */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Tratamento
        </p>
        <div className="flex flex-col gap-1.5">
          {TREATMENTS.map((t) => (
            <button
              key={t.code}
              type="button"
              onClick={() => toggleTreatment(t.code)}
              className={cn(
                "tap flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-display text-sm uppercase",
                f.treatments.includes(t.code)
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Data */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Data da última visita
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
            <input
              name="filtro-data-inicio"
              aria-label="Data inicial da última visita"
              type="date"
              value={f.dateFrom}
              onChange={(e) => setF((p) => ({ ...p, dateFrom: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
            <input
              name="filtro-data-fim"
              aria-label="Data final da última visita"
              type="date"
              value={f.dateTo}
              onChange={(e) => setF((p) => ({ ...p, dateTo: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </section>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            setF(EMPTY_FILTERS);
            onApply(EMPTY_FILTERS);
          }}
          className="tap flex-1 rounded-2xl border-2 border-border bg-surface font-display text-base uppercase py-4"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={() => onApply(f)}
          className="tap-lg flex-[2] rounded-2xl bg-primary font-display text-base uppercase text-primary-foreground stamp py-4"
        >
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
}

/* ───────────── Calendário ───────────── */
function downloadAgendaEvent(item: AgendaItem) {
  const farmName = farmContextService.getContext()?.farm_name ?? "Fazenda";
  const nextDate = dateAfterDays(1, item.date);
  const compact = (date: string) => date.replaceAll("-", "");
  const escapeIcs = (value: string) =>
    value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Caderninho de Casco//Agenda Clinica//PT-BR",
    "BEGIN:VEVENT",
    `UID:${item.id}@caderninho-casco`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${compact(item.date)}`,
    `DTEND;VALUE=DATE:${compact(nextDate)}`,
    `SUMMARY:${escapeIcs(`${item.title} — animal ${item.tag}`)}`,
    `DESCRIPTION:${escapeIcs(`${farmName}. ${item.detail}`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `casco-${item.tag}-${item.date}.ics`;
  link.click();
  URL.revokeObjectURL(url);
}

function CalendarScreen({ onOpenHistory }: { onOpenHistory: (tag: string) => void }) {
  const today = todayISO();
  const employeeContext = farmContextService.getContext();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);

  const agendaMap = useMemo(
    () => agendaByDate(today, employeeContext?.employee_id),
    [today, employeeContext?.employee_id],
  );
  const { year, month } = currentMonth;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

  function isoDay(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  }
  function nextMonth() {
    setCurrentMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
  }

  const selectedItems = agendaMap.get(selectedDate) ?? [];
  const allPending = Array.from(agendaMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const pendingTotal = allPending.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <User className="h-5 w-5 text-primary" />
        <div>
          <p className="text-[10px] font-bold uppercase text-muted-foreground">Agenda de</p>
          <p className="font-display text-sm font-black uppercase">
            {employeeContext?.employee_name ?? "Funcionário"}
          </p>
        </div>
      </div>

      {/* Resumo pendências */}
      {pendingTotal > 0 && (
        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl border-2 px-4 py-3",
            allPending.some(([d]) => d < today)
              ? "border-danger/50 bg-danger/5"
              : "border-warn/50 bg-warn/5",
          )}
        >
          <Clock className="h-6 w-6 shrink-0 text-warn-foreground" />
          <div>
            <p className="font-display text-sm font-black uppercase text-warn-foreground">
              {pendingTotal} compromisso(s) na agenda clínica
            </p>
            {allPending.some(([d]) => d < today) && (
              <p className="text-xs font-bold text-danger">Há atividades clínicas atrasadas</p>
            )}
          </div>
        </div>
      )}

      {/* Navegação de mês */}
      <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 stamp">
        <button
          onClick={prevMonth}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-base font-black uppercase">{monthName}</p>
        <button
          onClick={nextMonth}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Grade do calendário */}
      <div className="rounded-2xl bg-card p-3">
        {/* Cabeçalho dos dias */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div
              key={d}
              className="py-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = isoDay(day);
            const isToday = dateStr === today;
            const isSel = dateStr === selectedDate;
            const count = agendaMap.get(dateStr)?.length ?? 0;
            const isPast = dateStr < today && count > 0;
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={cn(
                  "relative flex flex-col items-center justify-center rounded-xl py-2 transition-all",
                  isSel
                    ? "bg-primary text-primary-foreground stamp"
                    : isToday
                      ? "border-2 border-primary/50 bg-primary/10 text-primary"
                      : "bg-surface text-foreground hover:bg-muted",
                )}
              >
                <span className="font-display text-sm font-black leading-none">{day}</span>
                {count > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black",
                      isSel
                        ? "bg-primary-foreground text-primary"
                        : isPast
                          ? "bg-danger text-danger-foreground"
                          : "bg-warn text-warn-foreground",
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Detalhe do dia selecionado */}
      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          })}
          {selectedDate === today && <span className="ml-1 text-primary">(Hoje)</span>}
          {selectedDate < today && selectedItems.length > 0 && (
            <span className="ml-1 text-danger"> — Atrasada!</span>
          )}
        </p>
        {selectedItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border/50 bg-surface/50 p-8 text-center">
            <p className="text-5xl">📅</p>
            <p className="mt-3 font-display text-base font-black uppercase text-muted-foreground">
              Agenda livre neste dia
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Sem revisão ou prazo de curativo</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item) => (
              <li key={item.id}>
                <div
                  className={cn(
                    "tap-lg flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left",
                    item.overdue
                      ? "border-danger/40 bg-danger/5"
                      : item.type === "curative"
                        ? "border-primary/35 bg-primary/5"
                        : "border-warn/40 bg-warn/5",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onOpenHistory(item.tag)}
                    className="flex min-w-0 flex-1 items-center gap-4 text-left"
                  >
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface font-display">
                      <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
                      <span className="text-xl font-black leading-none">{item.tag}</span>
                      <span className="text-base leading-none">
                        {item.sex === "vaca" ? "🐄" : "🐂"}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-display text-sm font-black uppercase text-foreground">
                        {item.type === "curative" ? "Prazo de curativo" : "Revisão clínica"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                      {item.overdue && (
                        <p className="mt-0.5 text-xs font-bold text-danger">
                          Atrasado — precisa de atenção
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadAgendaEvent(item)}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-card text-primary"
                    aria-label={`Adicionar ${item.title} do animal ${item.tag} ao calendário do celular`}
                    title="Adicionar ao calendário do celular"
                  >
                    <CalendarPlus className="h-5 w-5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Zero pendências */}
      {allPending.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-good/40 bg-good/5 p-8 text-center">
          <p className="text-5xl">✅</p>
          <p className="mt-3 font-display text-base font-black uppercase text-good-foreground">
            Agenda em dia
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Nenhuma revisão ou prazo de curativo pendente.
          </p>
        </div>
      )}
    </div>
  );
}

/* ───────────── Register (multi-step) ───────────── */
type RegStep = "worker" | "feet" | "disease" | "treatment" | "notes" | "review";

function RegisterScreen({
  initialTag,
  farm,
  onSave,
  onCancel,
  onOpenHistory,
}: {
  initialTag: string;
  farm: FarmConfig;
  onSave: (v: Visit) => void;
  onCancel: () => void;
  onOpenHistory: (tag: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [visit, setVisit] = useState<Visit>(() => newDraft(initialTag));
  const [step, setStep] = useState<RegStep>("worker");
  const [badFeet, setBadFeet] = useState<FootKey[]>([]);
  const [footIdx, setFootIdx] = useState(0);
  const [showVisitOptions, setShowVisitOptions] = useState(false);
  const [showFootAdvanced, setShowFootAdvanced] = useState(false);

  const currentFoot = badFeet[footIdx] ?? null;
  const currentFootEntry = visit.feet.find((f) => f.foot === currentFoot);
  const previous = visit.tag.trim() ? visitsByTag(visit.tag.trim()) : [];

  function updateVisit(partial: Partial<Visit>) {
    setVisit((v) => ({ ...v, ...partial }));
  }

  function updateCurrentFoot(partial: Partial<FootEntry>) {
    if (!currentFoot) return;
    setVisit((v) => ({
      ...v,
      feet: v.feet.map((f) => (f.foot === currentFoot ? { ...f, ...partial } : f)),
    }));
  }

  function confirmFeet(selected: FootKey[]) {
    setBadFeet(selected);
    const updated = visit.feet.map((f) => ({ ...f, ok: !selected.includes(f.foot) }));
    setVisit((v) => ({ ...v, feet: updated }));
    if (selected.length === 0) {
      setStep("review");
    } else {
      setFootIdx(0);
      setStep("disease");
    }
  }

  function advanceFromNotes() {
    setShowFootAdvanced(false);
    if (footIdx + 1 < badFeet.length) {
      setFootIdx((i) => i + 1);
      setStep("disease");
    } else {
      setStep("review");
    }
  }

  function goBack() {
    if (step === "worker") {
      onCancel();
      return;
    }
    if (step === "feet") {
      setStep("worker");
      return;
    }
    if (step === "disease" && footIdx === 0) {
      setStep("feet");
      return;
    }
    if (step === "disease" && footIdx > 0) {
      setFootIdx((i) => i - 1);
      setStep("notes");
      return;
    }
    if (step === "treatment") {
      setStep("disease");
      return;
    }
    if (step === "notes") {
      setStep("treatment");
      return;
    }
    if (step === "review") {
      if (badFeet.length === 0) {
        setStep("feet");
        return;
      }
      setFootIdx(badFeet.length - 1);
      setStep("notes");
    }
  }

  function pickPhoto(file: File) {
    const r = new FileReader();
    r.onload = () => {
      const mediaId = uid();
      const dataUrl = String(r.result);
      void savePhotoBlob(mediaId, dataUrl, file.type || "image/jpeg");
      updateCurrentFoot({
        photo: mediaRef(mediaId),
        photoPendingUpload: true,
        photoStoragePath: undefined,
      });
    };
    r.readAsDataURL(file);
  }

  const totalSteps = 2 + badFeet.length * 3 + 1;
  const stepIdx =
    step === "worker"
      ? 0
      : step === "feet"
        ? 1
        : step === "review"
          ? Math.max(totalSteps - 1, 2)
          : 2 + footIdx * 3 + (step === "disease" ? 0 : step === "treatment" ? 1 : 2);
  const progress = Math.round((stepIdx / Math.max(totalSteps - 1, 2)) * 100);
  const footStepLabel = currentFoot
    ? FOOT_LABEL[currentFoot] + " · Pé " + (footIdx + 1) + " de " + badFeet.length
    : "";

  return (
    <div className="space-y-4 pb-6">
      {/* Barra de progresso */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBack}
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: progress + "%" }}
            />
          </div>
        </div>
        <button
          onClick={onCancel}
          className="tap flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Cancelar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* ── ETAPA 1: Funcionário + Brinco ── */}
      {step === "worker" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Registro de campo
            </p>
            <h2 className="font-display text-3xl font-black uppercase">Brinco</h2>
          </div>
          <section className="rounded-2xl bg-card p-4 space-y-3 stamp">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Digite só o número
            </p>
            <input
              name="brinco"
              aria-label="Número do brinco"
              inputMode="numeric"
              pattern="[0-9]*"
              value={visit.tag}
              onChange={(e) => updateVisit({ tag: e.target.value })}
              placeholder="Ex: 1284…"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-center font-display text-6xl uppercase tracking-wider outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowVisitOptions((v) => !v)}
              className="tap flex w-full items-center justify-between rounded-xl border-2 border-border bg-surface px-3 py-2 font-display text-sm uppercase text-muted-foreground"
            >
              Mais opções
              <ChevronRight
                className={cn("h-4 w-4 transition-transform", showVisitOptions && "rotate-90")}
              />
            </button>
            {showVisitOptions && (
              <div className="space-y-3 rounded-xl border-2 border-border bg-surface p-3">
                <div className="flex items-center gap-3 rounded-xl bg-card px-3 py-3">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">
                      Funcionário responsável
                    </p>
                    <p className="font-display text-sm font-black uppercase">
                      {farmContextService.getContext()?.employee_name ?? farm.worker}
                    </p>
                  </div>
                </div>
                {farm.lotes.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Lote
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {farm.lotes.map((lt) => (
                        <button
                          key={lt}
                          type="button"
                          onClick={() => updateVisit({ lote: visit.lote === lt ? undefined : lt })}
                          className={cn(
                            "tap rounded-xl border-2 px-4 py-2 font-display text-sm uppercase",
                            visit.lote === lt
                              ? "border-primary bg-primary text-primary-foreground stamp"
                              : "border-border bg-card",
                          )}
                        >
                          {lt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => updateVisit({ preventivo: !visit.preventivo })}
                  className={cn(
                    "tap flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 font-display text-sm uppercase transition-all",
                    visit.preventivo
                      ? "border-good bg-good text-good-foreground stamp"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Scissors className="h-5 w-5 shrink-0" />
                  {visit.preventivo ? "Casqueamento preventivo" : "Marcar preventivo"}
                </button>
              </div>
            )}
            {previous.length > 0 && (
              <div className="rounded-xl border-2 border-warn/60 bg-warn/10 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warn-foreground" />
                  <p className="font-display text-sm uppercase text-warn-foreground">
                    Animal já cadastrado — {previous.length} visita(s)
                  </p>
                </div>
                <button
                  onClick={() => onOpenHistory(visit.tag.trim())}
                  className="tap flex w-full items-center justify-between rounded-lg border border-warn/40 bg-card px-3 py-2 text-left"
                >
                  <span className="flex items-center gap-2 font-display text-xs uppercase text-warn-foreground">
                    <History className="h-4 w-4" /> Ver histórico
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </section>
          <button
            type="button"
            disabled={!visit.tag.trim()}
            onClick={() => setStep("feet")}
            className={cn(
              "tap-lg flex w-full items-center justify-center gap-3 rounded-2xl font-display text-xl uppercase py-5 transition-all",
              visit.tag.trim()
                ? "bg-primary text-primary-foreground stamp"
                : "bg-muted text-muted-foreground",
            )}
          >
            Continuar <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* ── ETAPA 2: Seleção dos pés ── */}
      {step === "feet" && <FeetStep visit={visit} onConfirm={confirmFeet} />}

      {/* ── ETAPA 3: Doença ── */}
      {step === "disease" && currentFoot && currentFootEntry && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {footStepLabel}
            </p>
            <h2 className="font-display text-2xl font-black uppercase">Doença e gravidade</h2>
          </div>
          <section className="rounded-2xl border-2 border-primary/25 bg-primary/10 p-4">
            <p className="font-display text-base font-black uppercase text-primary">
              {FOOT_LABEL[currentFoot]}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Selecione a doença e o grau para continuar o registro.
            </p>
          </section>
          <button
            type="button"
            onClick={() => {
              updateCurrentFoot({
                resolved: true,
                data_liberacao: todayISO(),
                diseases: [],
                ok: false,
              });
              advanceFromNotes();
            }}
            className="tap-lg flex w-full items-center gap-3 rounded-2xl border-2 border-good/60 bg-good/10 px-4 py-3 font-display text-base uppercase text-good-foreground"
          >
            <CheckCircle2 className="h-6 w-6 shrink-0" /> Este pé está CURADO
          </button>
          <DiseasePicker
            diseases={currentFootEntry.diseases ?? []}
            onChange={(d) => updateCurrentFoot({ diseases: d })}
          />
          <button
            type="button"
            onClick={() => setStep("treatment")}
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 font-display text-xl uppercase text-primary-foreground stamp"
          >
            Confirmar <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* ── ETAPA 4: Tratamento ── */}
      {step === "treatment" && currentFoot && currentFootEntry && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {footStepLabel}
            </p>
            <h2 className="font-display text-2xl font-black uppercase">Tratamento</h2>
          </div>
          <div className="flex flex-col gap-2">
            {TREATMENTS.map((t) => {
              const active = (currentFootEntry.treatments ?? []).includes(t.code);
              return (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => {
                    const cur = currentFootEntry.treatments ?? [];
                    if (t.code === "NADA") {
                      updateCurrentFoot({ treatments: active ? [] : ["NADA"] });
                      return;
                    }
                    const without = cur.filter((c) => c !== "NADA" && c !== t.code);
                    updateCurrentFoot({ treatments: active ? without : [...without, t.code] });
                  }}
                  className={cn(
                    "tap flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 font-display text-sm uppercase transition-all",
                    active
                      ? "border-primary bg-primary text-primary-foreground stamp"
                      : "border-border bg-surface",
                  )}
                >
                  <span className="text-2xl leading-none">{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setStep("notes")}
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 font-display text-xl uppercase text-primary-foreground stamp"
          >
            Confirmar <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* ── ETAPA 5: Observações + Foto ── */}
      {step === "notes" && currentFoot && currentFootEntry && (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {footStepLabel}
            </p>
            <h2 className="font-display text-2xl font-black uppercase">Revisão e foto</h2>
          </div>
          <button
            type="button"
            onClick={() =>
              updateCurrentFoot({ recheck: !currentFootEntry.recheck, recheckDate: undefined })
            }
            className={cn(
              "tap flex w-full items-center gap-3 rounded-xl border-2 px-3 py-3 font-display text-sm uppercase transition-all",
              currentFootEntry.recheck
                ? "border-warn bg-warn text-warn-foreground stamp"
                : "border-border bg-surface text-muted-foreground",
            )}
          >
            <Clock className="h-5 w-5 shrink-0" />
            {currentFootEntry.recheck ? "Revisão marcada" : "Marcar revisão futura"}
          </button>
          {currentFootEntry.recheck && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                {QUICK_RECHECK_OPTIONS.map((option) => {
                  const active = currentFootEntry.intervalo_revisao_dias === option.days;
                  return (
                    <button
                      key={option.days}
                      type="button"
                      onClick={() =>
                        updateCurrentFoot({
                          recheck: true,
                          recheckDate: dateAfterDays(option.days),
                          intervalo_revisao_dias: option.days,
                        })
                      }
                      className={cn(
                        "tap min-h-12 rounded-xl border-2 px-3 py-2 font-display text-sm uppercase transition-colors active:scale-95",
                        active
                          ? "border-warn bg-warn text-warn-foreground stamp"
                          : "border-warn/40 bg-warn/5 text-warn-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <input
                name="data-revisao"
                aria-label="Escolher data da revisão"
                type="date"
                min={todayISO()}
                value={currentFootEntry.recheckDate ?? ""}
                onChange={(e) =>
                  updateCurrentFoot({
                    recheckDate: e.target.value || undefined,
                    intervalo_revisao_dias: undefined,
                  })
                }
                className="w-full rounded-xl border-2 border-warn/40 bg-warn/5 px-3 py-3 font-display text-sm outline-none"
              />
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files && e.target.files[0] && pickPhoto(e.target.files[0])}
          />
          {currentFootEntry.photo ? (
            <div className="relative">
              <CascoPhoto
                photo={currentFootEntry.photo}
                alt="Casco"
                className="h-40 w-full rounded-xl object-cover"
              />
              {currentFootEntry.photoPendingUpload && (
                <span className="absolute left-2 top-2 rounded-full bg-warn px-2 py-1 text-[10px] font-black uppercase text-warn-foreground">
                  Foto pendente
                </span>
              )}
              <button
                onClick={() =>
                  updateCurrentFoot({
                    photo: undefined,
                    photoPendingUpload: undefined,
                    photoStoragePath: undefined,
                  })
                }
                className="absolute right-2 top-2 rounded-full bg-background/90 p-2"
                aria-label="Remover foto"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              className="tap flex w-full items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface py-4 font-display text-sm uppercase text-muted-foreground"
            >
              <Camera className="h-5 w-5" /> Foto (opcional)
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowFootAdvanced((v) => !v)}
            className="tap flex w-full items-center justify-between rounded-xl border-2 border-border bg-surface px-3 py-2 font-display text-sm uppercase text-muted-foreground"
          >
            Observações avançadas
            <ChevronRight
              className={cn("h-4 w-4 transition-transform", showFootAdvanced && "rotate-90")}
            />
          </button>
          {showFootAdvanced && (
            <div className="space-y-2 rounded-xl border-2 border-border bg-card p-3">
              <div className="flex flex-col gap-2">
                {COMMENTS.map((c) => {
                  const active = (currentFootEntry.comments ?? []).includes(c.code);
                  return (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => {
                        const cur = currentFootEntry.comments ?? [];
                        updateCurrentFoot({
                          comments: active ? cur.filter((x) => x !== c.code) : [...cur, c.code],
                        });
                      }}
                      className={cn(
                        "tap flex w-full items-center gap-2 rounded-xl border-2 px-3 py-3 text-left font-display transition-all",
                        active
                          ? "border-primary bg-primary text-primary-foreground stamp"
                          : "border-border bg-surface",
                      )}
                    >
                      <span className="shrink-0 font-black">{c.code}</span>
                      <span className="text-sm">{c.label}</span>
                    </button>
                  );
                })}
              </div>
              <textarea
                rows={3}
                value={currentFootEntry.nota ?? ""}
                onChange={(e) => updateCurrentFoot({ nota: e.target.value || undefined })}
                placeholder="Observações adicionais (opcional)…"
                className="w-full rounded-xl border-2 border-border bg-surface px-3 py-3 text-sm outline-none focus:border-primary resize-none"
              />
            </div>
          )}
          <button
            type="button"
            onClick={advanceFromNotes}
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 font-display text-xl uppercase text-primary-foreground stamp"
          >
            {footIdx + 1 < badFeet.length ? "Próximo pé" : "Ver resumo"}{" "}
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* ── ETAPA 6: Resumo + Salvar ── */}
      {step === "review" && (
        <div className="space-y-4">
          <h2 className="font-display text-2xl font-black uppercase">Resumo da Visita</h2>
          <div className="rounded-2xl bg-card p-4 space-y-3 stamp">
            <div className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2">
              <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                  Horario (definido pelo app)
                </p>
                <p className="font-display text-xl font-black">
                  {new Date(visit.createdAt).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" — "}
                  {new Date(visit.createdAt).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "2-digit",
                  })}
                </p>
              </div>
            </div>
            {visit.visitante_nome && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-display font-black uppercase">{visit.visitante_nome}</span>
              </div>
            )}
            <div className="flex items-end gap-3">
              <p className="font-display text-6xl font-black leading-none">{visit.tag}</p>
              {visit.lote && (
                <span className="rounded-lg bg-primary/15 px-3 py-1 font-display text-sm font-black uppercase text-primary">
                  {visit.lote}
                </span>
              )}
              {visit.preventivo && (
                <span className="rounded-lg bg-good/20 px-3 py-1 font-display text-sm font-black uppercase text-good-foreground">
                  Preventivo
                </span>
              )}
            </div>
          </div>
          {visit.feet.filter((f) => !f.ok).length > 0 ? (
            <div className="space-y-2">
              {visit.feet
                .filter((f) => !f.ok)
                .map((f) => {
                  const ws = footWorstSeverity(f);
                  const activeDiseases = (f.diseases ?? []).filter((d) => d.severity > 0);
                  return (
                    <div
                      key={f.foot}
                      className={cn(
                        "rounded-2xl border-2 p-4 space-y-2",
                        f.resolved
                          ? "border-good/40 bg-good/5"
                          : ws >= 3
                            ? "border-danger/40 bg-danger/5"
                            : "border-warn/40 bg-warn/5",
                      )}
                    >
                      <p className="font-display text-base font-black uppercase">
                        {FOOT_LABEL[f.foot]}
                      </p>
                      {f.resolved && (
                        <p className="text-sm font-bold text-good-foreground">
                          Marcado como CURADO
                        </p>
                      )}
                      {activeDiseases.map((d) => {
                        const l = LESIONS.find((x) => x.code === d.code);
                        return (
                          <p key={d.code} className="flex items-center gap-2 text-sm">
                            <span>{l && l.emoji}</span>
                            <span className="font-bold">{l && l.name}</span>
                            <span className="text-muted-foreground">Grau {d.severity}</span>
                          </p>
                        );
                      })}
                      {(f.treatments ?? []).length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Tratamento:{" "}
                          {(f.treatments ?? [])
                            .map((c) => {
                              const t = TREATMENTS.find((t) => t.code === c);
                              return t && t.label;
                            })
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}
                      {f.nota && <p className="text-sm text-muted-foreground italic">{f.nota}</p>}
                      {f.recheck && (
                        <p className="text-sm font-bold text-warn-foreground">
                          Revisão: {f.recheckDate ?? "a definir"}
                        </p>
                      )}
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-good/40 bg-good/5 p-4 text-center">
              <p className="font-display text-lg font-black uppercase text-good-foreground">
                Todos os pés OK
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => onSave(visit)}
            className="tap-lg flex w-full items-center justify-center gap-3 rounded-2xl bg-good py-6 font-display text-2xl font-black uppercase text-good-foreground stamp active:scale-[0.98] transition-transform"
          >
            <Save className="h-7 w-7" /> Salvar Visita
          </button>
        </div>
      )}
    </div>
  );
}

function FeetStep({ visit, onConfirm }: { visit: Visit; onConfirm: (feet: FootKey[]) => void }) {
  const [selected, setSelected] = useState<FootKey[]>(
    visit.feet.filter((f) => !f.ok).map((f) => f.foot) as FootKey[],
  );
  function toggle(k: FootKey) {
    setSelected((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  }
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-black uppercase">Qual(is) pé(s) têm problema?</h2>
        <p className="text-sm text-muted-foreground">Toque para marcar os pés com lesão</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
          const sel = selected.includes(k);
          return (
            <button
              key={k}
              type="button"
              onClick={() => toggle(k)}
              className={cn(
                "tap-lg flex flex-col items-center justify-center gap-2 rounded-2xl border-2 py-8 transition-all",
                sel ? "border-danger bg-danger/10" : "border-border bg-card",
              )}
            >
              <p
                className={cn(
                  "font-display text-4xl font-black",
                  sel ? "text-danger" : "text-foreground",
                )}
              >
                {k}
              </p>
              <p
                className={cn(
                  "text-sm font-bold uppercase",
                  sel ? "text-danger" : "text-muted-foreground",
                )}
              >
                {FOOT_LABEL[k]}
              </p>
              {sel && (
                <span className="rounded-full bg-danger px-3 py-0.5 text-xs font-black uppercase text-white">
                  Com problema
                </span>
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onConfirm(selected)}
        className="tap-lg flex w-full items-center justify-center gap-3 rounded-2xl bg-primary py-5 font-display text-xl uppercase text-primary-foreground stamp"
      >
        {selected.length === 0 ? "Todos os pés OK" : `${selected.length} pé(s) com problema`}
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  );
}

/* ── Linha do tempo de doenças por animal ── */
function DiseaseTimeline({ visits }: { visits: Visit[] }) {
  // visits ordenadas do mais recente para mais antigo
  const sorted = [...visits].sort((a, b) => b.createdAt - a.createdAt);

  // Coletar todos os códigos de doenças que apareceram em qualquer visita
  const allCodes = new Set<LesionCode>();
  for (const v of visits) {
    for (const f of v.feet) {
      for (const d of f.diseases ?? []) {
        if (d.severity > 0) allCodes.add(d.code);
      }
    }
  }
  if (allCodes.size === 0) return null;

  // Para cada doença, calcular: primeira aparição, pior gravidade, gravidade atual
  type DiseaseRow = {
    code: LesionCode;
    emoji: string;
    full: string;
    firstDate: number;
    worstSev: Severity;
    currentSev: Severity; // na visita mais recente
    isCured: boolean; // na visita mais recente: severity=0 ou foot.resolved
  };

  const rows: DiseaseRow[] = [];
  for (const code of allCodes) {
    const lesion = LESIONS.find((l) => l.code === code)!;
    let firstDate = Infinity;
    let worstSev: Severity = 0;
    let currentSev: Severity = 0;
    let curedInLatest = false;

    for (const v of visits) {
      for (const f of v.feet) {
        const d = f.diseases?.find((x) => x.code === code);
        if (d && d.severity > 0) {
          if (v.createdAt < firstDate) firstDate = v.createdAt;
          if (d.severity > worstSev) worstSev = d.severity as Severity;
        }
      }
    }
    // Gravidade na visita mais recente
    const latestVisit = sorted[0];
    if (latestVisit) {
      for (const f of latestVisit.feet) {
        const d = f.diseases?.find((x) => x.code === code);
        if (d && d.severity > 0) currentSev = d.severity as Severity;
        if (f.resolved) curedInLatest = true;
      }
    }
    const isCured = currentSev === 0 || curedInLatest;
    rows.push({
      code,
      emoji: lesion.emoji,
      full: lesion.full,
      firstDate,
      worstSev,
      currentSev,
      isCured,
    });
  }
  rows.sort((a, b) => (a.isCured ? 1 : -1) || b.currentSev - a.currentSev);

  return (
    <div className="rounded-2xl border-2 border-border bg-card p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Evolução das Doenças
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.code} className="flex items-center gap-3">
            <span className="text-2xl leading-none">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <p className="font-display text-sm font-black uppercase leading-tight">{r.full}</p>
              <p className="text-[10px] text-muted-foreground">
                1ª vez:{" "}
                {new Date(r.firstDate).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}
                {r.worstSev > 0 && ` · pior Grau ${r.worstSev}`}
              </p>
            </div>
            {r.isCured ? (
              <span className="shrink-0 rounded-lg bg-good/20 px-2 py-1 text-[11px] font-black text-good">
                ✅ Curada
              </span>
            ) : (
              <span
                className={cn(
                  "shrink-0 rounded-lg px-2 py-1 text-[11px] font-black",
                  r.currentSev >= 3
                    ? "bg-danger/20 text-danger"
                    : r.currentSev >= 1
                      ? "bg-warn/30 text-warn-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                Grau {r.currentSev}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────── History ───────────── */
function HistoryScreen({
  tag,
  onBack,
  onCorrect,
}: {
  tag: string;
  onBack: () => void;
  onCorrect: (tag: string) => void;
}) {
  const items = visitsByTag(tag);
  const hasRecheck = items.some((v) => v.feet.some((f) => f.recheck));
  const hasResolved = items.some((v) => v.feet.some((f) => f.resolved));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 stamp">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Histórico do brinco
        </p>
        <p className="font-display text-5xl font-black">{tag}</p>
        <p className="text-sm text-muted-foreground">{items.length} visita(s) registrada(s)</p>
        <button
          type="button"
          onClick={() => onCorrect(tag)}
          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-4 py-2 font-display text-sm uppercase text-primary"
        >
          <Pencil className="h-4 w-4" />
          Registrar correção
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          {hasRecheck && (
            <span className="rounded-lg bg-warn/10 px-3 py-1.5 text-sm font-semibold text-warn-foreground">
              ⏰ Revisão marcada
            </span>
          )}
          {hasResolved && (
            <span className="rounded-lg bg-good/10 px-3 py-1.5 text-sm font-semibold text-good">
              ✅ Problema resolvido
            </span>
          )}
        </div>
      </div>

      {/* ── Resumo de doenças (timeline de cura) ── */}
      {items.length > 0 && <DiseaseTimeline visits={items} />}

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">📭</p>
          <p className="mt-2 font-display uppercase">Sem histórico</p>
          <button
            onClick={onBack}
            className="mt-3 rounded-full bg-primary px-5 py-2.5 font-display uppercase text-primary-foreground"
          >
            Voltar
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {items.map((v) => {
            const bad = v.feet.filter((f) => !f.ok);
            const worst = footsWorstSeverity(v.feet);
            const hasRecheckV = v.feet.some((f) => f.recheck);
            const hasResolvedV = v.feet.some((f) => f.resolved);
            return (
              <li key={v.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[27px] top-4 h-4 w-4 rounded-full border-2 border-background",
                    bad.length === 0 ? "bg-good" : worst >= 3 ? "bg-danger" : "bg-warn",
                  )}
                />
                <div className="rounded-2xl bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-1 font-display text-sm uppercase">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(v.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                        {" · "}
                        {new Date(v.createdAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      {(v.visitante_nome || v.employee_name) && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-bold text-muted-foreground">
                          <User className="h-3.5 w-3.5" aria-hidden="true" />
                          Funcionário: {v.visitante_nome || v.employee_name}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {bad.length === 0
                            ? "✅ Todos os pés bons"
                            : `${bad.length} pé(s) tratado(s)`}
                        </span>
                        {hasRecheckV && (
                          <span className="rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-bold text-warn-foreground">
                            ⏰ Revisão
                          </span>
                        )}
                        {hasResolvedV && (
                          <span className="rounded bg-good/20 px-1.5 py-0.5 text-[10px] font-bold text-good">
                            ✅ Curado
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase text-muted-foreground">
                      Auditável
                    </span>
                  </div>

                  {/* Mini mapa 4 pés */}
                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
                      const f = v.feet.find((x) => x.foot === k)!;
                      const ws = footWorstSeverity(f);
                      const topDisease = f.diseases
                        ?.filter((d) => d.severity > 0)
                        .sort((a, b) => b.severity - a.severity)[0];
                      const lesion = LESIONS.find((l) => l.code === topDisease?.code);
                      return (
                        <div
                          key={k}
                          className={cn(
                            "flex items-center gap-2 rounded-xl px-3 py-2",
                            f.ok
                              ? "bg-good/10"
                              : f.resolved
                                ? "bg-good/20"
                                : ws >= 3
                                  ? "bg-danger/10"
                                  : "bg-warn/10",
                          )}
                        >
                          <span className="text-xl leading-none">
                            {f.ok ? "✅" : f.resolved ? "🟢" : (lesion?.emoji ?? "❓")}
                          </span>
                          <div className="min-w-0">
                            <p className="font-display text-xs font-black uppercase leading-none">
                              {FOOT_LABEL[k]}
                            </p>
                            {!f.ok && ws > 0 && (
                              <p
                                className={cn(
                                  "text-[10px] font-bold",
                                  ws >= 3 ? "text-danger" : "text-warn-foreground",
                                )}
                              >
                                {lesion?.name ?? ""} Grau {ws}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Detalhes dos pés com problema */}
                  {bad.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {bad.map((f) => {
                        const ws = footWorstSeverity(f);
                        const activeDiseases = f.diseases?.filter((d) => d.severity > 0) ?? [];
                        const treats = (f.treatments ?? [])
                          .map((c) => TREATMENTS.find((t) => t.code === c)?.label)
                          .filter(Boolean)
                          .join(", ");
                        return (
                          <li key={f.foot} className="rounded-lg bg-surface px-2 py-1.5 text-xs">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-foreground px-1.5 py-0.5 font-display text-[10px] uppercase text-background">
                                {FOOT_LABEL[f.foot]}
                              </span>
                              {f.resolved && (
                                <span className="rounded bg-good px-1.5 py-0.5 text-[10px] font-black uppercase text-good-foreground">
                                  ✅ Curado
                                </span>
                              )}
                              {activeDiseases.map((d) => {
                                const l = LESIONS.find((x) => x.code === d.code);
                                return (
                                  <span key={d.code}>
                                    {l?.emoji} {l?.name ?? d.code}{" "}
                                    <strong>Grau {d.severity}</strong>
                                  </span>
                                );
                              })}
                              {treats && <span className="text-muted-foreground">{treats}</span>}
                            </div>
                            {(f.comments ?? []).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(f.comments ?? []).map((c) => {
                                  const cm = COMMENTS.find((x) => x.code === c);
                                  return cm ? (
                                    <span
                                      key={c}
                                      className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary"
                                    >
                                      {c}: {cm.label}
                                    </span>
                                  ) : null;
                                })}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {/* Fotos */}
                  {v.feet.some((f) => f.photo) && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {v.feet
                        .filter((f) => f.photo)
                        .map((f) => (
                          <CascoPhoto
                            key={f.foot}
                            photo={f.photo}
                            alt={`Casco ${f.foot}`}
                            className="h-24 w-24 shrink-0 rounded-lg object-cover"
                          />
                        ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/* ───────────── Summary ───────────── */
function SummaryScreen() {
  const today = todayISO();
  const visits = visitsForDay(today);
  const all = loadVisits();
  const treatmentMetrics = curativeMetrics(today);

  const buckets = { leve: 0, medio: 0, grave: 0 };
  let badFeet = 0;
  let recheckTotal = 0;
  const lesionCount: Record<string, number> = {};

  visits.forEach((v) =>
    v.feet.forEach((f) => {
      if (!f.ok) {
        badFeet++;
        if (f.recheck) recheckTotal++;
        f.diseases?.forEach((d) => {
          if (d.severity > 0) {
            const b = severityBucket(d.severity);
            if (b) buckets[b]++;
            lesionCount[d.code] = (lesionCount[d.code] ?? 0) + 1;
          }
        });
      }
    }),
  );

  const topLesions = Object.entries(lesionCount).sort((a, b) => b[1] - a[1]);
  const week = all.filter((v) => Date.now() - v.createdAt < 7 * 24 * 3600 * 1000);
  const month = all.filter((v) => Date.now() - v.createdAt < 30 * 24 * 3600 * 1000);
  const max = Math.max(buckets.leve, buckets.medio, buckets.grave, 1);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 stamp">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Resumo do dia
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Stat label="Animais vistos" value={visits.length} />
          <Stat label="Pés c/ problema" value={badFeet} tone="danger" />
          <Stat label="Precisam revisão" value={recheckTotal} tone="warn" />
          <Stat
            label="Sem problema"
            value={visits.filter((v) => v.feet.every((f) => f.ok)).length}
          />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Por gravidade (hoje)
        </p>
        <div className="space-y-2">
          {(["leve", "medio", "grave"] as const).map((b) => (
            <div key={b} className="flex items-center gap-3">
              <span className="w-14 font-display text-xs uppercase">
                {b === "medio" ? "Médio" : b === "leve" ? "Leve" : "Grave"}
              </span>
              <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-surface">
                <div
                  className={cn(
                    "h-full rounded-lg transition-all",
                    b === "leve" && "bg-good",
                    b === "medio" && "bg-warn",
                    b === "grave" && "bg-danger",
                  )}
                  style={{ width: `${(buckets[b] / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-display text-xl">{buckets[b]}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border-2 border-primary/20 bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bandage className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-sm font-black uppercase">Acompanhamento de curativos</p>
            <p className="text-xs text-muted-foreground">
              Prazo entre o tratamento e a liberação do pé
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Curativos abertos" value={treatmentMetrics.open} />
          <Stat label="Atrasados" value={treatmentMetrics.overdue} tone="danger" />
          <Stat label="Vencem hoje" value={treatmentMetrics.dueToday} tone="warn" />
          <div className="rounded-xl bg-surface p-3 text-center">
            <p className="font-display text-3xl leading-none">
              {treatmentMetrics.averageDaysToRelease ?? "—"}
            </p>
            <p className="mt-1 text-[10px] uppercase text-muted-foreground">
              Média até liberação (dias)
            </p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface px-3">
          <ClinicalDeadline label="Dermatite digital" days={7} />
          <ClinicalDeadline label="Úlcera de sola e linha branca" days={21} />
          <ClinicalDeadline label="Outros curativos" days={30} />
        </div>
      </section>

      {topLesions.length > 0 && (
        <section className="rounded-2xl bg-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Lesões mais frequentes (hoje)
          </p>
          <ul className="space-y-2">
            {topLesions.map(([code, n]) => {
              const l = LESIONS.find((x) => x.code === code);
              return (
                <li key={code} className="flex items-center gap-3 text-sm">
                  <span className="text-xl">{l?.emoji}</span>
                  <div className="flex-1">
                    <span className="font-display font-black uppercase">{l?.name} </span>
                    <span className="text-muted-foreground text-xs">{l?.full}</span>
                  </div>
                  <span className="font-display text-xl font-black">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 gap-3">
        <section className="rounded-2xl bg-card p-4 text-center stamp">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Últimos 7 dias
          </p>
          <p className="mt-1 font-display text-4xl">{week.length}</p>
          <p className="text-xs text-muted-foreground">visitas</p>
        </section>
        <section className="rounded-2xl bg-card p-4 text-center stamp">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Último mês
          </p>
          <p className="mt-1 font-display text-4xl">{month.length}</p>
          <p className="text-xs text-muted-foreground">visitas</p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  return (
    <div className="rounded-xl bg-surface p-3 text-center">
      <p
        className={cn(
          "font-display text-4xl leading-none",
          tone === "warn" && "text-warn-foreground",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ClinicalDeadline({ label, days }: { label: string; days: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 text-sm">
      <span>{label}</span>
      <strong className="whitespace-nowrap font-display text-primary">{days} dias</strong>
    </div>
  );
}

/* ───────────── Config ───────────── */
function ConfigScreen({
  farm,
  onSave,
  onImport,
}: {
  farm: FarmConfig;
  onSave: (f: FarmConfig) => void;
  onImport: () => void;
}) {
  const importRef = useRef<HTMLInputElement>(null);
  const [managerUnlocked, setManagerUnlocked] = useState(() => !farm.configured);
  const [configTab, setConfigTab] = useState<"dados" | "cadastros" | "avancado">("dados");
  const [cadastrosTab, setCadastrosTab] = useState<"lotes" | "animais">("lotes");

  // Dados tab state
  const [name, setName] = useState(farm.farmName);
  const [worker, setWorker] = useState(farm.worker);
  const [diasPreventivo, setDiasPreventivo] = useState(farm.dias_para_preventivo);

  // Cadastros tab state
  const [lotes, setLotes] = useState<string[]>(farm.lotes);
  const [newLote, setNewLote] = useState("");
  const [animais, setAnimais] = useState<RegisteredAnimal[]>(farm.animais ?? []);
  const [newAnimalTag, setNewAnimalTag] = useState("");
  const [newAnimalLote, setNewAnimalLote] = useState("");

  const valid = name.trim().length > 0;
  const lastBackupAt = loadLastBackupAt();

  function addLote() {
    const lt = newLote.trim().toUpperCase();
    if (!lt || lotes.includes(lt)) return;
    setLotes((prev) => [...prev, lt]);
    setNewLote("");
  }

  function removeLote(lt: string) {
    setLotes((prev) => prev.filter((x) => x !== lt));
  }

  function addAnimal() {
    const tag = newAnimalTag.trim();
    if (!tag || animais.some((a) => a.tag === tag)) return;
    setAnimais((prev) => [...prev, { tag, lote: newAnimalLote.trim().toUpperCase() || undefined }]);
    setNewAnimalTag("");
    setNewAnimalLote("");
  }

  function removeAnimal(tag: string) {
    setAnimais((prev) => prev.filter((a) => a.tag !== tag));
  }

  function currentFarm(): FarmConfig {
    return {
      farmName: name.trim(),
      worker: worker.trim(),
      configured: true,
      lotes,
      dias_para_preventivo: diasPreventivo,
      animais,
    };
  }

  function handleExport() {
    const blob = new Blob([exportBackupJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = todayISO();
    link.href = url;
    link.download = `backup-cascos-${date}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importBackupJson(String(reader.result));
        onImport();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Não foi possível importar o backup.");
      }
    };
    reader.readAsText(file);
  }

  const tabBtnCls = (active: boolean) =>
    cn(
      "flex-1 rounded-xl py-2.5 font-display text-sm uppercase transition-all",
      active ? "bg-primary text-primary-foreground stamp" : "bg-surface text-muted-foreground",
    );

  if (!managerUnlocked) {
    return (
      <div className="space-y-4 pb-8">
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-5 text-center stamp">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="font-display text-2xl uppercase">Modo gerente</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Cadastros e backups ficam separados do uso de campo.
          </p>
          <button
            type="button"
            onClick={() => setManagerUnlocked(true)}
            className="tap-lg mt-4 w-full rounded-2xl bg-primary py-4 font-display text-lg uppercase text-primary-foreground stamp"
          >
            Entrar no modo gerente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground stamp">
          🐄
        </div>
        <h1 className="font-display text-3xl uppercase">Configuração</h1>
      </div>

      {/* Tabs principais */}
      <div className="flex gap-1.5 rounded-2xl bg-card p-1.5 stamp">
        <button onClick={() => setConfigTab("dados")} className={tabBtnCls(configTab === "dados")}>
          Dados
        </button>
        <button
          onClick={() => setConfigTab("cadastros")}
          className={tabBtnCls(configTab === "cadastros")}
        >
          Cadastros
        </button>
        <button
          onClick={() => setConfigTab("avancado")}
          className={tabBtnCls(configTab === "avancado")}
        >
          Avançado
        </button>
      </div>

      {/* ── TAB: DADOS ── */}
      {configTab === "dados" && (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl bg-card p-5 stamp">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nome da fazenda
              </span>
              <input
                name="nome-fazenda"
                autoComplete="organization"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-4 font-display text-2xl uppercase outline-none focus:border-primary"
                placeholder="Ex: Sítio São João…"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Responsável principal (opcional)
              </span>
              <input
                name="responsavel-principal"
                autoComplete="name"
                value={worker}
                onChange={(e) => setWorker(e.target.value)}
                className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-4 text-lg outline-none focus:border-primary"
                placeholder="Ex: João…"
              />
            </label>
          </div>
          <button
            disabled={!valid}
            onClick={() => onSave(currentFarm())}
            className={cn(
              "tap-lg w-full rounded-2xl font-display text-2xl uppercase py-5",
              valid ? "bg-primary text-primary-foreground stamp" : "bg-muted text-muted-foreground",
            )}
          >
            💾 Salvar
          </button>
        </div>
      )}

      {/* ── TAB: CADASTROS ── */}
      {configTab === "cadastros" && (
        <div className="space-y-4">
          {/* Sub-tabs */}
          <div className="flex gap-1.5 rounded-2xl bg-card p-1.5 stamp">
            <button
              onClick={() => setCadastrosTab("lotes")}
              className={tabBtnCls(cadastrosTab === "lotes")}
            >
              Lotes
            </button>
            <button
              onClick={() => setCadastrosTab("animais")}
              className={tabBtnCls(cadastrosTab === "animais")}
            >
              Animais
            </button>
          </div>

          {/* Lotes */}
          {cadastrosTab === "lotes" && (
            <section className="space-y-3 rounded-2xl bg-card p-4 stamp">
              <p className="text-xs font-bold uppercase text-muted-foreground">Lotes da fazenda</p>
              {lotes.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum lote cadastrado.</p>
              )}
              <div className="flex flex-wrap gap-2">
                {lotes.map((lt) => (
                  <span
                    key={lt}
                    className="flex items-center gap-1.5 rounded-xl border-2 border-primary/40 bg-primary/10 px-3 py-1.5"
                  >
                    <span className="font-display text-sm font-black uppercase text-primary">
                      {lt}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLote(lt)}
                      className="text-muted-foreground"
                      aria-label={"Remover lote " + lt}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  name="novo-lote"
                  aria-label="Nome do lote"
                  value={newLote}
                  onChange={(event) => setNewLote(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addLote()}
                  placeholder="Ex.: A1"
                  autoComplete="off"
                  className="min-w-0 flex-1 rounded-xl border-2 border-border bg-surface px-3 py-3 uppercase outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={addLote}
                  className="tap flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                  aria-label="Adicionar lote"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
              <button
                onClick={() => onSave(currentFarm())}
                className="tap-lg w-full rounded-xl bg-primary py-4 font-display uppercase text-primary-foreground"
              >
                Salvar lotes
              </button>
            </section>
          )}

          {/* Animais */}
          {cadastrosTab === "animais" && (
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {animais.length} animal(is) cadastrado(s)
                </p>
              </div>
              {animais.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
                  <p className="text-3xl">🐄</p>
                  <p className="mt-2 font-display text-base uppercase text-muted-foreground">
                    Nenhum animal cadastrado
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Adicione animais para que apareçam na lista preventiva mesmo sem visitas
                  </p>
                </div>
              )}
              <ul className="space-y-2">
                {animais.map((a) => (
                  <li
                    key={a.tag}
                    className="flex items-center gap-3 rounded-2xl border-2 border-border bg-card px-4 py-3 stamp"
                  >
                    <p className="w-12 shrink-0 font-display text-2xl font-black leading-none">
                      {a.tag}
                    </p>
                    <span className="text-lg leading-none">🐄</span>
                    {a.lote && (
                      <span className="rounded-lg bg-primary/15 px-2 py-0.5 font-display text-xs font-black uppercase text-primary">
                        {a.lote}
                      </span>
                    )}
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => removeAnimal(a.tag)}
                      className="tap flex h-9 w-9 items-center justify-center rounded-xl bg-danger/10 text-danger"
                      aria-label="Remover animal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rounded-2xl bg-card p-4 stamp space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Adicionar animal
                </p>
                <div className="flex gap-2">
                  <input
                    name="novo-animal-brinco"
                    aria-label="Brinco do animal"
                    value={newAnimalTag}
                    onChange={(e) => setNewAnimalTag(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addAnimal()}
                    inputMode="numeric"
                    placeholder="Brinco…"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-28 rounded-xl border-2 border-border bg-surface px-3 py-3 text-center font-display text-xl outline-none focus:border-primary"
                  />
                  {lotes.length > 0 && (
                    <select
                      name="novo-animal-lote"
                      aria-label="Lote do animal"
                      value={newAnimalLote}
                      onChange={(e) => setNewAnimalLote(e.target.value)}
                      className="flex-1 rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm outline-none focus:border-primary"
                    >
                      <option value="">Lote (opcional)</option>
                      {lotes.map((lt) => (
                        <option key={lt} value={lt}>
                          {lt}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={addAnimal}
                    className="tap rounded-xl border-2 border-primary bg-primary px-4 py-3 text-primary-foreground"
                    aria-label="Adicionar animal"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <button
                onClick={() => onSave(currentFarm())}
                className="tap-lg w-full rounded-2xl bg-primary py-4 font-display text-lg uppercase text-primary-foreground stamp"
              >
                💾 Salvar
              </button>
            </section>
          )}
        </div>
      )}

      {/* ── TAB: AVANÇADO ── */}
      {configTab === "avancado" && (
        <div className="space-y-4">
          <section className="rounded-2xl bg-card p-5 stamp space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Casqueamento Preventivo
            </p>
            <p className="text-sm text-muted-foreground">
              Listar animais para preventivo após quantos dias?
            </p>
            <div className="flex items-center gap-4">
              <input
                name="dias-preventivo"
                aria-label="Dias para casqueamento preventivo"
                type="number"
                min={30}
                max={730}
                value={diasPreventivo}
                onChange={(e) => setDiasPreventivo(Number(e.target.value) || 180)}
                className="w-28 rounded-xl border-2 border-border bg-surface px-3 py-3 text-center font-display text-2xl outline-none focus:border-primary"
              />
              <span className="text-sm text-muted-foreground">dias</span>
            </div>
          </section>
          <button
            disabled={!valid}
            onClick={() => onSave(currentFarm())}
            className={cn(
              "tap-lg w-full rounded-2xl font-display text-2xl uppercase py-5",
              valid ? "bg-primary text-primary-foreground stamp" : "bg-muted text-muted-foreground",
            )}
          >
            💾 Salvar
          </button>
          <section className="rounded-2xl bg-card p-5 stamp space-y-3">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Backup do aparelho
                </p>
                <p className="text-sm text-muted-foreground">
                  Os dados ficam salvos neste dispositivo.
                  {lastBackupAt && (
                    <>
                      {" "}
                      Último backup automático:{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(lastBackupAt))}
                      .
                    </>
                  )}
                </p>
              </div>
            </div>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImport(file);
                e.currentTarget.value = "";
              }}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-primary bg-primary/10 px-3 py-3 font-display text-sm uppercase text-primary"
              >
                <Download className="h-4 w-4" />
                Exportar
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="tap flex items-center justify-center gap-2 rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm uppercase"
              >
                <Upload className="h-4 w-4" />
                Importar
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ───────────── Preventivo ───────────── */
const DIAS_FILTROS = [
  { label: "Todos", dias: null },
  { label: "7+ dias", dias: 7 },
  { label: "30+ dias", dias: 30 },
  { label: "60+ dias", dias: 60 },
  { label: "90+ dias", dias: 90 },
  { label: "120+ dias", dias: 120 },
] as const;

function PreventiveScreen({
  diasThreshold,
  onNew,
  onQuickPreventive,
}: {
  diasThreshold: number;
  onNew: (tag: string) => void;
  onQuickPreventive: (animal: PreventiveAnimal) => void;
}) {
  const [filtroMin, setFiltroMin] = useState<number | null>(null);
  const [registrando, setRegistrando] = useState<string | null>(null);

  function handleQuickPreventive(animal: PreventiveAnimal) {
    if (registrando) return;
    setRegistrando(animal.tag);
    setTimeout(() => {
      onQuickPreventive(animal);
      setRegistrando(null);
    }, 120);
  }

  // Passa threshold=0 para buscar todos os animais saudáveis.
  const todos = useMemo(() => preventiveList(0), []);

  const filtered = useMemo(() => {
    if (filtroMin === null) return todos;
    return todos.filter((a) => a.diasSemCasqueamento < 0 || a.diasSemCasqueamento >= filtroMin);
  }, [todos, filtroMin]);

  const nunca = filtered.filter((a) => a.diasSemCasqueamento < 0).length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="rounded-2xl bg-card p-4 stamp">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
            ✂️
          </div>
          <div>
            <p className="font-display text-lg font-black uppercase">Casqueamento Preventivo</p>
            <p className="text-sm text-muted-foreground">
              {todos.length} animal(is) sem problema ativo
            </p>
          </div>
        </div>
        {nunca > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-warn/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-warn-foreground" />
            <p className="text-sm font-bold text-warn-foreground">
              {nunca} animal(is) nunca receberam casqueamento preventivo
            </p>
          </div>
        )}
      </div>

      {/* Filtro por dias */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Mostrar animais sem casquear há:
        </p>
        <div className="flex flex-wrap gap-2">
          {DIAS_FILTROS.map(({ label, dias }) => (
            <button
              key={label}
              type="button"
              onClick={() => setFiltroMin(dias)}
              className={cn(
                "tap rounded-xl border-2 px-4 py-2 font-display text-sm uppercase",
                filtroMin === dias
                  ? "border-primary bg-primary text-primary-foreground stamp"
                  : "border-border bg-surface",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} animal(is) · ordenado do mais urgente
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">✅</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum animal neste filtro</p>
          <button
            type="button"
            onClick={() => setFiltroMin(null)}
            className="mt-3 rounded-full bg-muted px-4 py-2 font-display text-sm uppercase text-muted-foreground"
          >
            Ver todos
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const nunca = a.diasSemCasqueamento < 0;
            const vencido = !nunca && diasThreshold > 0 && a.diasSemCasqueamento >= diasThreshold;
            const isSaving = registrando === a.tag;

            return (
              <li key={a.tag}>
                <div
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-2xl border-2 bg-card p-4 sm:flex-row sm:items-center",
                    nunca
                      ? "border-danger/50 bg-danger/5"
                      : vencido
                        ? "border-warn/50 bg-warn/5"
                        : "border-border",
                    registrando !== null && !isSaving && "opacity-60",
                  )}
                >
                  {/* Brinco */}
                  <div className="w-16 shrink-0 text-center">
                    <p className="font-display text-4xl font-black leading-none">{a.tag}</p>
                    <p className="mt-0.5 text-xl leading-none">{a.sex === "vaca" ? "🐄" : "🐂"}</p>
                    {a.lote && (
                      <span className="mt-0.5 inline-block rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-black uppercase text-primary">
                        {a.lote}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {nunca ? (
                      <p className="font-display text-lg font-black uppercase text-danger">
                        ⚠️ Nunca casqueado
                      </p>
                    ) : (
                      <p
                        className={cn(
                          "font-display text-lg font-black uppercase",
                          vencido ? "text-warn-foreground" : "text-foreground",
                        )}
                      >
                        {a.diasSemCasqueamento} dias sem casquear
                      </p>
                    )}
                    {a.lastPreventivoDate && (
                      <p className="text-sm text-muted-foreground">
                        Último preventivo:{" "}
                        {new Date(a.lastPreventivoDate + "T12:00:00").toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </p>
                    )}
                    {a.hasProblemaHistorico && (
                      <span className="mt-1 inline-block rounded bg-warn/10 px-2 py-0.5 text-[11px] font-bold uppercase text-warn-foreground">
                        ⚠️ Teve problema antes
                      </span>
                    )}
                  </div>

                  <div className="grid shrink-0 grid-cols-2 gap-2 sm:w-40 sm:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => handleQuickPreventive(a)}
                      disabled={registrando !== null}
                      aria-label={`Registrar preventivo OK para brinco ${a.tag}`}
                      className={cn(
                        "tap min-h-14 rounded-xl border-2 px-3 py-2 font-display text-sm font-black uppercase transition-transform active:scale-[0.98]",
                        isSaving
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary bg-primary text-primary-foreground",
                      )}
                    >
                      {isSaving ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-5 w-5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                          Salvando
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                          OK
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onNew(a.tag)}
                      disabled={registrando !== null}
                      aria-label={`Abrir registro detalhado para brinco ${a.tag}`}
                      className="tap min-h-14 rounded-xl border-2 border-border bg-surface px-3 py-2 font-display text-sm font-black uppercase text-foreground transition-transform active:scale-[0.98]"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <Scissors className="h-5 w-5 text-primary" aria-hidden="true" />
                        Detalhar
                      </span>
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
