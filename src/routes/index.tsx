import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  ArrowLeft,
  Save,
  Trash2,
  Cog,
  History,
  Hash,
  Calendar,
  CalendarDays,
  Footprints,
  Clock,
  X,
  ChevronRight,
  ChevronLeft,
  AlertTriangle,
  HelpCircle,
  SlidersHorizontal,
  BarChart3,
  Users,
} from "lucide-react";
import {
  FOOT_LABEL,
  LESIONS,
  TREATMENTS,
  COMMENTS,
  addVisit,
  deleteVisit,
  loadFarm,
  loadVisits,
  saveFarm,
  saveVisits,
  seedMockData,
  rechecksByDate,
  severityBucket,
  todayISO,
  uid,
  visitsByTag,
  visitsForDay,
  allAnimals,
  footWorstSeverity,
  footsWorstSeverity,
  isTutorialDone,
  ZONE_SEVERITY_COLOR,
  type DiseaseEntry,
  type FarmConfig,
  type FootEntry,
  type FootKey,
  type LesionCode,
  type Sex,
  type Severity,
  type TreatmentCode,
  type Visit,
} from "@/lib/casco-store";
import { HoofMap } from "@/components/casco/HoofMap";
import { FootDetail } from "@/components/casco/FootDetail";
import { TutorialModal, HelpModal } from "@/components/casco/Tutorial";
import { cn } from "@/lib/utils";

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
    !!f.dateFrom || !!f.dateTo || f.diseases.length > 0 ||
    f.feet.length > 0 || f.minSeverity > 0 ||
    f.treatments.length > 0 || f.status !== "all"
  );
}

type Screen =
  | { name: "today" }
  | { name: "register"; visit: Visit; activeFoot: FootKey | null }
  | { name: "history"; tag: string }
  | { name: "summary" }
  | { name: "config" }
  | { name: "filters" }
  | { name: "calendar" };

function newDraft(tag = "", sex: Sex = "vaca"): Visit {
  return {
    id: uid(),
    date: todayISO(),
    createdAt: Date.now(),
    tag,
    sex,
    feet: (["FE", "FD", "TE", "TD"] as FootKey[]).map((f) => ({
      foot: f,
      ok: true,
      zones: [],
      diseases: [],
      treatments: [],
    })),
  };
}

