import { useMemo, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Info,
  ReceiptText,
  Save,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  billingForVisit,
  billingSummaryFromVisits,
  employeeBillingSummaries,
  formatCurrency,
  monthlyBillingSeries,
  normalizePricingConfig,
  pricingHasValues,
  type PricingConfig,
} from "@/dominio/billing";
import {
  visitBelongsToEmployee,
  visitIsFinalized,
  type DiseaseDefinition,
  type Visit,
} from "@/dominio/casco-store";
import { cn } from "@/dominio/utils";

interface EmployeeOption {
  id: string;
  name: string;
}

function previousMonth(prefix: string) {
  const date = new Date(`${prefix}-01T12:00:00`);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(prefix: string) {
  return new Date(`${prefix}-01T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
}

function percentageChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function ValueMetric({
  label,
  value,
  detail,
  strong,
}: {
  label: string;
  value: string;
  detail: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("border-b border-border p-4 last:border-b-0", strong && "bg-primary/5")}>
      <p className="text-[10px] font-black uppercase text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-black", strong && "text-primary")}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

export function BillingDashboard({
  visits,
  pricing,
  catalog,
  referenceDate,
  employees = [],
  allowEmployeeFilter = false,
}: {
  visits: Visit[];
  pricing: PricingConfig;
  catalog: DiseaseDefinition[];
  referenceDate: string;
  employees?: EmployeeOption[];
  allowEmployeeFilter?: boolean;
}) {
  const [month, setMonth] = useState(referenceDate.slice(0, 7));
  const [employeeId, setEmployeeId] = useState("all");
  const selectedEmployee = employees.find((employee) => employee.id === employeeId);
  const scopedVisits = useMemo(
    () =>
      visits
        .filter(visitIsFinalized)
        .filter(
          (visit) =>
            !selectedEmployee ||
            visitBelongsToEmployee(visit, selectedEmployee.id, selectedEmployee.name),
        ),
    [selectedEmployee, visits],
  );
  const monthVisits = scopedVisits.filter((visit) => visit.date.startsWith(month));
  const previousPrefix = previousMonth(month);
  const previousVisits = scopedVisits.filter((visit) => visit.date.startsWith(previousPrefix));
  const summary = billingSummaryFromVisits(monthVisits, pricing, catalog);
  const previous = billingSummaryFromVisits(previousVisits, pricing, catalog);
  const change = percentageChange(summary.total, previous.total);
  const series = monthlyBillingSeries(scopedVisits, pricing, catalog, `${month}-15`, 6);
  const maxSeriesValue = Math.max(...series.map((point) => point.total), 1);
  const hasSeriesValue = series.some((point) => point.total > 0);
  const employeeRows = employeeBillingSummaries(monthVisits, pricing, catalog);
  const recentVisits = [...monthVisits].sort((left, right) => right.createdAt - left.createdAt);
  const hasConfiguredPrices = pricingHasValues(pricing);

  return (
    <div className="space-y-5">
      <section className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <CircleDollarSign className="h-7 w-7 text-primary" aria-hidden="true" />
          <div>
            <h2 className="font-display text-xl font-black uppercase">Produção em valores</h2>
            <p className="text-xs text-muted-foreground">
              Serviços concluídos conforme a tabela vigente em cada visita
            </p>
          </div>
        </div>
        <div className={cn("mt-4 grid gap-3", allowEmployeeFilter && "sm:grid-cols-2")}>
          <label>
            <span className="text-[10px] font-black uppercase text-muted-foreground">Mês</span>
            <input
              type="month"
              value={month}
              max={referenceDate.slice(0, 7)}
              onChange={(event) => setMonth(event.target.value)}
              className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
            />
          </label>
          {allowEmployeeFilter ? (
            <label>
              <span className="text-[10px] font-black uppercase text-muted-foreground">
                Funcionário
              </span>
              <select
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-lg border border-border bg-surface px-3 outline-none focus:border-primary"
              >
                <option value="all">Toda a equipe</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </section>

      {!hasConfiguredPrices ? (
        <aside className="flex gap-3 rounded-lg border border-warn/50 bg-warn/10 p-3 text-sm">
          <Info className="h-5 w-5 shrink-0 text-warn-foreground" aria-hidden="true" />
          <p>
            <strong>A tabela de preços ainda está zerada.</strong> Os atendimentos aparecem nas
            métricas, mas o saldo ficará em R$ 0,00 até o administrador cadastrar os valores.
          </p>
        </aside>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-border bg-card sm:grid sm:grid-cols-4">
        <ValueMetric
          label="Saldo produzido"
          value={formatCurrency(summary.total)}
          detail={monthLabel(month)}
          strong
        />
        <ValueMetric
          label="Visitas cobradas"
          value={String(summary.visits)}
          detail="Somente visitas concluídas"
        />
        <ValueMetric
          label="Média por visita"
          value={formatCurrency(summary.averagePerVisit)}
          detail="Valor total dividido pelas visitas"
        />
        <ValueMetric
          label="Comparação mensal"
          value={`${change > 0 ? "+" : ""}${change}%`}
          detail={`${formatCurrency(previous.total)} no mês anterior`}
        />
      </section>

      {summary.estimatedVisits > 0 ? (
        <aside className="flex gap-3 rounded-lg border border-warn/50 bg-warn/10 p-3 text-sm">
          <Info className="h-5 w-5 shrink-0 text-warn-foreground" aria-hidden="true" />
          <p>
            <strong>{summary.estimatedVisits} visita(s) antiga(s)</strong> usam a tabela atual como
            estimativa. Novos atendimentos guardam o valor do dia e não mudam com reajustes.
          </p>
        </aside>
      ) : null}

      <section aria-labelledby="billing-months-title">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 id="billing-months-title" className="font-display text-base font-black uppercase">
              Últimos seis meses
            </h3>
            <p className="text-xs text-muted-foreground">Evolução do valor produzido</p>
          </div>
          {change >= 0 ? (
            <TrendingUp className="h-6 w-6 text-good" aria-hidden="true" />
          ) : (
            <TrendingDown className="h-6 w-6 text-danger" aria-hidden="true" />
          )}
        </div>
        {hasSeriesValue ? (
          <div className="mt-3 grid h-44 grid-cols-6 items-end gap-2 border-b border-border px-1">
            {series.map((point) => (
              <div
                key={point.prefix}
                className="flex h-full min-w-0 flex-col justify-end text-center"
              >
                <span className="mb-1 truncate text-[9px] font-bold text-muted-foreground">
                  {point.total > 0 ? formatCurrency(point.total) : "R$ 0"}
                </span>
                <div
                  className="mx-auto w-full max-w-12 rounded-t bg-primary"
                  style={{
                    height: `${Math.max(point.total > 0 ? 12 : 3, (point.total / maxSeriesValue) * 112)}px`,
                  }}
                  aria-label={`${point.label}: ${formatCurrency(point.total)}, ${point.visits} visitas`}
                />
                <span className="mt-1 truncate text-[10px] font-black uppercase">
                  {point.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex min-h-20 items-center rounded-lg bg-surface px-4 text-sm text-muted-foreground">
            Ainda não há valores produzidos para comparar nestes seis meses.
          </div>
        )}
      </section>

      <section aria-labelledby="billing-services-title">
        <div className="flex items-center gap-2">
          <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 id="billing-services-title" className="font-display text-base font-black uppercase">
            Composição dos serviços
          </h3>
        </div>
        {summary.lines.length > 0 ? (
          <div className="mt-3 divide-y divide-border border-y border-border">
            {summary.lines.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate font-bold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} ocorrência(s)</p>
                </div>
                <strong className="shrink-0 text-primary">{formatCurrency(item.total)}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-surface p-4 text-sm text-muted-foreground">
            Nenhum serviço concluído neste mês.
          </p>
        )}
      </section>

      {allowEmployeeFilter && employeeId === "all" ? (
        <section aria-labelledby="billing-team-title">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 id="billing-team-title" className="font-display text-base font-black uppercase">
              Produção por funcionário
            </h3>
          </div>
          <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {employeeRows.map((row, index) => (
              <div key={row.employeeId ?? row.employeeName} className="flex items-center gap-3 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display font-black text-primary">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{row.employeeName}</p>
                  <p className="text-xs text-muted-foreground">{row.visits} visita(s)</p>
                </div>
                <strong className="shrink-0 text-primary">{formatCurrency(row.total)}</strong>
              </div>
            ))}
            {employeeRows.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Nenhuma produção neste mês.</p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="billing-visits-title">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          <h3 id="billing-visits-title" className="font-display text-base font-black uppercase">
            Visitas do mês
          </h3>
        </div>
        <div className="mt-3 divide-y divide-border border-y border-border">
          {recentVisits.slice(0, 20).map((visit) => {
            const billing = billingForVisit(visit, pricing, catalog);
            return (
              <div key={visit.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                <div className="min-w-0">
                  <p className="font-bold">Animal {visit.tag}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(`${visit.date}T12:00:00`).toLocaleDateString("pt-BR")} ·{" "}
                    {visit.preventivo ? "Preventivo" : "Clínico"} ·{" "}
                    {visit.employee_name ?? visit.visitante_nome ?? "Sem responsável"}
                  </p>
                </div>
                <div className="text-right">
                  <strong className="text-primary">{formatCurrency(billing.total)}</strong>
                  {billing.estimated ? (
                    <p className="text-[9px] font-bold uppercase text-warn-foreground">Estimado</p>
                  ) : null}
                </div>
              </div>
            );
          })}
          {recentVisits.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma visita neste mês.</p>
          ) : null}
        </div>
      </section>

      <aside className="flex gap-3 rounded-lg bg-surface p-3 text-xs text-muted-foreground">
        <Banknote className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Saldo produzido representa serviços registrados. Pagamento, desconto ou repasse ainda não
          são controlados por esta versão.
        </p>
      </aside>
    </div>
  );
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase text-muted-foreground">{label}</span>
      <div className="mt-1 flex min-h-12 items-center rounded-lg border border-border bg-surface px-3 focus-within:border-primary">
        <span className="mr-2 text-sm font-bold text-muted-foreground">R$</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="min-w-0 flex-1 bg-transparent text-right text-lg font-bold outline-none"
        />
      </div>
    </label>
  );
}

export function PricingEditor({
  pricing,
  catalog,
  saving,
  onSave,
}: {
  pricing: PricingConfig;
  catalog: DiseaseDefinition[];
  saving?: boolean;
  onSave: (pricing: PricingConfig) => void | Promise<void>;
}) {
  const [draft, setDraft] = useState(() => normalizePricingConfig(pricing));
  const setPrice = (
    key:
      | "preventive"
      | "clinicalVisit"
      | "bandage"
      | "tacoApply"
      | "tacoMaintain"
      | "tacoRemove"
      | "travelPerKm",
    value: number,
  ) => setDraft((current) => ({ ...current, [key]: value }));
  const setPreventiveTier = (index: number, value: number) =>
    setDraft((current) => ({
      ...current,
      preventiveTiers: current.preventiveTiers.map((tier, tierIndex) =>
        tierIndex === index ? { ...tier, price: value } : tier,
      ),
    }));

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave(normalizePricingConfig(draft));
      }}
    >
      <section>
        <h3 className="font-display text-base font-black uppercase">Tabela de serviços</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Valores padrão da fazenda. Use zero para não cobrar um item.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {draft.preventiveTiers.map((tier, index) => (
            <PriceInput
              key={`${tier.min}-${tier.max ?? "mais"}`}
              label={`Preventivo · ${tier.min}${tier.max ? ` a ${tier.max}` : " ou mais"} animais`}
              value={tier.price}
              onChange={(value) => setPreventiveTier(index, value)}
            />
          ))}
          <PriceInput
            label="Preventivo padrão · sem quantidade informada"
            value={draft.preventive}
            onChange={(value) => setPrice("preventive", value)}
          />
          <PriceInput
            label="Atendimento clínico · por animal"
            value={draft.clinicalVisit}
            onChange={(value) => setPrice("clinicalVisit", value)}
          />
          <PriceInput
            label="Curativo · por casco"
            value={draft.bandage}
            onChange={(value) => setPrice("bandage", value)}
          />
          <PriceInput
            label="Colocação de taco · por casco"
            value={draft.tacoApply}
            onChange={(value) => setPrice("tacoApply", value)}
          />
          <PriceInput
            label="Manutenção de taco · por casco"
            value={draft.tacoMaintain}
            onChange={(value) => setPrice("tacoMaintain", value)}
          />
          <PriceInput
            label="Retirada de taco · por casco"
            value={draft.tacoRemove}
            onChange={(value) => setPrice("tacoRemove", value)}
          />
          <PriceInput
            label="Deslocamento · por quilômetro"
            value={draft.travelPerKm}
            onChange={(value) => setPrice("travelPerKm", value)}
          />
        </div>
      </section>

      <section className="border-t border-border pt-5">
        <h3 className="font-display text-base font-black uppercase">Valor por doença</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Cada ocorrência em um casco gera um item separado no atendimento.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {catalog
            .filter((disease) => disease.active)
            .map((disease) => (
              <PriceInput
                key={disease.code}
                label={disease.full}
                value={draft.diseases[disease.code] ?? 0}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    diseases: { ...current.diseases, [disease.code]: value },
                  }))
                }
              />
            ))}
        </div>
      </section>

      <aside className="flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-sm">
        <Info className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <p>
          Ao salvar uma nova visita, os preços usados ficam congelados naquele registro. Reajustes
          valem apenas para os próximos atendimentos.
        </p>
      </aside>

      <button
        disabled={saving}
        className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"
      >
        <Save className="h-5 w-5" aria-hidden="true" />
        {saving ? "Salvando tabela" : "Salvar tabela de preços"}
      </button>
    </form>
  );
}
