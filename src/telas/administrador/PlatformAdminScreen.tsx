import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Building2,
  ChevronLeft,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import { cn } from "@/dominio/utils";
import {
  platformAdminService,
  type PlatformClient,
  type PlatformEmployee,
  type PlatformFarm,
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

export function PlatformAdminScreen({ onExit }: { onExit: () => void }) {
  const [unlocked, setUnlocked] = useState(() => platformAdminService.isUnlocked());
  const [pin, setPin] = useState("");
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [newFarmName, setNewFarmName] = useState("");
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(emptyEmployeeForm);
  const [resetTarget, setResetTarget] = useState<PlatformEmployee | null>(null);
  const [resetPin, setResetPin] = useState("1234");
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

  const selectedClient = useMemo(
    () => overview?.clients.find((client) => client.id === selectedClientId) ?? overview?.clients[0] ?? null,
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

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const next = await platformAdminService.overview();
      setOverview(next);
      setSelectedClientId((current) =>
        next.clients.some((client) => client.id === current) ? current : (next.clients[0]?.id ?? ""),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (unlocked) void refresh();
  }, [unlocked]);

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

  if (!unlocked) {
    return (
      <main className="min-h-[100dvh] bg-background px-4 py-6">
        <section className="mx-auto w-full max-w-md rounded-2xl border-2 border-border bg-card p-5 shadow-sm">
          <button type="button" onClick={onExit} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface" aria-label="Sair da conta mestra">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-display text-2xl font-black uppercase">Conta mestra</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Administração central de empresas, fazendas, equipe e acessos. Confirme o PIN para abrir os dados.
          </p>
          <form className="mt-6 space-y-3" onSubmit={unlock}>
            <label className="block text-xs font-bold uppercase text-muted-foreground">
              PIN da conta mestra
              <input
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-center text-xl font-bold tracking-[0.18em] outline-none [-webkit-text-security:disc] focus:border-primary"
                placeholder="••••"
              />
            </label>
            <button disabled={loading || pin.length < 4} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50">
              {loading ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <LockKeyhole className="h-5 w-5" />}
              Abrir administração
            </button>
          </form>
          {error ? <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-3 py-3 text-sm font-bold text-destructive">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background pb-10">
      <header className="border-b-2 border-border bg-card px-4 py-4">
        <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><ShieldCheck className="h-6 w-6" /></div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-black uppercase">Administração central</p>
            <p className="text-xs text-muted-foreground">Conta mestra · empresas independentes</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface" aria-label="Atualizar dados"><RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} /></button>
          <button type="button" onClick={() => { platformAdminService.clear(); onExit(); }} className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-border bg-surface" aria-label="Sair da conta mestra"><LogOut className="h-5 w-5" /></button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
        {error ? <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">{error}</p> : null}
        {message ? <p role="status" className="rounded-xl bg-good/10 px-4 py-3 text-sm font-bold text-good">{message}</p> : null}

        <section className="rounded-2xl border-2 border-border bg-card p-4">
          <div className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /><h2 className="font-display font-black uppercase">Empresas</h2></div>
          <p className="mt-1 text-xs text-muted-foreground">Escolha uma empresa para administrar suas fazendas e funcionários. Os dados continuam isolados entre elas.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {overview?.clients.map((client) => (
              <button key={client.id} type="button" onClick={() => setSelectedClientId(client.id)} className={cn("min-h-16 rounded-xl border-2 px-4 text-left", selectedClient?.id === client.id ? "border-primary bg-primary/5" : "border-border bg-surface")}>
                <span className="block font-display font-black uppercase">{client.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">Código {client.activation_code} · {statusLabel(client.status)}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedClient ? <>
          <section className="rounded-2xl border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /><h2 className="font-display font-black uppercase">Fazendas de {selectedClient.name}</h2></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {farms.map((farm) => (
                <article key={farm.id} className="rounded-xl border-2 border-border bg-surface p-3">
                  <p className="font-display font-black uppercase">{farm.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{statusLabel(farm.status)}</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" disabled={loading} onClick={() => { setEditingFarm(farm); setEditingFarmName(farm.name); }} className="flex min-h-10 items-center gap-1 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase">
                      <Pencil className="h-4 w-4" />Editar
                    </button>
                    <button type="button" disabled={loading} onClick={() => void save("update_farm", { farm_id: farm.id, status: farm.status === "active" ? "blocked" : "active" }, farm.status === "active" ? "Fazenda bloqueada." : "Fazenda reativada.")} className="min-h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase">
                      {farm.status === "active" ? "Bloquear" : "Reativar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <form className="mt-4 grid gap-2 rounded-xl bg-primary/5 p-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => { event.preventDefault(); if (newFarmName.trim()) void save("create_farm", { client_id: selectedClient.id, name: newFarmName }, "Nova fazenda cadastrada.").then(() => setNewFarmName("")); }}>
              <input value={newFarmName} onChange={(event) => setNewFarmName(event.target.value)} placeholder="Nome da nova fazenda" className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary" />
              <button disabled={loading || newFarmName.trim().length < 2} className="flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-4 font-display font-black uppercase text-primary-foreground disabled:opacity-50"><Plus className="h-5 w-5" />Adicionar fazenda</button>
            </form>
          </section>

          <section className="rounded-2xl border-2 border-border bg-card p-4">
            <div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="font-display font-black uppercase">Funcionários</h2></div>
            <p className="mt-1 text-xs text-muted-foreground">A senha nunca é exibida. Use redefinir PIN para criar um novo acesso quando necessário.</p>
            <div className="mt-4 grid gap-2">
              {employees.map((employee) => (
                <article key={employee.id} className="rounded-xl border-2 border-border bg-surface p-3">
                  <div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card text-primary"><UserCog className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-display font-black uppercase">{employee.name}</p><p className="mt-1 text-xs text-muted-foreground">{employee.login_name} · código {employee.employee_code} · {farmName(employee.farm_id)}</p></div><span className={cn("text-xs font-bold", employee.status === "active" ? "text-good" : "text-destructive")}>{statusLabel(employee.status)}</span></div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingEmployee(employee); setEditingEmployeeForm({ name: employee.name, login_name: employee.login_name, employee_code: employee.employee_code }); }} className="flex min-h-10 items-center gap-1 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase"><Pencil className="h-4 w-4" />Editar</button>
                    <button type="button" onClick={() => setResetTarget(employee)} className="min-h-10 rounded-lg bg-primary px-3 text-xs font-bold uppercase text-primary-foreground"><KeyRound className="mr-1 inline h-4 w-4" />Redefinir PIN</button>
                    <button type="button" disabled={loading} onClick={() => void save("update_employee", { employee_id: employee.id, status: employee.status === "active" ? "blocked" : "active" }, employee.status === "active" ? "Funcionário bloqueado." : "Funcionário reativado.")} className="min-h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase">{employee.status === "active" ? "Bloquear" : "Reativar"}</button>
                    <button type="button" disabled={loading} onClick={() => void save("update_employee", { employee_id: employee.id, is_admin: !employee.is_admin }, employee.is_admin ? "Acesso de gerente removido." : "Acesso de gerente concedido.")} className="min-h-10 rounded-lg border-2 border-border bg-card px-3 text-xs font-bold uppercase">{employee.is_admin ? "Remover gerente" : "Tornar gerente"}</button>
                  </div>
                </article>
              ))}
            </div>
            <form className="mt-4 space-y-3 rounded-xl bg-primary/5 p-3" onSubmit={(event) => { event.preventDefault(); if (employeeForm.farm_id) void save("create_employee", employeeForm, "Funcionário cadastrado.").then(() => setEmployeeForm({ ...emptyEmployeeForm, farm_id: employeeForm.farm_id })); }}>
              <p className="font-display text-sm font-black uppercase">Novo funcionário</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={employeeForm.name} onChange={(event) => setEmployeeForm((form) => ({ ...form, name: event.target.value }))} placeholder="Nome completo" className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary" />
                <input value={employeeForm.login_name} onChange={(event) => setEmployeeForm((form) => ({ ...form, login_name: event.target.value }))} placeholder="Login" className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary" />
                <input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm((form) => ({ ...form, employee_code: event.target.value }))} placeholder="Código" className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary" />
                <input inputMode="numeric" maxLength={6} value={employeeForm.pin} onChange={(event) => setEmployeeForm((form) => ({ ...form, pin: event.target.value.replace(/\D/g, "") }))} placeholder="PIN inicial" className="min-h-12 rounded-lg border-2 border-border bg-card px-3 text-center font-bold outline-none focus:border-primary" />
                <select value={employeeForm.farm_id} onChange={(event) => setEmployeeForm((form) => ({ ...form, farm_id: event.target.value }))} className="min-h-12 rounded-lg border-2 border-border bg-card px-3 font-bold outline-none focus:border-primary"><option value="">Selecione a fazenda</option>{farms.filter((farm) => farm.status === "active").map((farm) => <option key={farm.id} value={farm.id}>{farm.name}</option>)}</select>
                <label className="flex min-h-12 items-center gap-2 rounded-lg border-2 border-border bg-card px-3 text-sm font-bold"><input type="checkbox" checked={employeeForm.is_admin} onChange={(event) => setEmployeeForm((form) => ({ ...form, is_admin: event.target.checked }))} />Gerente desta empresa</label>
              </div>
              <button disabled={loading || !employeeForm.name.trim() || !employeeForm.login_name.trim() || !employeeForm.employee_code.trim() || !employeeForm.farm_id || employeeForm.pin.length < 4} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50"><Plus className="h-5 w-5" />Criar funcionário</button>
            </form>
          </section>
        </> : <section className="rounded-2xl border-2 border-border bg-card p-6 text-center"><CircleAlert className="mx-auto h-8 w-8 text-warn" /><p className="mt-3 font-bold">Nenhuma empresa operacional cadastrada.</p></section>}
      </div>

      {resetTarget ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center" role="dialog" aria-modal="true" onClick={() => !loading && setResetTarget(null)}><section className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 className="font-display text-lg font-black uppercase">Redefinir PIN</h2><p className="mt-2 text-sm text-muted-foreground">{resetTarget.name}. O PIN antigo será invalidado e não pode ser consultado.</p><input autoFocus inputMode="numeric" maxLength={6} value={resetPin} onChange={(event) => setResetPin(event.target.value.replace(/\D/g, ""))} className="mt-4 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-center text-xl font-bold tracking-[0.18em] outline-none [-webkit-text-security:disc] focus:border-primary" /><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={loading} onClick={() => setResetTarget(null)} className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase">Cancelar</button><button type="button" disabled={loading || resetPin.length < 4} onClick={() => void save("reset_employee_pin", { employee_id: resetTarget.id, pin: resetPin }, `Novo PIN salvo para ${resetTarget.name}.`).then(() => setResetTarget(null))} className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50">Salvar PIN</button></div></section></div> : null}
      {editingFarm ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center" role="dialog" aria-modal="true" onClick={() => !loading && setEditingFarm(null)}><section className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 className="font-display text-lg font-black uppercase">Editar fazenda</h2><label className="mt-4 block text-xs font-bold uppercase text-muted-foreground">Nome da fazenda<input autoFocus value={editingFarmName} onChange={(event) => setEditingFarmName(event.target.value)} className="mt-2 min-h-14 w-full rounded-xl border-2 border-border bg-surface px-4 text-base font-bold outline-none focus:border-primary" /></label><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={loading} onClick={() => setEditingFarm(null)} className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase">Cancelar</button><button type="button" disabled={loading || editingFarmName.trim().length < 2} onClick={() => void save("update_farm", { farm_id: editingFarm.id, name: editingFarmName, status: editingFarm.status }, "Fazenda atualizada.").then(() => setEditingFarm(null))} className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50">Salvar</button></div></section></div> : null}
      {editingEmployee ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/45 p-3 sm:items-center" role="dialog" aria-modal="true" onClick={() => !loading && setEditingEmployee(null)}><section className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}><h2 className="font-display text-lg font-black uppercase">Editar funcionário</h2><div className="mt-4 space-y-2"><input autoFocus value={editingEmployeeForm.name} onChange={(event) => setEditingEmployeeForm((form) => ({ ...form, name: event.target.value }))} placeholder="Nome" className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary" /><input value={editingEmployeeForm.login_name} onChange={(event) => setEditingEmployeeForm((form) => ({ ...form, login_name: event.target.value }))} placeholder="Login" className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary" /><input value={editingEmployeeForm.employee_code} onChange={(event) => setEditingEmployeeForm((form) => ({ ...form, employee_code: event.target.value }))} placeholder="Código" className="min-h-12 w-full rounded-xl border-2 border-border bg-surface px-3 font-bold outline-none focus:border-primary" /></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={loading} onClick={() => setEditingEmployee(null)} className="min-h-12 rounded-xl border-2 border-border bg-surface font-display font-black uppercase">Cancelar</button><button type="button" disabled={loading || !editingEmployeeForm.name.trim() || !editingEmployeeForm.login_name.trim() || !editingEmployeeForm.employee_code.trim()} onClick={() => void save("update_employee", { employee_id: editingEmployee.id, ...editingEmployeeForm, status: editingEmployee.status, is_admin: editingEmployee.is_admin }, "Funcionário atualizado.").then(() => setEditingEmployee(null))} className="min-h-12 rounded-xl bg-primary font-display font-black uppercase text-primary-foreground disabled:opacity-50">Salvar</button></div></section></div> : null}
    </main>
  );
}
