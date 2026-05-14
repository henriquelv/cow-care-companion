import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Plus,
  Search,
  ListChecks,
  BarChart3,
  ArrowLeft,
  Save,
  Trash2,
  Cog,
  History,
  Hash,
  Calendar,
  Footprints,
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
  severityLabel,
  todayISO,
  uid,
  visitsByTag,
  visitsForDay,
  type FarmConfig,
  type FootEntry,
  type FootKey,
  type Sex,
  type Visit,
} from "@/lib/casco-store";
import { HoofMap } from "@/components/casco/HoofMap";
import { FootDetail } from "@/components/casco/FootDetail";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

type Screen =
  | { name: "today" }
  | { name: "register"; visit: Visit; activeFoot: FootKey | null }
  | { name: "history"; tag: string }
  | { name: "summary" }
  | { name: "config" };

function newDraft(tag = "", sex: Sex = "vaca"): Visit {
  return {
    id: uid(),
    date: todayISO(),
    createdAt: Date.now(),
    tag,
    sex,
    feet: (["FE", "FD", "TE", "TD"] as FootKey[]).map((f) => ({ foot: f, ok: true })),
  };
}

function Index() {
  const [farm, setFarm] = useState<FarmConfig>(() => loadFarm());
  const [screen, setScreen] = useState<Screen>(() => ({ name: "today" }));
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  if (!farm.configured) {
    return (
      <ConfigScreen
        farm={farm}
        onSave={(f) => {
          saveFarm(f);
          setFarm(f);
        }}
        first
      />
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <Header
        farm={farm}
        onConfig={() => setScreen({ name: "config" })}
        showBack={screen.name !== "today"}
        onBack={() => setScreen({ name: "today" })}
      />

      <main className="mx-auto max-w-2xl px-4 pt-4" key={tick}>
        {screen.name === "today" && (
          <TodayScreen
            onNew={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
            onSummary={() => setScreen({ name: "summary" })}
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
              setScreen({ name: "today" });
            }}
            onOpenHistory={(tag) => setScreen({ name: "history", tag })}
          />
        )}
        {screen.name === "history" && (
          <HistoryScreen
            tag={screen.tag}
            onBack={() => setScreen({ name: "today" })}
            onDelete={(id) => {
              deleteVisit(id);
              refresh();
            }}
          />
        )}
        {screen.name === "summary" && <SummaryScreen />}
        {screen.name === "config" && (
          <ConfigScreen
            farm={farm}
            onSave={(f) => {
              saveFarm(f);
              setFarm(f);
              setScreen({ name: "today" });
            }}
          />
        )}
      </main>

      {screen.name === "today" && (
        <button
          onClick={() => setScreen({ name: "register", visit: newDraft(), activeFoot: null })}
          className="fixed bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full bg-primary px-7 py-4 font-display text-lg uppercase text-primary-foreground stamp transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" strokeWidth={3} />
          Novo animal
        </button>
      )}
    </div>
  );
}

