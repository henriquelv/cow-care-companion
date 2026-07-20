import { authenticateBootstrapEmployee, findBootstrapClient } from "@/config/tenant-bootstrap";
import { isSupabaseConfigured, requireSupabase } from "./supabase";
import { farmContextService, TRIAL_DAYS, type FarmContext } from "./farm-context.service";

export interface RemoteClient {
  id: string;
  name: string;
  activation_code: string;
  status?: string | null;
  max_devices?: number | null;
  grace_period_days?: number | null;
  source?: "bootstrap" | "remote";
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
  client_id?: string | null;
  employee_code?: string | null;
  login_name?: string | null;
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
      url.searchParams.get("empresa") ??
      url.searchParams.get("client") ??
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

function canReachServer() {
  return isSupabaseConfigured && (typeof navigator === "undefined" || navigator.onLine !== false);
}

function localClientOrThrow(code: string) {
  const client = findBootstrapClient(code);
  if (!client) throw new Error("Link ou código da empresa inválido.");
  return client;
}

export const activationService = {
  async validateActivationCode(code: string): Promise<{ client: RemoteClient }> {
    const normalized = normalizeActivationInput(code);
    if (!normalized) throw new Error("Informe o link ou código da empresa.");

    if (!canReachServer()) {
      return { client: localClientOrThrow(normalized) };
    }

    const supabase = requireSupabase();
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("activation_code", normalized)
      .maybeSingle();

    if (clientError) {
      const bootstrapClient = findBootstrapClient(normalized);
      if (bootstrapClient) return { client: bootstrapClient };
      throw clientError;
    }
    if (!client) throw new Error("Link ou código da empresa inválido.");
    if (client.status && client.status !== "active") {
      throw new Error("Empresa bloqueada ou inativa.");
    }
    return { client: { ...(client as RemoteClient), source: "remote" } };
  },

  async authenticateEmployee(
    companyCode: string,
    login: string,
    password: string,
  ): Promise<{ client: RemoteClient; employee: RemoteEmployee; farms: RemoteFarm[] }> {
    const normalizedCode = normalizeActivationInput(companyCode);
    if (!normalizedCode || !login.trim() || !password) {
      throw new Error("Informe o funcionário e a senha.");
    }

    if (!canReachServer()) {
      const localResult = authenticateBootstrapEmployee(normalizedCode, login, password);
      if (!localResult) throw new Error("Funcionário ou senha inválidos.");
      return localResult;
    }

    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc("authenticate_hoof_employee", {
      p_activation_code: normalizedCode,
      p_login: login.trim(),
      p_password: password,
    });
    if (error) {
      const localResult = authenticateBootstrapEmployee(normalizedCode, login, password);
      if (localResult) return localResult;
      throw error;
    }
    if (!data) throw new Error("Funcionário ou senha inválidos.");

    const result = data as {
      client?: RemoteClient;
      employee?: RemoteEmployee;
      farms?: RemoteFarm[];
    };
    if (!result.client || !result.employee) {
      throw new Error("Não foi possível validar este funcionário.");
    }
    if (!result.farms?.length) {
      throw new Error("Este funcionário não possui fazenda ativa vinculada.");
    }

    return {
      client: { ...result.client, source: "remote" },
      employee: result.employee,
      farms: result.farms,
    };
  },

  async activate(
    farm: RemoteFarm,
    employee: RemoteEmployee,
    client?: RemoteClient,
  ): Promise<FarmContext> {
    const deviceId = farmContextService.getDeviceId();
    const now = new Date().toISOString();
    const localActivation = client?.source === "bootstrap" || !canReachServer();

    if (localActivation) {
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);
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
        trial_started_at: now,
        trial_expires_at: expiresAt.toISOString(),
        admin_pin: employee.admin_pin ?? undefined,
      };
      farmContextService.saveContext(ctx);
      return ctx;
    }

    const supabase = requireSupabase();

    const { data: licenses, error: licenseError } = await supabase
      .from("licenses")
      .select("starts_at,expires_at")
      .eq("farm_id", farm.id)
      .eq("status", "active")
      .order("expires_at", { ascending: false, nullsFirst: true })
      .limit(1);
    if (licenseError) throw licenseError;
    const license = licenses?.[0];

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
      trial_started_at: license?.expires_at ? (license.starts_at ?? now) : undefined,
      trial_expires_at: license?.expires_at ?? undefined,
      admin_pin: employee.admin_pin ?? undefined,
    };
    farmContextService.saveContext(ctx);
    return ctx;
  },

  async validateCurrentAccess(): Promise<{ ok: boolean; message?: string; offline?: boolean }> {
    const ctx = farmContextService.getContext();
    if (!ctx) return { ok: false, message: "Aplicativo não ativado." };
    if (!canReachServer()) return { ok: true, offline: true };

    const supabase = requireSupabase();
    const [farmResult, employeeResult, assignmentResult, deviceResult, licensesResult] =
      await Promise.all([
        supabase.from("farms").select("*").eq("id", ctx.farm_id).maybeSingle(),
        supabase.from("employees").select("*").eq("id", ctx.employee_id).maybeSingle(),
        supabase
          .from("employee_farms")
          .select("farm_id")
          .eq("employee_id", ctx.employee_id)
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
    if (assignmentResult.error) throw assignmentResult.error;
    if (deviceResult.error) throw deviceResult.error;
    if (licensesResult.error) throw licensesResult.error;
    if (!farmResult.data || farmResult.data.status !== "active")
      return { ok: false, message: "Fazenda bloqueada." };
    if (!employeeResult.data || employeeResult.data.status === "blocked") {
      return { ok: false, message: "Funcionário bloqueado." };
    }
    if (
      employeeResult.data.client_id &&
      farmResult.data?.client_id &&
      employeeResult.data.client_id !== farmResult.data.client_id
    ) {
      return { ok: false, message: "Funcionário não pertence a esta empresa." };
    }
    if (!assignmentResult.data) {
      return { ok: false, message: "Funcionário sem acesso a esta fazenda." };
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