function Index() {
  const [farm, setFarm] = useState<FarmConfig>(() => loadFarm());
  const [screen, setScreen] = useState<Screen>({ name: "today" });
  const [tick, setTick] = useState(() => {
    if (loadVisits().length === 0) seedMockData(false);
    return 0;
  });
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialDone());
  const [showHelp, setShowHelp] = useState(false);
  const [homeFilters, setHomeFilters] = useState<Filters>(EMPTY_FILTERS);

  const refresh = () => setTick((t) => t + 1);
  const goToday = () => setScreen({ name: "today" });

  function openEdit(tag: string, sex: Sex) {
    setScreen({ name: "register", visit: newDraft(tag, sex), activeFoot: null });
  }

  const isHomeLevel = screen.name === "today" || screen.name === "calendar" || screen.name === "summary";

  const helpScreen =
    screen.name === "register" ? "register" :
    screen.name === "history" ? "history" :
    screen.name === "summary" ? "summary" :
    "today";

  return (
    <div className="min-h-screen pb-24">
      <Header
        farm={farm}
        onConfig={() => setScreen({ name: "config" })}
        showBack={!isHomeLevel}
        onBack={goToday}
        screen={screen.name}
        onHelp={() => setShowHelp(true)}
      />

      <main className="mx-auto max-w-2xl px-4 pt-4" key={tick}>
        {screen.name === "today" && (
          <TodayScreen
            onNew={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
            onEdit={openEdit}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
            onSummary={() => setScreen({ name: "summary" })}
            onFilters={() => setScreen({ name: "filters" })}
            filters={homeFilters}
            onClearFilters={() => setHomeFilters(EMPTY_FILTERS)}
          />
        )}
        {screen.name === "register" && (
          <RegisterScreen
            visit={screen.visit}
            activeFoot={screen.activeFoot}
            onChange={(v, f = null) => setScreen({ name: "register", visit: v, activeFoot: f })}
            onSave={(v) => {
              addVisit(v);
              refresh();
              goToday();
            }}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
          />
        )}
        {screen.name === "history" && (
          <HistoryScreen
            tag={screen.tag}
            onBack={goToday}
            onDelete={(id) => {
              deleteVisit(id);
              refresh();
            }}
          />
        )}
        {screen.name === "summary" && <SummaryScreen />}
        {screen.name === "calendar" && (
          <CalendarScreen onOpenHistory={(tag) => setScreen({ name: "history", tag })} />
        )}
        {screen.name === "filters" && (
          <FiltersScreen
            current={homeFilters}
            onApply={(f) => { setHomeFilters(f); goToday(); }}
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
            onSeed={() => {
              const has = loadVisits().length > 0;
              if (has && !confirm("Já existem dados. Substituir pelos dados de teste?")) return;
              seedMockData(true);
              refresh();
              goToday();
            }}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t-2 border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-stretch">
          <NavTab
            icon={<Users className="h-5 w-5" />}
            label="Animais"
            active={screen.name === "today"}
            onClick={goToday}
          />
          <button
            onClick={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground stamp shadow-lg transition-transform active:scale-95">
              <Plus className="h-7 w-7" strokeWidth={3} />
            </div>
            <span className="text-[10px] font-bold uppercase text-primary">Nova Vaca</span>
          </button>
          <NavTab
            icon={<CalendarDays className="h-5 w-5" />}
            label="Calendário"
            active={screen.name === "calendar"}
            onClick={() => setScreen({ name: "calendar" })}
          />
          <NavTab
            icon={<BarChart3 className="h-5 w-5" />}
            label="Resumo"
            active={screen.name === "summary"}
            onClick={() => setScreen({ name: "summary" })}
          />
        </div>
      </nav>

      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showHelp && <HelpModal screen={helpScreen} onClose={() => setShowHelp(false)} />}
    </div>
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
}: {
  farm: FarmConfig;
  onConfig: () => void;
  showBack: boolean;
  onBack: () => void;
  screen: string;
  onHelp: () => void;
}) {
  const titles: Record<string, string> = {
    today: "",
    calendar: "Calendário",
    register: "Nova Visita",
    history: "Histórico",
    summary: "Resumo",
    config: "Configuração",
    filters: "Filtros",
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
        <div className="flex-1 leading-tight">
          {titles[screen] ? (
            <p className="font-display text-lg uppercase">{titles[screen]}</p>
          ) : (
            <>
              <p className="font-display text-base uppercase">{farm.farmName || "Fazenda"}</p>
              <p className="text-xs text-muted-foreground">
                {farm.worker ? `${farm.worker} · ` : ""}
                {new Date().toLocaleDateString("pt-BR", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            </>
          )}
        </div>
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
  onFilters,
  filters,
  onClearFilters,
}: {
  onNew: () => void;
  onEdit: (tag: string, sex: Sex) => void;
  onOpenHistory: (tag: string) => void;
  onSummary: () => void;
  onFilters: () => void;
  filters: Filters;
  onClearFilters: () => void;
}) {
  const [search, setSearch] = useState("");

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
          f.diseases?.some((d) => d.severity > 0 && filters.diseases.includes(d.code))
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
          (f.treatments ?? []).some((t) => filters.treatments.includes(t))
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
    return list;
  }, [animals, search, filters, latestVisit]);

  const filtersActive = hasActiveFilters(filters);

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-3">
        <BigStat emoji="🐄" label="Animais" value={animals.length} tone="neutral" />
        <BigStat emoji="🦶" label="c/ Problema" value={totalWithProblem} tone="warn" />
        <BigStat emoji="🚨" label="Graves" value={totalSevere} tone="danger" />
      </div>

      {totalRecheck > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-warn bg-warn/10 px-4 py-3">
          <Clock className="h-6 w-6 shrink-0 text-warn-foreground" />
          <p className="font-display text-sm uppercase text-warn-foreground">
            {totalRecheck} pé(s) aguardando revisão
          </p>
        </div>
      )}

      {/* Busca + Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar pelo brinco…"
            inputMode="numeric"
            className="tap w-full rounded-2xl border-2 border-border bg-card pl-12 pr-4 font-display text-xl uppercase outline-none focus:border-primary"
            style={{ height: 56 }}
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
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

      {/* Resumo */}
      <ActionButton emoji="📊" label="Resumo do Dia" onClick={onSummary} />

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} animal(is) · {animals.length} total
      </p>

      {/* Lista */}
      {animals.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">🐄</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum animal cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Toque em Nova Vaca para começar</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-display text-base uppercase">Nenhum resultado</p>
          <button
            onClick={() => { setSearch(""); onClearFilters(); }}
            className="mt-3 rounded-full bg-muted px-4 py-2 text-sm font-display uppercase text-muted-foreground"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const lv = latestVisit.get(a.tag.toLowerCase());
            const badFeet = lv?.feet.filter((f) => !f.ok) ?? [];
            const treatSet = new Set<string>();
            for (const ft of badFeet) {
              for (const c of ft.treatments ?? []) {
                const t = TREATMENTS.find((x) => x.code === c);
                if (t) treatSet.add(`${t.emoji} ${t.label}`);
              }
            }
            const accentColor =
              a.worstSeverity >= 3 ? "bg-danger" :
              a.worstSeverity >= 1 ? "bg-warn" : "bg-good";

            return (
              <li key={a.tag} className="overflow-hidden rounded-2xl shadow-sm border border-border/60">
                {/* Accent bar + main button */}
                <div className="relative">
                  <div className={cn("absolute inset-y-0 left-0 w-1.5 rounded-l-2xl", accentColor)} />
                  <button
                    onClick={() => onEdit(a.tag, a.sex)}
                    className="flex w-full items-center gap-3 bg-card pl-5 pr-3 py-3 text-left active:bg-surface transition-colors"
                  >
                    {/* Tag + sex */}
                    <div className="shrink-0 text-center min-w-[3rem]">
                      <p className="font-display text-2xl font-black leading-none">{a.tag}</p>
                      <p className="text-base leading-none">{a.sex === "vaca" ? "🐄" : "🐂"}</p>
                    </div>

                    {/* Divider */}
                    <div className="h-10 w-px bg-border/50 shrink-0" />

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {a.worstSeverity >= 3 && (
                          <span className="rounded-md bg-danger px-1.5 py-0.5 text-[10px] font-black uppercase text-danger-foreground">🚨 Grave</span>
                        )}
                        {a.worstSeverity > 0 && a.worstSeverity < 3 && (
                          <span className="rounded-md bg-warn/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-warn-foreground">⚠️ G{a.worstSeverity}</span>
                        )}
                        {a.hasResolved && (
                          <span className="rounded-md bg-good/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-good">✅ Curado</span>
                        )}
                        {a.hasRecheck && (
                          <span className="rounded-md bg-warn/10 px-1.5 py-0.5 text-[10px] font-black uppercase text-warn-foreground">⏰ Revisão</span>
                        )}
                      </div>

                      {badFeet.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {badFeet.map((ft) => {
                            const ws = footWorstSeverity(ft);
                            const topD = ft.diseases?.filter((d) => d.severity > 0).sort((x, y) => y.severity - x.severity)[0];
                            const l = LESIONS.find((x) => x.code === topD?.code);
                            return (
                              <span key={ft.foot} className={cn(
                                "rounded px-1 py-0.5 text-[10px] font-black uppercase",
                                ws >= 3 ? "bg-danger/15 text-danger" : "bg-warn/15 text-warn-foreground",
                              )}>
                                {ft.foot}{l ? ` ${l.emoji}${l.code}` : ""} G{ws}
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {treatSet.size > 0 && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {Array.from(treatSet).slice(0, 3).join(" · ")}
                        </p>
                      )}

                      <p className="text-[10px] text-muted-foreground">
                        {a.totalVisits} visita(s) · {new Date(a.lastVisit).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                      </p>
                    </div>

                    {/* Foot dots */}
                    <div className="flex shrink-0 flex-col items-center gap-1">
                      {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
                        const ft = lv?.feet.find((x) => x.foot === k);
                        const ws = ft ? footWorstSeverity(ft) : 0;
                        return (
                          <span key={k} className={cn(
                            "h-3.5 w-3.5 rounded-sm",
                            !ft || ft.ok ? "bg-good/50" : ws >= 3 ? "bg-danger" : ws >= 1 ? "bg-warn" : "bg-danger/50",
                          )} title={k} />
                        );
                      })}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </div>

                {/* Histórico footer */}
                <button
                  onClick={() => onOpenHistory(a.tag)}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border/40 bg-surface/60 py-1.5 text-[10px] font-bold uppercase text-muted-foreground active:bg-surface"
                >
                  <History className="h-3 w-3" />
                  Ver Histórico
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
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl transition-all", active && "bg-primary/10")}>
        {icon}
      </span>
      <span className="text-[10px] font-bold uppercase">{label}</span>
    </button>
  );
}

function BigStat({
  emoji,
  label,
  value,
  tone,
}: {
  emoji: string;
  label: string;
  value: number;
  tone: "neutral" | "warn" | "danger";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl p-4 text-center stamp",
        tone === "neutral" && "bg-card",
        tone === "warn" && value > 0 ? "bg-warn/10 border-2 border-warn/30" : "bg-card",
        tone === "danger" && value > 0 ? "bg-danger/10 border-2 border-danger/30" : "bg-card",
      )}
    >
      <p className="text-2xl leading-none">{emoji}</p>
      <p
        className={cn(
          "mt-1 font-display text-4xl leading-none",
          tone === "warn" && value > 0 && "text-warn-foreground",
          tone === "danger" && value > 0 && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function ActionButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
            {new Date(v.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {hasRecheck && " · ⏰ Revisão"}
            {hasResolved && " · ✅ Curado"}
          </p>
          {bad.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {bad.slice(0, 3).map((f) => {
                const ws = footWorstSeverity(f);
                const topDisease = f.diseases?.filter((d) => d.severity > 0).sort((a, b) => b.severity - a.severity)[0];
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
                  f.ok ? "bg-good/70" : ws >= 3 ? "bg-danger" : ws >= 1 ? "bg-warn" : "bg-danger/50",
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
    setF((p) => ({ ...p, diseases: p.diseases.includes(code) ? p.diseases.filter((c) => c !== code) : [...p.diseases, code] }));
  }
  function toggleFoot(key: FootKey) {
    setF((p) => ({ ...p, feet: p.feet.includes(key) ? p.feet.filter((k) => k !== key) : [...p.feet, key] }));
  }
  function toggleTreatment(code: TreatmentCode) {
    setF((p) => ({ ...p, treatments: p.treatments.includes(code) ? p.treatments.filter((c) => c !== code) : [...p.treatments, code] }));
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Status */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["all", "Todos", ""],
            ["problem", "Com Problema", "⚠️"],
            ["ok", "Sem Problema", "✅"],
            ["recheck", "Revisão", "⏰"],
            ["curado", "Curado", "🟢"],
          ] as [Filters["status"], string, string][]).map(([val, label, emoji]) => (
            <button key={val} type="button" onClick={() => setF((p) => ({ ...p, status: val }))}
              className={cn("tap rounded-xl border-2 px-3 py-2 font-display text-sm uppercase",
                f.status === val ? "border-primary bg-primary text-primary-foreground stamp" : "border-border bg-surface",
              )}>
              {emoji} {label}
            </button>
          ))}
        </div>
      </section>

      {/* Gravidade mínima */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Gravidade mínima</p>
        <div className="grid grid-cols-5 gap-2">
          {([0, 1, 2, 3, 4] as Severity[]).map((s) => (
            <button key={s} type="button" onClick={() => setF((p) => ({ ...p, minSeverity: s }))}
              className={cn("tap rounded-xl border-2 px-2 py-3 font-display text-sm uppercase",
                f.minSeverity === s ? "border-primary bg-primary text-primary-foreground stamp" : "border-border bg-surface",
              )}>
              {s === 0 ? "—" : `G${s}`}
            </button>
          ))}
        </div>
      </section>

      {/* Pé */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Pé afetado</p>
        <div className="grid grid-cols-4 gap-2">
          {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => (
            <button key={k} type="button" onClick={() => toggleFoot(k)}
              className={cn("tap rounded-xl border-2 px-3 py-4 font-display text-base uppercase",
                f.feet.includes(k) ? "border-primary bg-primary text-primary-foreground stamp" : "border-border bg-surface",
              )}>
              {k}
            </button>
          ))}
        </div>
      </section>

      {/* Doenças */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Doença</p>
        <div className="grid grid-cols-3 gap-1.5">
          {LESIONS.map((l) => (
            <button key={l.code} type="button" onClick={() => toggleDisease(l.code)}
              className={cn("tap flex items-center gap-1.5 rounded-xl border-2 px-2 py-2 text-left",
                f.diseases.includes(l.code) ? "border-primary bg-primary text-primary-foreground stamp" : "border-border bg-surface",
              )}>
              <span>{l.emoji}</span>
              <span className="font-display text-xs font-black uppercase">{l.code}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Tratamento */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tratamento</p>
        <div className="flex flex-col gap-1.5">
          {TREATMENTS.map((t) => (
            <button key={t.code} type="button" onClick={() => toggleTreatment(t.code)}
              className={cn("tap flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-left font-display text-sm uppercase",
                f.treatments.includes(t.code) ? "border-primary bg-primary text-primary-foreground stamp" : "border-border bg-surface",
              )}>
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Data */}
      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Data da última visita</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">De</span>
            <input type="date" value={f.dateFrom}
              onChange={(e) => setF((p) => ({ ...p, dateFrom: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase text-muted-foreground">Até</span>
            <input type="date" value={f.dateTo}
              onChange={(e) => setF((p) => ({ ...p, dateTo: e.target.value }))}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-3 py-3 font-display text-sm outline-none focus:border-primary"
            />
          </label>
        </div>
      </section>

      {/* Ações */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => { setF(EMPTY_FILTERS); onApply(EMPTY_FILTERS); }}
          className="tap flex-1 rounded-2xl border-2 border-border bg-surface font-display text-base uppercase py-4">
          Limpar
        </button>
        <button type="button" onClick={() => onApply(f)}
          className="tap-lg flex-[2] rounded-2xl bg-primary font-display text-base uppercase text-primary-foreground stamp py-4">
          Aplicar Filtros
        </button>
      </div>
    </div>
  );
}

/* ───────────── Calendário ───────────── */
function CalendarScreen({ onOpenHistory }: { onOpenHistory: (tag: string) => void }) {
  const today = todayISO();
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);

  const recheckMap = useMemo(() => rechecksByDate(), []);
  const { year, month } = currentMonth;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  function isoDay(d: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  function prevMonth() {
    setCurrentMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 });
  }
  function nextMonth() {
    setCurrentMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 });
  }

  const selectedItems = recheckMap.get(selectedDate) ?? [];
  const allPending = Array.from(recheckMap.entries()).sort(([a], [b]) => a.localeCompare(b));
  const pendingTotal = allPending.reduce((acc, [, items]) => acc + items.length, 0);

  return (
    <div className="space-y-4">
      {/* Resumo pendências */}
      {pendingTotal > 0 && (
        <div className={cn(
          "flex items-center gap-3 rounded-2xl border-2 px-4 py-3",
          allPending.some(([d]) => d < today) ? "border-danger/50 bg-danger/5" : "border-warn/50 bg-warn/5",
        )}>
          <Clock className="h-6 w-6 shrink-0 text-warn-foreground" />
          <div>
            <p className="font-display text-sm font-black uppercase text-warn-foreground">
              {pendingTotal} animal(is) com revisão marcada
            </p>
            {allPending.some(([d]) => d < today) && (
              <p className="text-xs font-bold text-danger">⚠️ Há revisões atrasadas!</p>
            )}
          </div>
        </div>
      )}

      {/* Navegação de mês */}
      <div className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 stamp">
        <button onClick={prevMonth} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <p className="font-display text-base font-black uppercase">{monthName}</p>
        <button onClick={nextMonth} className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Grade do calendário */}
      <div className="rounded-2xl bg-card p-3">
        {/* Cabeçalho dos dias */}
        <div className="mb-2 grid grid-cols-7 gap-1">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => (
            <div key={d} className="py-1 text-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateStr = isoDay(day);
            const isToday = dateStr === today;
            const isSel = dateStr === selectedDate;
            const count = recheckMap.get(dateStr)?.length ?? 0;
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
                  <span className={cn(
                    "mt-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-black",
                    isSel ? "bg-primary-foreground text-primary" :
                    isPast ? "bg-danger text-danger-foreground" : "bg-warn text-warn-foreground",
                  )}>
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
          {new Date(selectedDate + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
          {selectedDate === today && <span className="ml-1 text-primary">(Hoje)</span>}
          {selectedDate < today && selectedItems.length > 0 && <span className="ml-1 text-danger"> — Atrasada!</span>}
        </p>
        {selectedItems.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
            <p className="text-3xl">📅</p>
            <p className="mt-2 font-display text-sm uppercase text-muted-foreground">Nenhuma revisão neste dia</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedItems.map((item, idx) => (
              <li key={idx}>
                <button
                  onClick={() => onOpenHistory(item.tag)}
                  className={cn(
                    "tap-lg flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left",
                    selectedDate < today ? "border-danger/40 bg-danger/5" : "border-warn/40 bg-warn/5",
                  )}
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface font-display">
                    <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
                    <span className="text-xl font-black leading-none">{item.tag}</span>
                    <span className="text-base leading-none">{item.sex === "vaca" ? "🐄" : "🐂"}</span>
                  </div>
                  <div className="flex-1">
                    <p className="font-display text-sm font-black uppercase text-warn-foreground">⏰ Revisão marcada</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">Pé(s): {item.feet.join(" · ")}</p>
                    {selectedDate < today && (
                      <p className="mt-0.5 text-xs font-bold text-danger">⚠️ Atrasada — não realizada</p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Lista completa de pendências */}
      {allPending.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Todas as revisões pendentes
          </p>
          <ul className="space-y-1">
            {allPending.map(([date, items]) => {
              const isPast = date < today;
              const isTdy = date === today;
              return (
                <li key={date}>
                  <button
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      selectedDate === date ? "bg-primary/10" : "bg-surface",
                    )}
                  >
                    <span className={cn(
                      "shrink-0 rounded-lg px-2 py-1 font-display text-xs font-black uppercase",
                      isPast ? "bg-danger text-danger-foreground" :
                      isTdy ? "bg-warn text-warn-foreground" :
                      "bg-primary/10 text-primary",
                    )}>
                      {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                    <span className="flex-1 truncate text-sm font-semibold">
                      {items.map((x) => x.tag).join(", ")}
                    </span>
                    <span className={cn("shrink-0 text-xs font-bold", isPast ? "text-danger" : "text-muted-foreground")}>
                      {isPast ? "⚠️ Atrasada" : `${items.length} animal(is)`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

/* ───────────── (Dead code removed) ───────────── */
function _DEAD_AnimalsScreen({ onOpenHistory }: { onOpenHistory: (tag: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recheck" | "recent" | "severe" | "curado">("all");
  const [diseaseFilter, setDiseaseFilter] = useState<LesionCode | null>(null);

  const animals = useMemo(() => allAnimals(), []);

  // Mapa brinco → doenças ativas mais recentes
  const tagDiseases = useMemo(() => {
    const visits = loadVisits();
    const m = new Map<string, { code: LesionCode; severity: Severity; emoji: string }[]>();
    for (const v of visits) {
      const key = v.tag.toLowerCase();
      if (m.has(key)) continue; // já processou o mais recente (visits está ordenado por createdAt desc)
      const diseases: { code: LesionCode; severity: Severity; emoji: string }[] = [];
      for (const f of v.feet) {
        for (const d of f.diseases ?? []) {
          if (d.severity > 0 && !diseases.find((x) => x.code === d.code)) {
            const l = LESIONS.find((x) => x.code === d.code);
            if (l) diseases.push({ code: d.code, severity: d.severity, emoji: l.emoji });
          }
        }
      }
      m.set(key, diseases.sort((a, b) => b.severity - a.severity));
    }
    return m;
  }, [animals]);

  const filtered = useMemo(() => {
    let list = animals;
    if (search.trim()) {
      list = list.filter((a) => a.tag.toLowerCase().includes(search.toLowerCase()));
    }
    if (filter === "recheck") list = list.filter((a) => a.hasRecheck);
    if (filter === "severe") list = list.filter((a) => a.worstSeverity >= 3);
    if (filter === "curado") list = list.filter((a) => a.hasResolved);
    if (filter === "recent") {
      const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
      list = list.filter((a) => a.lastVisit >= cutoff);
    }
    if (diseaseFilter) {
      list = list.filter((a) =>
        tagDiseases.get(a.tag.toLowerCase())?.some((d) => d.code === diseaseFilter)
      );
    }
    return list;
  }, [animals, search, filter, diseaseFilter, tagDiseases]);

  // Top 5 doenças mais frequentes para chips de filtro rápido
  const topDiseaseCodes = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const diseases of tagDiseases.values()) {
      for (const d of diseases) counts[d.code] = (counts[d.code] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code]) => LESIONS.find((l) => l.code === code)!)
      .filter(Boolean);
  }, [tagDiseases]);

  return (
    <div className="space-y-4">
      {/* Campo de busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar pelo brinco (número)…"
          inputMode="numeric"
          className="tap w-full rounded-2xl border-2 border-border bg-card pl-12 pr-4 font-display text-xl uppercase outline-none focus:border-primary"
          style={{ height: 56 }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip label="Todos" active={filter === "all" && !diseaseFilter} onClick={() => { setFilter("all"); setDiseaseFilter(null); }} />
        <FilterChip label="⏰ Revisão" active={filter === "recheck"} onClick={() => setFilter("recheck")} />
        <FilterChip label="🚨 Graves" active={filter === "severe"} onClick={() => setFilter("severe")} />
        <FilterChip label="✅ Curados" active={filter === "curado"} onClick={() => setFilter("curado")} />
        <FilterChip label="📅 7 dias" active={filter === "recent"} onClick={() => setFilter("recent")} />
      </div>

      {/* Filtros rápidos por doença */}
      {topDiseaseCodes.length > 0 && (
        <div>
          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase text-muted-foreground">
            Filtrar por doença
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {topDiseaseCodes.map((l) => (
              <FilterChip
                key={l.code}
                label={`${l.emoji} ${l.code}`}
                active={diseaseFilter === l.code}
                onClick={() => setDiseaseFilter(diseaseFilter === l.code ? null : l.code as LesionCode)}
              />
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} animal(is) encontrado(s) · {animals.length} total
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum resultado</p>
          <button
            onClick={() => { setSearch(""); setFilter("all"); setDiseaseFilter(null); }}
            className="mt-3 rounded-full bg-muted px-4 py-2 text-sm font-display uppercase text-muted-foreground"
          >
            Limpar filtros
          </button>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => {
            const diseases = tagDiseases.get(a.tag.toLowerCase()) ?? [];
            return (
              <li key={a.tag}>
                <button
                  onClick={() => onOpenHistory(a.tag)}
                  className="tap-lg flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card px-4 text-left active:scale-[0.99] transition-transform"
                  style={{
                    borderColor: a.worstSeverity >= 3 ? "var(--color-danger)" :
                      a.worstSeverity >= 1 ? "var(--color-warn)" : undefined,
                  }}
                >
                  <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface">
                    <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
                    <span className="font-display text-xl font-black leading-none">{a.tag}</span>
                    <span className="text-base leading-none">{a.sex === "vaca" ? "🐄" : "🐂"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.worstSeverity >= 3 && (
                        <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-black uppercase text-danger-foreground">
                          🚨 Grave
                        </span>
                      )}
                      {a.worstSeverity > 0 && a.worstSeverity < 3 && (
                        <span className="rounded bg-warn/30 px-1.5 py-0.5 text-[10px] font-black uppercase text-warn-foreground">
                          ⚠️ G{a.worstSeverity}
                        </span>
                      )}
                      {a.hasResolved && (
                        <span className="rounded bg-good/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-good">
                          ✅ Curado
                        </span>
                      )}
                      {a.hasRecheck && (
                        <span className="rounded bg-warn/20 px-1.5 py-0.5 text-[10px] font-black uppercase text-warn-foreground">
                          ⏰
                        </span>
                      )}
                    </div>
                    {/* Doenças ativas */}
                    {diseases.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {diseases.slice(0, 4).map((d) => (
                          <span key={d.code} className="text-xs text-muted-foreground">
                            {d.emoji}{d.code}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.totalVisits} visita(s) · última{" "}
                      {new Date(a.lastVisit).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                      })}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ───────────── Register ───────────── */
function RegisterScreen({
  visit,
  activeFoot,
  onChange,
  onSave,
  onOpenHistory,
}: {
  visit: Visit;
  activeFoot: FootKey | null;
  onChange: (v: Visit, f?: FootKey | null) => void;
  onSave: (v: Visit) => void;
  onOpenHistory: (tag: string) => void;
}) {
  const status = useMemo(() => {
    const s: Record<FootKey, "ok" | "bad" | null> = { FE: null, FD: null, TE: null, TD: null };
    visit.feet.forEach((f) => (s[f.foot] = f.ok ? "ok" : "bad"));
    return s;
  }, [visit]);

  const previous = visit.tag.trim() ? visitsByTag(visit.tag.trim()) : [];
  const active = visit.feet.find((f) => f.foot === activeFoot);

  function toggleFoot(k: FootKey) {
    const cur = visit.feet.find((f) => f.foot === k)!;
    const next = visit.feet.map((f) =>
      f.foot === k ? (cur.ok ? { ...f, ok: false } : { foot: f.foot, ok: true, zones: [], diseases: [], treatments: [] }) : f,
    );
    onChange({ ...visit, feet: next }, k);
  }

  function updateFoot(e: FootEntry) {
    onChange(
      { ...visit, feet: visit.feet.map((f) => (f.foot === e.foot ? e : f)) },
      e.foot,
    );
  }

  // Pé válido: ok, curado, ou com pelo menos uma doença marcada
  const canSave =
    visit.tag.trim().length > 0 &&
    visit.feet.every(
      (f) =>
        f.ok ||
        f.resolved ||
        (f.diseases?.some((d) => d.severity > 0) ?? false),
    );

  return (
    <div className="space-y-4">
      {/* Brinco */}
      <section className="rounded-2xl bg-card p-4 stamp">
        <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Hash className="h-4 w-4" /> Brinco
        </label>
        <input
          autoFocus
          inputMode="numeric"
          value={visit.tag}
          onChange={(e) => onChange({ ...visit, tag: e.target.value }, activeFoot)}
          placeholder="Ex: 1284"
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-center font-display text-5xl uppercase tracking-wider outline-none focus:border-primary"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["vaca", "touro"] as Sex[]).map((s) => {
            const isActive = visit.sex === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...visit, sex: s }, activeFoot)}
                className={cn(
                  "tap-lg flex flex-col items-center justify-center gap-1 rounded-xl border-2 font-display uppercase transition-all",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground stamp"
                    : "border-border bg-surface",
                )}
              >
                <span className="text-4xl">{s === "vaca" ? "🐄" : "🐂"}</span>
                <span className="text-base">{s}</span>
              </button>
            );
          })}
        </div>
        {previous.length > 0 && (
          <div className="mt-3 rounded-xl border-2 border-warn/60 bg-warn/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 shrink-0 text-warn-foreground" />
              <p className="font-display text-sm uppercase text-warn-foreground">
                Animal já cadastrado! {previous.length} visita(s) anterior(es).
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Você está adicionando uma nova visita para este animal.
            </p>
            <button
              onClick={() => onOpenHistory(visit.tag.trim())}
              className="tap flex w-full items-center justify-between rounded-lg border border-warn/40 bg-card px-3 py-2 text-left"
            >
              <span className="flex items-center gap-2 font-display text-xs uppercase text-warn-foreground">
                <History className="h-4 w-4" />
                Ver histórico do brinco {visit.tag.trim()}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        )}
      </section>

      {/* 4 Pés */}
      <section className="rounded-2xl bg-card p-4 stamp">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Footprints className="h-4 w-4" /> Toque em cada pé
        </p>
        <HoofMap status={status} active={activeFoot} onSelect={toggleFoot} />
        <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-semibold uppercase text-muted-foreground">
          <span className="rounded-lg bg-good/20 py-1">✅ 1º toque = Bom</span>
          <span className="rounded-lg bg-danger/10 py-1">⚠️ 2º toque = Problema</span>
        </div>
      </section>

      {/* Detalhe do pé ativo */}
      {active && !active.ok && (
        <FootDetail entry={active} onChange={updateFoot} onClose={() => onChange(visit, null)} />
      )}

      {/* Salvar */}
      <button
        type="button"
        disabled={!canSave}
        onClick={() => onSave(visit)}
        className={cn(
          "tap-lg flex w-full items-center justify-center gap-3 rounded-2xl font-display text-xl uppercase transition-all",
          canSave
            ? "bg-primary text-primary-foreground stamp active:scale-[0.98]"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Save className="h-7 w-7" />
        Salvar
      </button>
      {!canSave && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Preencha o brinco e marque pelo menos uma doença em cada pé com problema.
        </p>
      )}
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
    currentSev: Severity;    // na visita mais recente
    isCured: boolean;        // na visita mais recente: severity=0 ou foot.resolved
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
    rows.push({ code, emoji: lesion.emoji, full: lesion.full, firstDate, worstSev, currentSev, isCured });
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
            <span className="text-xl leading-none">{r.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-black uppercase">{r.code}</span>
                <span className="truncate text-xs text-muted-foreground">{r.full}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                1ª vez:{" "}
                {new Date(r.firstDate).toLocaleDateString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "2-digit",
                })}
                {r.worstSev > 0 && ` · pior G${r.worstSev}`}
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
                Ativa G{r.currentSev}
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
  onDelete,
}: {
  tag: string;
  onBack: () => void;
  onDelete: (id: string) => void;
}) {
  const items = visitsByTag(tag);
  const hasRecheck = items.some((v) => v.feet.some((f) => f.recheck));
  const hasResolved = items.some((v) => v.feet.some((f) => f.resolved));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 stamp">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Histórico do brinco
        </p>
        <p className="font-display text-5xl font-black">{tag}</p>
        <p className="text-sm text-muted-foreground">{items.length} visita(s) registrada(s)</p>
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
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className="text-xs text-muted-foreground">
                          {bad.length === 0 ? "✅ Todos os pés bons" : `${bad.length} pé(s) tratado(s)`}
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
                    <button
                      onClick={() => {
                        if (confirm("Apagar esta visita?")) onDelete(v.id);
                      }}
                      className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Apagar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Mini mapa 4 pés */}
                  <div className="mt-3 grid grid-cols-4 gap-1">
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
                            "rounded-lg p-1.5 text-center",
                            f.ok
                              ? "bg-good/10"
                              : f.resolved
                                ? "bg-good/20"
                                : ws >= 3
                                  ? "bg-danger/10"
                                  : "bg-warn/10",
                          )}
                        >
                          <p className="font-display text-[10px] font-black uppercase text-muted-foreground">
                            {k}
                          </p>
                          <p className="text-base leading-none">
                            {f.ok ? "✅" : f.resolved ? "🟢" : lesion?.emoji ?? "❓"}
                          </p>
                          {!f.ok && ws > 0 && (
                            <p className="text-[9px] font-black uppercase">{ws}</p>
                          )}
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
                          <li
                            key={f.foot}
                            className="rounded-lg bg-surface px-2 py-1.5 text-xs"
                          >
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded bg-foreground px-1.5 py-0.5 font-display text-[10px] uppercase text-background">
                                {f.foot}
                              </span>
                              {f.resolved && (
                                <span className="rounded bg-good px-1.5 py-0.5 text-[10px] font-black uppercase text-good-foreground">
                                  ✅ Curado
                                </span>
                              )}
                              {f.zones && f.zones.length > 0 && (
                                <span className="text-muted-foreground">Zonas: {f.zones.join(",")} · </span>
                              )}
                              {activeDiseases.map((d) => {
                                const l = LESIONS.find((x) => x.code === d.code);
                                return (
                                  <span key={d.code}>
                                    {l?.emoji} {d.code} <strong>G{d.severity}</strong>
                                  </span>
                                );
                              })}
                              {treats && (
                                <span className="text-muted-foreground">{treats}</span>
                              )}
                            </div>
                            {(f.comments ?? []).length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(f.comments ?? []).map((c) => {
                                  const cm = COMMENTS.find((x) => x.code === c);
                                  return cm ? (
                                    <span key={c} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
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
                          <img
                            key={f.foot}
                            src={f.photo}
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
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Resumo do dia</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Stat label="Animais vistos" value={visits.length} />
          <Stat label="Pés c/ problema" value={badFeet} tone="danger" />
          <Stat label="Precisam revisão" value={recheckTotal} tone="warn" />
          <Stat label="Sem problema" value={visits.filter((v) => v.feet.every((f) => f.ok)).length} />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Por gravidade (hoje)</p>
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

      {topLesions.length > 0 && (
        <section className="rounded-2xl bg-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Lesões mais frequentes (hoje)</p>
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
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Últimos 7 dias</p>
          <p className="mt-1 font-display text-4xl">{week.length}</p>
          <p className="text-xs text-muted-foreground">visitas</p>
        </section>
        <section className="rounded-2xl bg-card p-4 text-center stamp">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Último mês</p>
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
      <p className={cn("font-display text-4xl leading-none", tone === "warn" && "text-warn-foreground", tone === "danger" && "text-danger")}>
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

/* ───────────── Config ───────────── */
function ConfigScreen({
  farm,
  onSave,
  onSeed,
}: {
  farm: FarmConfig;
  onSave: (f: FarmConfig) => void;
  onSeed: () => void;
}) {
  const [name, setName] = useState(farm.farmName);
  const [worker, setWorker] = useState(farm.worker);
  const valid = name.trim().length > 0;

  return (
    <div className="px-2 py-8">
      <div className="mx-auto max-w-md space-y-5">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-4xl text-primary-foreground stamp">
            🐄
          </div>
          <h1 className="font-display text-3xl uppercase">Configuração</h1>
        </div>
        <div className="space-y-4 rounded-2xl bg-card p-5 stamp">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Nome da fazenda
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-4 font-display text-2xl uppercase outline-none focus:border-primary"
              placeholder="Ex: Sítio São João"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Funcionário (opcional)
            </span>
            <input
              value={worker}
              onChange={(e) => setWorker(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-4 text-lg outline-none focus:border-primary"
              placeholder="Ex: João"
            />
          </label>
        </div>
        <button
          disabled={!valid}
          onClick={() => onSave({ farmName: name.trim(), worker: worker.trim(), configured: true })}
          className={cn(
            "tap-lg w-full rounded-2xl font-display text-2xl uppercase",
            valid ? "bg-primary text-primary-foreground stamp" : "bg-muted text-muted-foreground",
          )}
        >
          💾 Salvar
        </button>

        {/* Dados de teste */}
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-5 space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Dados de Teste
          </p>
          <p className="text-sm text-muted-foreground">
            Popula o sistema com 17 animais de exemplo para testar o app.
          </p>
          <button
            type="button"
            onClick={onSeed}
            className="tap w-full rounded-2xl border-2 border-border bg-card font-display text-base uppercase py-4"
          >
            🧪 Carregar Dados de Teste
          </button>
        </div>
      </div>
    </div>
  );
}