/* ------------------------- Header ------------------------- */
function Header({
  farm,
  onConfig,
  showBack,
  onBack,
}: {
  farm: FarmConfig;
  onConfig: () => void;
  showBack: boolean;
  onBack: () => void;
}) {
  return (
    <header className="sticky top-0 z-10 border-b-2 border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
        {showBack ? (
          <button
            onClick={onBack}
            className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground font-display text-lg">
            🐄
          </div>
        )}
        <div className="flex-1 leading-tight">
          <p className="font-display text-base uppercase">{farm.farmName || "Fazenda"}</p>
          <p className="text-xs text-muted-foreground">
            {farm.worker ? `${farm.worker} · ` : ""}
            {new Date().toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
          </p>
        </div>
        <button
          onClick={onConfig}
          className="tap flex h-11 w-11 items-center justify-center rounded-full bg-surface"
          aria-label="Configuração"
        >
          <Cog className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

/* ------------------------- Today ------------------------- */
function TodayScreen({
  onNew,
  onOpenHistory,
  onSummary,
}: {
  onNew: () => void;
  onOpenHistory: (tag: string) => void;
  onSummary: () => void;
}) {
  const [search, setSearch] = useState("");
  const today = todayISO();
  const visits = visitsForDay(today);
  const totalProblems = visits.reduce(
    (acc, v) => acc + v.feet.filter((f) => !f.ok).length,
    0,
  );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-card p-5 stamp">
        <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Hoje
        </p>
        <div className="mt-1 flex items-end gap-6">
          <div>
            <p className="font-display text-5xl leading-none">{visits.length}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">animais</p>
          </div>
          <div>
            <p className="font-display text-5xl leading-none text-danger">{totalProblems}</p>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">pés c/ problema</p>
          </div>
          <button
            onClick={onSummary}
            className="ml-auto tap flex items-center gap-2 rounded-full bg-foreground px-4 text-sm font-display uppercase text-background"
          >
            <BarChart3 className="h-4 w-4" /> Resumo
          </button>
        </div>
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar brinco no histórico…"
          className="tap w-full rounded-xl border-2 border-border bg-card pl-11 pr-4 font-display text-lg uppercase outline-none focus:border-primary"
        />
        {search.trim() && (
          <button
            onClick={() => onOpenHistory(search.trim())}
            className="mt-2 w-full rounded-xl bg-secondary p-3 text-left text-sm font-semibold"
          >
            Ver histórico do brinco{" "}
            <span className="font-display uppercase">{search.trim()}</span>
          </button>
        )}
      </div>

      <section>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <ListChecks className="h-4 w-4" />
          Lista do dia
        </div>
        {visits.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
            <p className="font-display text-lg uppercase">Nenhum animal ainda</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Toque em <strong>Novo animal</strong> para começar.
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

function VisitRow({ v, onClick }: { v: Visit; onClick: () => void }) {
  const bad = v.feet.filter((f) => !f.ok);
  const worst = bad.reduce((acc, f) => Math.max(acc, f.severity ?? 0), 0);
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
          "tap-lg flex w-full items-center gap-4 rounded-2xl border-2 bg-card p-3 text-left",
          tone,
        )}
      >
        <div className="flex h-14 w-14 flex-col items-center justify-center rounded-xl bg-surface font-display">
          <span className="text-[10px] uppercase text-muted-foreground">Brinco</span>
          <span className="text-lg leading-none">{v.tag || "—"}</span>
        </div>
        <div className="flex-1">
          <p className="font-display text-base uppercase">
            {v.sex === "vaca" ? "Vaca" : "Touro"}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(v.createdAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {bad.length === 0 ? "Tudo bom" : `${bad.length} pé(s) c/ problema`}
          </p>
        </div>
        <div className="flex gap-1">
          {(["FE", "FD", "TE", "TD"] as FootKey[]).map((k) => {
            const f = v.feet.find((x) => x.foot === k)!;
            return (
              <span
                key={k}
                className={cn(
                  "h-7 w-5 rounded-sm",
                  f.ok ? "bg-good/70" : (f.severity ?? 1) >= 3 ? "bg-danger" : "bg-warn",
                )}
                title={`${FOOT_LABEL[k]}: ${f.ok ? "Bom" : severityLabel(f.severity ?? 1)}`}
              />
            );
          })}
        </div>
      </button>
    </li>
  );
}

/* ------------------------- Register ------------------------- */
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
    const next = visit.feet.map((f) =>
      f.foot === k
        ? f.ok
          ? { ...f, ok: false }
          : { foot: f.foot, ok: true }
        : f,
    );
    onChange({ ...visit, feet: next }, k);
  }

  function updateFoot(e: FootEntry) {
    onChange(
      { ...visit, feet: visit.feet.map((f) => (f.foot === e.foot ? e : f)) },
      e.foot,
    );
  }

  const canSave =
    visit.tag.trim().length > 0 &&
    visit.feet.every((f) => f.ok || (f.lesion && f.severity && f.treatment));

  return (
    <div className="space-y-5">
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
          className="w-full rounded-xl border-2 border-border bg-surface px-4 py-3 font-display text-4xl uppercase tracking-wider outline-none focus:border-primary"
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(["vaca", "touro"] as Sex[]).map((s) => {
            const active = visit.sex === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...visit, sex: s }, activeFoot)}
                className={cn(
                  "tap-lg flex items-center justify-center gap-2 rounded-xl border-2 font-display text-lg uppercase",
                  active
                    ? "border-primary bg-primary text-primary-foreground stamp"
                    : "border-border bg-surface",
                )}
              >
                <span className="text-2xl">{s === "vaca" ? "🐄" : "🐂"}</span>
                {s}
              </button>
            );
          })}
        </div>
        {previous.length > 0 && (
          <button
            onClick={() => onOpenHistory(visit.tag.trim())}
            className="mt-3 flex w-full items-center justify-between rounded-xl bg-accent/30 p-3 text-left"
          >
            <span className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" /> {previous.length} visita(s) anterior(es)
            </span>
            <span className="font-display text-xs uppercase">Ver</span>
          </button>
        )}
      </section>

      <section className="rounded-2xl bg-card p-4 stamp">
        <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          <Footprints className="h-4 w-4" /> Toque em cada pé
        </p>
        <HoofMap status={status} active={activeFoot} onSelect={toggleFoot} />
        <p className="mt-3 text-center text-xs text-muted-foreground">
          1º toque = <span className="font-bold text-danger">com problema</span> · 2º toque = volta a{" "}
          <span className="font-bold text-good">bom</span>
        </p>
      </section>

      {active && !active.ok && (
        <FootDetail
          entry={active}
          onChange={updateFoot}
          onClose={() => onChange(visit, null)}
        />
      )}

      <button
        type="button"
        disabled={!canSave}
        onClick={() => onSave(visit)}
        className={cn(
          "tap-lg flex w-full items-center justify-center gap-3 rounded-2xl font-display text-lg uppercase transition-all",
          canSave
            ? "bg-primary text-primary-foreground stamp active:scale-[0.98]"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Save className="h-6 w-6" />
        Salvar visita
      </button>
      {!canSave && (
        <p className="-mt-2 text-center text-xs text-muted-foreground">
          Preencha o brinco e, em cada pé com problema, lesão + gravidade + tratamento.
        </p>
      )}
    </div>
  );
}

