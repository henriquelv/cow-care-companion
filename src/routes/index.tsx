import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  BarChart3,
  ArrowLeft,
  Save,
  Trash2,
  Cog,
  History,
  Hash,
  Calendar,
  Footprints,
  Users,
  Clock,
  X,
  ChevronRight,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import {
  FOOT_LABEL,
  LESIONS,
  TREATMENTS,
  addVisit,
  deleteVisit,
  loadFarm,
  loadVisits,
  saveFarm,
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
  type Sex,
  type Severity,
  type Visit,
} from "@/lib/casco-store";
import { HoofMap } from "@/components/casco/HoofMap";
import { FootDetail } from "@/components/casco/FootDetail";
import { TutorialModal, HelpModal } from "@/components/casco/Tutorial";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

type Screen =
  | { name: "today" }
  | { name: "register"; visit: Visit; activeFoot: FootKey | null }
  | { name: "history"; tag: string }
  | { name: "summary" }
  | { name: "animals" }
  | { name: "config" };

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
  const [tick, setTick] = useState(0);
  const [showTutorial, setShowTutorial] = useState(() => !isTutorialDone());
  const [showHelp, setShowHelp] = useState(false);

  const refresh = () => setTick((t) => t + 1);
  const goToday = () => setScreen({ name: "today" });

  const helpScreen =
    screen.name === "register" ? "register" :
    screen.name === "history" ? "history" :
    screen.name === "animals" ? "animals" :
    screen.name === "summary" ? "summary" :
    "today";

  return (
    <div className="min-h-screen pb-28">
      <Header
        farm={farm}
        onConfig={() => setScreen({ name: "config" })}
        showBack={screen.name !== "today"}
        onBack={goToday}
        screen={screen.name}
        onHelp={() => setShowHelp(true)}
      />

      <main className="mx-auto max-w-2xl px-4 pt-4" key={tick}>
        {screen.name === "today" && (
          <TodayScreen
            onNew={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
            onSummary={() => setScreen({ name: "summary" })}
            onAnimals={() => setScreen({ name: "animals" })}
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
        {screen.name === "animals" && (
          <AnimalsScreen onOpenHistory={(tag) => setScreen({ name: "history", tag })} />
        )}
        {screen.name === "config" && (
          <ConfigScreen
            farm={farm}
            onSave={(f) => {
              saveFarm(f);
              setFarm(f);
              goToday();
            }}
          />
        )}
      </main>

      {screen.name === "today" && (
        <button
          onClick={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
          className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-8 py-5 font-display text-xl uppercase text-primary-foreground stamp transition-transform active:scale-95 shadow-xl"
        >
          <Plus className="h-7 w-7" strokeWidth={3} />
          Nova Vaca
        </button>
      )}

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
    register: "Nova Visita",
    history: "Histórico",
    summary: "Resumo",
    animals: "Todos os Animais",
    config: "Configuração",
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

/* ───────────── Today ───────────── */
function TodayScreen({
  onNew,
  onOpenHistory,
  onSummary,
  onAnimals,
}: {
  onNew: () => void;
  onOpenHistory: (tag: string) => void;
  onSummary: () => void;
  onAnimals: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "problem" | "severe" | "recheck">("all");
  const today = todayISO();
  const allVisits = visitsForDay(today);

  const visits = useMemo(() => {
    if (filter === "problem") return allVisits.filter((v) => v.feet.some((f) => !f.ok));
    if (filter === "severe") return allVisits.filter((v) => footsWorstSeverity(v.feet) >= 3);
    if (filter === "recheck") return allVisits.filter((v) => v.feet.some((f) => f.recheck));
    return allVisits;
  }, [allVisits, filter]);

  const totalProblems = allVisits.reduce((acc, v) => acc + v.feet.filter((f) => !f.ok).length, 0);
  const severe = allVisits.reduce(
    (acc, v) => acc + v.feet.filter((f) => !f.ok && footWorstSeverity(f) >= 3).length,
    0,
  );
  const recheckCount = allVisits.reduce((acc, v) => acc + v.feet.filter((f) => f.recheck).length, 0);

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-3">
        <BigStat emoji="🐄" label="Animais" value={allVisits.length} tone="neutral" />
        <BigStat emoji="🦶" label="c/ Problema" value={totalProblems} tone="warn" />
        <BigStat emoji="🚨" label="Graves" value={severe} tone="danger" />
      </div>

      {recheckCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border-2 border-warn bg-warn/10 px-4 py-3">
          <Clock className="h-6 w-6 shrink-0 text-warn-foreground" />
          <p className="font-display text-sm uppercase text-warn-foreground">
            {recheckCount} pé(s) precisam de revisão
          </p>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar brinco…"
          inputMode="numeric"
          className="tap w-full rounded-2xl border-2 border-border bg-card pl-12 pr-4 font-display text-xl uppercase outline-none focus:border-primary"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>
      {search.trim() && (
        <button
          onClick={() => onOpenHistory(search.trim())}
          className="flex w-full items-center justify-between rounded-2xl border-2 border-primary/30 bg-primary/10 px-4 py-3 text-left"
        >
          <span className="flex items-center gap-2 font-display text-base uppercase">
            <History className="h-5 w-5" />
            Ver histórico do brinco {search.trim()}
          </span>
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Botões de ação */}
      <div className="grid grid-cols-2 gap-3">
        <ActionButton emoji="📋" label="Todos os Animais" onClick={onAnimals} />
        <ActionButton emoji="📊" label="Resumo do Dia" onClick={onSummary} />
      </div>

      {/* Filtros da lista do dia */}
      {allVisits.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip label="Todos" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterChip label="⚠️ Problema" active={filter === "problem"} onClick={() => setFilter("problem")} />
          <FilterChip label="🚨 Graves" active={filter === "severe"} onClick={() => setFilter("severe")} />
          <FilterChip label="⏰ Revisão" active={filter === "recheck"} onClick={() => setFilter("recheck")} />
        </div>
      )}

      {/* Lista do dia */}
      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Calendar className="h-4 w-4" />
          Lista de hoje · {visits.length} animal(is)
        </div>
        {allVisits.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
            <p className="text-4xl">🐄</p>
            <p className="mt-2 font-display text-lg uppercase">Nenhum animal ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">Toque em Nova Vaca para começar</p>
          </div>
        ) : visits.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
            <p className="font-display text-base uppercase text-muted-foreground">
              Nenhum resultado para este filtro
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visits.map((v) => (
              <VisitRow key={v.id} v={v} onClick={() => onOpenHistory(v.tag)} />
            ))}
          </ul>
        )}
      </section>
    </div>
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

/* ───────────── Animals ───────────── */
function AnimalsScreen({ onOpenHistory }: { onOpenHistory: (tag: string) => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "recheck" | "recent" | "severe">("all");

  const animals = useMemo(() => allAnimals(), []);

  const filtered = useMemo(() => {
    let list = animals;
    if (search.trim()) {
      list = list.filter((a) => a.tag.toLowerCase().includes(search.toLowerCase()));
    }
    if (filter === "recheck") list = list.filter((a) => a.hasRecheck);
    if (filter === "severe") list = list.filter((a) => a.worstSeverity >= 3);
    if (filter === "recent") {
      const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
      list = list.filter((a) => a.lastVisit >= cutoff);
    }
    return list;
  }, [animals, search, filter]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar brinco…"
          inputMode="numeric"
          className="tap w-full rounded-2xl border-2 border-border bg-card pl-12 pr-4 font-display text-xl uppercase outline-none focus:border-primary"
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 p-1">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <FilterChip label="Todos" active={filter === "all"} onClick={() => setFilter("all")} />
        <FilterChip label="⏰ Revisão" active={filter === "recheck"} onClick={() => setFilter("recheck")} />
        <FilterChip label="🚨 Graves" active={filter === "severe"} onClick={() => setFilter("severe")} />
        <FilterChip label="📅 7 dias" active={filter === "recent"} onClick={() => setFilter("recent")} />
      </div>

      <p className="px-1 text-xs text-muted-foreground">
        {filtered.length} animal(is) encontrado(s)
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-2 font-display text-lg uppercase">Nenhum resultado</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered.map((a) => (
            <li key={a.tag}>
              <button
                onClick={() => onOpenHistory(a.tag)}
                className="tap-lg flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card px-4 text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-surface">
                  <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
                  <span className="font-display text-xl font-black leading-none">{a.tag}</span>
                  <span className="text-base leading-none">{a.sex === "vaca" ? "🐄" : "🐂"}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-display text-base uppercase">{a.totalVisits} visita(s)</p>
                    {a.worstSeverity >= 3 && (
                      <span className="rounded bg-danger px-1.5 py-0.5 text-[10px] font-black uppercase text-danger-foreground">
                        Grave
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Última:{" "}
                    {new Date(a.lastVisit).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "2-digit",
                    })}
                    {a.hasRecheck && " · ⏰ Revisão"}
                    {a.hasResolved && " · ✅ Curado"}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
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
          <button
            onClick={() => onOpenHistory(visit.tag.trim())}
            className="mt-3 flex w-full items-center justify-between rounded-xl border border-warn/30 bg-warn/10 p-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-warn-foreground">
              <AlertTriangle className="h-4 w-4" />
              {previous.length} visita(s) anterior(es)
            </span>
            <span className="font-display text-xs uppercase">Ver</span>
          </button>
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
                                <span className="ml-auto text-muted-foreground">{treats}</span>
                              )}
                            </div>
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
function ConfigScreen({ farm, onSave }: { farm: FarmConfig; onSave: (f: FarmConfig) => void }) {
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
      </div>
    </div>
  );
}
