import { requireSupabase } from "./supabase";
import { farmContextService, type FarmContext } from "./farm-context.service";

export interface RemoteClient {
  id: string;
  name: string;
  activation_code: string;
  status?: string | null;
  max_devices?: number | null;
  grace_period_days?: number | null;
}

export interface RemoteFarm {
  id: string;
  name: string;
  client_id?: string | null;
  activation_code?: string | null;
  status?: string | null;
  max_devices?: number | null;
  grace_period_days?: number | null;
}

export interface RemoteEmployee {
  id: string;
  farm_id: string;
  name: string;
  status?: string | null;
  is_admin?: boolean | null;
  admin_pin?: string | null;
}

function normalizeActivationInput(input: string) {
  const raw = input.trim();
  if (!raw) return "";

  try {
    const url = new URL(raw);
    const fromQuery =
      url.searchParams.get("codigo") ??
      url.searchParams.get("code") ??
      url.searchParams.get("fazenda") ??
      url.searchParams.get("farm");
    if (fromQuery) return fromQuery.trim().toUpperCase();

    const pathCode = url.pathname
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean)
      .pop();
    if (pathCode) return pathCode.toUpperCase();
  } catch {
    // Entrada pode ser apenas o código curto da fazenda.
  }

  return raw
    .replace(/^.*[/?#=]/, "")
    .trim()
    .toUpperCase();
}

export const activationService = {
  async validateActivationCode(code: string): Promise<{
    client: RemoteClient;
    farms: RemoteFarm[];
    legacyFarm?: RemoteFarm;
    employees?: RemoteEmployee[];
  }> {
    const normalized = normalizeActivationInput(code);
    if (!normalized) throw new Error("Informe o link ou código da fazenda.");

    const supabase = requireSupabase();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("activation_code", normalized)
      .maybeSingle();

    if (clientError && clientError.code !== "42P01") throw clientError;
    if (client) {
      if (client.status && client.status !== "active") {
        throw new Error("Cliente bloqueado ou inativo.");
      }

      const { data: farms, error: farmsError } = await supabase
        .from("farms")
        .select("*")
        .eq("client_id", client.id)
        .or("status.is.null,status.eq.active")
        .order("name", { ascending: true });
      if (farmsError) throw farmsError;

      return {
        client: client as RemoteClient,
        farms: (farms ?? []) as RemoteFarm[],
      };
    }

    const { data: farm, error } = await supabase
      .from("farms")
      .select("*")
      .eq("activation_code", normalized)
      .maybeSingle();

    if (error) throw error;
    if (!farm) throw new Error("Link ou código da fazenda inválido.");
    if (farm.status && farm.status !== "active") {
      throw new Error("Fazenda bloqueada ou inativa.");
    }

    const { data: licenses, error: licenseError } = await supabase
      .from("licenses")
      .select("*")
      .eq("farm_id", farm.id);
    if (licenseError) throw licenseError;
    const activeLicense = (licenses ?? []).some((license) => {
      if (license.status && license.status !== "active") return false;
      if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return false;
      return true;
    });
    if (!activeLicense) throw new Error("Licença da fazenda expirada ou bloqueada.");

    const { data: employees, error: employeesError } = await supabase
      .from("employees")
      .select("*")
      .eq("farm_id", farm.id)
      .or("status.is.null,status.eq.active")
      .order("name", { ascending: true });
    if (employeesError) throw employeesError;
    if (!employees?.length) throw new Error("Nenhum funcionário ativo encontrado.");

    return {
      client: {
        id: String(farm.client_id ?? farm.id),
        name: farm.name,
        activation_code: normalized,
        status: farm.status,
        max_devices: farm.max_devices,
        grace_period_days: farm.grace_period_days,
      },
      farms: [farm as RemoteFarm],
      legacyFarm: farm as RemoteFarm,
      employees: employees as RemoteEmployee[],
    };
  },

  async createFarmForClient(client: RemoteClient, name: string): Promise<RemoteFarm> {
    const normalizedName = name.trim();
    if (!normalizedName) throw new Error("Informe o nome da fazenda.");

    const supabase = requireSupabase();
    const { data: farm, error } = await supabase
      .from("farms")
      .insert({
        client_id: client.id,
        name: normalizedName,
        status: "active",
        max_devices: client.max_devices ?? 10,
        grace_period_days: client.grace_period_days ?? 7,
      })
      .select("*")
      .single();
    if (error) throw error;

    await supabase.from("licenses").insert({
      farm_id: farm.id,
      status: "active",
    });

    const { data: existingEmployees } = await supabase
      .from("employees")
      .select("*")
      .eq("farm_id", farm.id)
      .limit(1);

    if (!existingEmployees?.length) {
      await supabase.from("employees").insert({
        farm_id: farm.id,
        name: "Teste",
        status: "active",
      });
    }

    return farm as RemoteFarm;
  },

  async listEmployees(farmId: string): Promise<RemoteEmployee[]> {
    const supabase = requireSupabase();
    const { data: employees, error } = await supabase
      .from("employees")
      .select("*")
      .eq("farm_id", farmId)
      .or("status.is.null,status.eq.active")
      .order("name", { ascending: true });
    if (error) throw error;
    return (employees ?? []) as RemoteEmployee[];
  },

  async activate(
    farm: RemoteFarm,
    employee: RemoteEmployee,
    client?: RemoteClient,
  ): Promise<FarmContext> {
    const supabase = requireSupabase();
    const deviceId = farmContextService.getDeviceId();
    const now = new Date().toISOString();

    const { error: deviceError } = await supabase.from("devices").upsert(
      {
        farm_id: farm.id,
        employee_id: employee.id,
        device_id: deviceId,
        device_name: navigator.userAgent.slice(0, 120),
        status: "active",
        last_seen_at: now,
      },
      { onConflict: "farm_id,device_id" },
    );
    if (deviceError) throw deviceError;

    const ctx: FarmContext = {
      client_id: client?.id ?? farm.client_id ?? undefined,
      client_name: client?.name,
      client_code: client?.activation_code,
      farm_id: farm.id,
      farm_name: farm.name,
      employee_id: String(employee.id),
      employee_name: employee.name,
      device_id: deviceId,
      last_license_check_at: now,
      grace_period_days: farm.grace_period_days ?? 7,
      admin_pin: employee.admin_pin ?? undefined,
    };
    farmContextService.saveContext(ctx);
    return ctx;
  },

  async validateCurrentAccess(): Promise<{ ok: boolean; message?: string; offline?: boolean }> {
    const ctx = farmContextService.getContext();
    if (!ctx) return { ok: false, message: "Aplicativo não ativado." };
    if (!navigator.onLine) return { ok: true, offline: true };

    const supabase = requireSupabase();
    const [farmResult, employeeResult, deviceResult, licensesResult] = await Promise.all([
      supabase.from("farms").select("*").eq("id", ctx.farm_id).maybeSingle(),
      supabase
        .from("employees")
        .select("*")
        .eq("id", ctx.employee_id)
        .eq("farm_id", ctx.farm_id)
        .maybeSingle(),
      supabase
        .from("devices")
        .select("*")
        .eq("farm_id", ctx.farm_id)
        .eq("device_id", ctx.device_id)
        .maybeSingle(),
      supabase.from("licenses").select("*").eq("farm_id", ctx.farm_id),
    ]);

    if (farmResult.error) throw farmResult.error;
    if (employeeResult.error) throw employeeResult.error;
    if (deviceResult.error) throw deviceResult.error;
    if (licensesResult.error) throw licensesResult.error;
    if (!farmResult.data || farmResult.data.status !== "active")
      return { ok: false, message: "Fazenda bloqueada." };
    if (!employeeResult.data || employeeResult.data.status === "blocked") {
      return { ok: false, message: "Funcionário bloqueado." };
    }
    if (!deviceResult.data || deviceResult.data.status === "blocked") {
      return { ok: false, message: "Aparelho bloqueado." };
    }

    const activeLicense = (licensesResult.data ?? []).some((license) => {
      if (license.status && license.status !== "active") return false;
      if (license.expires_at && new Date(license.expires_at).getTime() < Date.now()) return false;
      return true;
    });
    if (!activeLicense) return { ok: false, message: "Licença expirada ou bloqueada." };

    farmContextService.updateContext({
      client_id: farmResult.data.client_id ?? ctx.client_id,
      farm_name: farmResult.data.name,
      employee_name: employeeResult.data.name,
      admin_pin: employeeResult.data.admin_pin ?? ctx.admin_pin,
      last_license_check_at: new Date().toISOString(),
      grace_period_days: farmResult.data.grace_period_days ?? ctx.grace_period_days,
    });
    return { ok: true };
  },
};