/* ------------------------- History ------------------------- */
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
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-card p-4 stamp">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Histórico do brinco
        </p>
        <p className="font-display text-4xl">{tag}</p>
        <p className="text-sm text-muted-foreground">
          {items.length} visita(s) registrada(s)
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-8 text-center">
          <p className="font-display uppercase">Sem histórico</p>
          <button
            onClick={onBack}
            className="mt-3 rounded-full bg-primary px-4 py-2 text-sm font-display uppercase text-primary-foreground"
          >
            Voltar
          </button>
        </div>
      ) : (
        <ol className="relative space-y-3 border-l-2 border-border pl-5">
          {items.map((v) => {
            const bad = v.feet.filter((f) => !f.ok);
            const worst = bad.reduce((a, f) => Math.max(a, f.severity ?? 0), 0);
            return (
              <li key={v.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[27px] top-3 h-4 w-4 rounded-full border-2 border-background",
                    bad.length === 0 ? "bg-good" : worst >= 3 ? "bg-danger" : "bg-warn",
                  )}
                />
                <div className="rounded-2xl bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display text-sm uppercase">
                        <Calendar className="mr-1 inline h-3.5 w-3.5" />
                        {new Date(v.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {bad.length === 0
                          ? "Todos os pés bons"
                          : `${bad.length} pé(s) tratado(s)`}
                      </p>
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
                  {bad.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {bad.map((f) => {
                        const lesion = LESIONS.find((l) => l.code === f.lesion);
                        const treat = TREATMENTS.find((t) => t.code === f.treatment);
                        return (
                          <li
                            key={f.foot}
                            className="flex items-center gap-2 rounded-lg bg-surface px-2 py-1.5 text-xs"
                          >
                            <span className="rounded bg-foreground px-1.5 py-0.5 font-display text-[10px] uppercase text-background">
                              {f.foot}
                            </span>
                            <span className="font-semibold">{lesion?.name ?? "—"}</span>
                            <span className="text-muted-foreground">
                              {severityLabel(f.severity ?? 1)}
                            </span>
                            <span className="ml-auto font-display uppercase text-[10px]">
                              {treat?.label ?? "—"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {v.feet.find((f) => f.photo) && (
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                      {v.feet
                        .filter((f) => f.photo)
                        .map((f) => (
                          <img
                            key={f.foot}
                            src={f.photo}
                            alt=""
                            className="h-20 w-20 rounded-lg object-cover"
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

/* ------------------------- Summary ------------------------- */
function SummaryScreen() {
  const today = todayISO();
  const visits = visitsForDay(today);
  const all = loadVisits();
  const buckets = { leve: 0, medio: 0, grave: 0 };
  let badFeet = 0;
  visits.forEach((v) =>
    v.feet.forEach((f) => {
      if (!f.ok) {
        badFeet++;
        const b = severityBucket(f.severity);
        if (b) buckets[b]++;
      }
    }),
  );
  const lesionCount: Record<string, number> = {};
  visits.forEach((v) =>
    v.feet.forEach((f) => {
      if (!f.ok && f.lesion) lesionCount[f.lesion] = (lesionCount[f.lesion] ?? 0) + 1;
    }),
  );
  const topLesions = Object.entries(lesionCount).sort((a, b) => b[1] - a[1]);

  // Última semana
  const week = all.filter(
    (v) => Date.now() - new Date(v.createdAt).getTime() < 7 * 24 * 3600 * 1000,
  );

  const max = Math.max(buckets.leve, buckets.medio, buckets.grave, 1);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-5 stamp">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Resumo do dia
        </p>
        <div className="mt-2 grid grid-cols-3 gap-3">
          <Stat label="Animais" value={visits.length} />
          <Stat
            label="Com problema"
            value={visits.filter((v) => v.feet.some((f) => !f.ok)).length}
            tone="warn"
          />
          <Stat label="Pés tratados" value={badFeet} tone="danger" />
        </div>
      </section>

      <section className="rounded-2xl bg-card p-5">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Por gravidade
        </p>
        <div className="space-y-2">
          {(["leve", "medio", "grave"] as const).map((b) => (
            <div key={b} className="flex items-center gap-3">
              <span className="w-16 font-display text-xs uppercase">
                {b === "medio" ? "Médio" : b}
              </span>
              <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface">
                <div
                  className={cn(
                    "h-full rounded-md transition-all",
                    b === "leve" && "bg-good",
                    b === "medio" && "bg-warn",
                    b === "grave" && "bg-danger",
                  )}
                  style={{ width: `${(buckets[b] / max) * 100}%` }}
                />
              </div>
              <span className="w-8 text-right font-display text-lg">{buckets[b]}</span>
            </div>
          ))}
        </div>
      </section>

      {topLesions.length > 0 && (
        <section className="rounded-2xl bg-card p-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Lesões mais frequentes (hoje)
          </p>
          <ul className="space-y-1">
            {topLesions.map(([code, n]) => {
              const l = LESIONS.find((x) => x.code === code);
              return (
                <li key={code} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="mr-2 rounded bg-foreground px-1.5 py-0.5 font-display text-[10px] uppercase text-background">
                      {l?.name}
                    </span>
                    {l?.full}
                  </span>
                  <span className="font-display">{n}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-card p-5">
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Últimos 7 dias
        </p>
        <p className="font-display text-3xl">{week.length} visitas</p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "danger";
}) {
  return (
    <div className="rounded-xl bg-surface p-3 text-center">
      <p
        className={cn(
          "font-display text-3xl leading-none",
          tone === "warn" && "text-warn",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

/* ------------------------- Config ------------------------- */
function ConfigScreen({
  farm,
  onSave,
  first,
}: {
  farm: FarmConfig;
  onSave: (f: FarmConfig) => void;
  first?: boolean;
}) {
  const [name, setName] = useState(farm.farmName);
  const [worker, setWorker] = useState(farm.worker);
  const valid = name.trim().length > 0;

  return (
    <div className={cn(first && "min-h-screen", "px-4 py-8")}>
      <div className="mx-auto max-w-md space-y-5">
        {first && (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-3xl text-primary-foreground stamp">
              🐄
            </div>
            <h1 className="font-display text-3xl uppercase">Caderninho de Casco</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Configure a fazenda uma única vez. Tudo fica salvo neste aparelho.
            </p>
          </div>
        )}
        <div className="space-y-3 rounded-2xl bg-card p-5 stamp">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Nome da fazenda
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 font-display text-xl uppercase outline-none focus:border-primary"
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
              className="mt-1 w-full rounded-xl border-2 border-border bg-surface px-4 py-3 text-base outline-none focus:border-primary"
              placeholder="Ex: João"
            />
          </label>
        </div>
        <button
          disabled={!valid}
          onClick={() =>
            onSave({ farmName: name.trim(), worker: worker.trim(), configured: true })
          }
          className={cn(
            "tap-lg w-full rounded-2xl font-display text-lg uppercase",
            valid
              ? "bg-primary text-primary-foreground stamp"
              : "bg-muted text-muted-foreground",
          )}
        >
          {first ? "Começar" : "Salvar"}
        </button>
      </div>
    </div>
  );
}
