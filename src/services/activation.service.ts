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

function isMissingRpc(error: { code?: string | null; message?: string | null } | null) {
  return Boolean(
    error &&
    (error.code === "PGRST202" ||
      error.message?.includes("Could not find the function") ||
      error.message?.includes("schema cache")),
  );
}

async function developmentBootstrap() {
  if (!import.meta.env.DEV) {
    throw new Error("Servidor não configurado para este ambiente.");
  }
  return import("@/config/tenant-bootstrap");
}

async function localClientOrThrow(code: string) {
  const { findBootstrapClient } = await developmentBootstrap();
  const client = findBootstrapClient(code);
  if (!client) throw new Error("Link ou código da empresa inválido.");
  return client;
}

export const activationService = {
  async validateActivationCode(code: string): Promise<{ client: RemoteClient }> {
    const normalized = normalizeActivationInput(code);
    if (!normalized) throw new Error("Informe o link ou código da empresa.");

    if (!isSupabaseConfigured) {
      return { client: await localClientOrThrow(normalized) };
    }

    if (!canReachServer()) {
      throw new Error("Conecte este aparelho à internet para fazer o primeiro acesso.");
    }

    const supabase = requireSupabase();
    const rpcResult = await supabase.rpc("resolve_hoof_client", {
      p_activation_code: normalized,
    });

    if (isMissingRpc(rpcResult.error)) {
      throw new Error("O servidor precisa da atualização de segurança antes deste acesso.");
    }
    if (rpcResult.error) {
      throw new Error("Não foi possível consultar a empresa. Tente novamente.");
    }
    const client = rpcResult.data as RemoteClient | null;
    if (!client) throw new Error("Link ou código da empresa inválido.");
    if (client.status && client.status !== "active") {
      throw new Error("Empresa bloqueada ou inativa.");
    }
    return { client: { ...(client as RemoteClient), source: "remote" } };
  },

  async authenticateEmployee(
    companyCode: string,
    login: string,
    pin: string,
  ): Promise<{ client: RemoteClient; employee: RemoteEmployee; farms: RemoteFarm[] }> {
    const normalizedCode = normalizeActivationInput(companyCode);
    if (!normalizedCode || !login.trim() || !pin) {
      throw new Error("Informe o funcionário e o PIN.");
    }

    if (!isSupabaseConfigured) {
      const { authenticateBootstrapEmployee } = await developmentBootstrap();
      const localResult = authenticateBootstrapEmployee(normalizedCode, login, pin);
      if (!localResult) throw new Error("Funcionário ou PIN inválidos.");
      return localResult;
    }

    if (!canReachServer()) {
      throw new Error("Conecte este aparelho à internet para fazer o primeiro acesso.");
    }

    const supabase = requireSupabase();
    const { data, error } = await supabase.rpc("authenticate_hoof_employee", {
      p_activation_code: normalizedCode,
      p_login: login.trim(),
      p_password: pin,
    });
    if (error) throw new Error("Não foi possível validar o acesso. Tente novamente.");
    if (!data) throw new Error("Funcionário ou PIN inválidos.");

    const result = data as {
      client?: RemoteClient;
      employee?: RemoteEmployee;
      farms?: RemoteFarm[];
      error?: string;
      message?: string;
      session_token?: string;
      session_expires_at?: string;
    };
    if (result.error) throw new Error(result.message || "Não foi possível validar o acesso.");
    if (!result.client || !result.employee) {
      throw new Error("Não foi possível validar este funcionário.");
    }
    if (!result.farms?.length) {
      throw new Error("Este funcionário não possui fazenda ativa vinculada.");
    }

    if (!result.session_token) {
      throw new Error("O servidor precisa da atualização de segurança antes deste acesso.");
    }

    farmContextService.savePendingSession({
      token: result.session_token,
      expires_at: result.session_expires_at,
    });

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
        employee_code: employee.employee_code ?? undefined,
        employee_login: employee.login_name ?? undefined,
        is_admin: employee.is_admin === true,
        device_id: deviceId,
        last_license_check_at: now,
        grace_period_days: farm.grace_period_days ?? 7,
        trial_started_at: now,
        trial_expires_at: expiresAt.toISOString(),
      };
      farmContextService.saveContext(ctx);
      return ctx;
    }

    const supabase = requireSupabase();

    const pendingSession = farmContextService.getPendingSession();
    if (!pendingSession?.token) throw new Error("Sessão de ativação inválida. Entre novamente.");

    const activationResult = await supabase.rpc("activate_hoof_device", {
      p_farm_id: farm.id,
      p_device_name:
        typeof navigator === "undefined" ? "Navegador" : navigator.userAgent.slice(0, 120),
    });
    if (activationResult.error) {
      if (isMissingRpc(activationResult.error)) {
        throw new Error("O servidor precisa da atualização de segurança antes deste acesso.");
      }
      throw new Error("Não foi possível ativar este aparelho. Tente novamente.");
    }
    const activation = activationResult.data as {
      ok?: boolean;
      message?: string;
      license_starts_at?: string | null;
      license_expires_at?: string | null;
    } | null;
    if (!activation?.ok) {
      throw new Error(activation?.message || "Não foi possível ativar este aparelho.");
    }

    const ctx: FarmContext = {
      client_id: client?.id ?? farm.client_id ?? undefined,
      client_name: client?.name,
      client_code: client?.activation_code,
      farm_id: farm.id,
      farm_name: farm.name,
      employee_id: String(employee.id),
      employee_name: employee.name,
      employee_code: employee.employee_code ?? undefined,
      employee_login: employee.login_name ?? undefined,
      is_admin: employee.is_admin === true,
      device_id: deviceId,
      session_token: pendingSession.token,
      session_expires_at: pendingSession.expires_at,
      last_license_check_at: now,
      grace_period_days: farm.grace_period_days ?? 7,
      trial_started_at: activation.license_expires_at
        ? (activation.license_starts_at ?? now)
        : undefined,
      trial_expires_at: activation.license_expires_at ?? undefined,
    };
    farmContextService.saveContext(ctx);
    return ctx;
  },

  async changeEmployeePin(currentPin: string, newPin: string) {
    const context = farmContextService.getContext();
    if (!context?.client_id || !context.client_code || !context.employee_id) {
      throw new Error("Identificação do funcionário incompleta neste aparelho.");
    }
    if (!/^\d{4,6}$/.test(currentPin) || !/^\d{4,6}$/.test(newPin)) {
      throw new Error("O PIN deve ter de 4 a 6 números.");
    }
    if (currentPin === newPin) {
      throw new Error("Escolha um PIN diferente do atual.");
    }

    if (!isSupabaseConfigured) {
      const { changeBootstrapEmployeePin } = await developmentBootstrap();
      const changed = changeBootstrapEmployeePin(
        context.client_code,
        context.employee_id,
        currentPin,
        newPin,
      );
      if (!changed) throw new Error("PIN atual incorreto.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error("Conecte este aparelho à internet para alterar o PIN.");
    }

    const supabase = requireSupabase();
    const rpcResult = await supabase.rpc("change_hoof_employee_pin", {
      p_employee_id: context.employee_id,
      p_current_pin: currentPin,
      p_new_pin: newPin,
    });

    if (rpcResult.error) throw new Error("Não foi possível conectar ao serviço de PIN.");
    const result = rpcResult.data as { ok?: boolean; message?: string } | null;
    const changed = result?.ok === true;
    const message = result?.message ?? "";

    if (!changed) throw new Error(message || "Não foi possível alterar o PIN.");
  },

  async validateCurrentAccess(): Promise<{ ok: boolean; message?: string; offline?: boolean }> {
    const ctx = farmContextService.getContext();
    if (!ctx) return { ok: false, message: "Aplicativo não ativado." };
    if (!canReachServer()) {
      const offlineAccess = farmContextService.getOfflineAccessStatus();
      return offlineAccess.allowed
        ? { ok: true, offline: true }
        : { ok: false, message: offlineAccess.message };
    }

    const supabase = requireSupabase();
    const sessionResult = await supabase.rpc("validate_hoof_access", {
      p_farm_id: ctx.farm_id,
    });
    if (!sessionResult.error) {
      const session = sessionResult.data as {
        ok?: boolean;
        message?: string;
        employee?: RemoteEmployee;
        farm?: RemoteFarm;
        license_expires_at?: string | null;
      } | null;
      if (!session?.ok) {
        return { ok: false, message: session?.message || "Sessão expirada. Entre novamente." };
      }
      farmContextService.updateContext({
        farm_name: session.farm?.name ?? ctx.farm_name,
        employee_name: session.employee?.name ?? ctx.employee_name,
        employee_code: session.employee?.employee_code ?? ctx.employee_code,
        employee_login: session.employee?.login_name ?? ctx.employee_login,
        is_admin: session.employee?.is_admin === true,
        session_expires_at: ctx.session_expires_at,
        last_license_check_at: new Date().toISOString(),
        trial_expires_at: session.license_expires_at ?? ctx.trial_expires_at,
      });
      return { ok: true };
    }
    if (isMissingRpc(sessionResult.error)) {
      return {
        ok: false,
        message: "O servidor precisa da atualização de segurança antes deste acesso.",
      };
    }
    throw new Error("Não foi possível validar a sessão deste aparelho.");
  },
};
