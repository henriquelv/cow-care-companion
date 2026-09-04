import { isSupabaseConfigured, requireSupabase } from "./supabase";
import { farmContextService, type FarmContext } from "./farm-context.service";

export interface RemoteClient {
  id: string;
  name: string;
  activation_code: string;
  status?: string | null;
  grace_period_days?: number | null;
  source?: "bootstrap" | "remote";
}

export interface RemoteFarm {
  id: string;
  name: string;
  client_id?: string | null;
  activation_code?: string | null;
  status?: string | null;
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
  is_platform_admin?: boolean | null;
  can_view_financial?: boolean | null;
}

interface OfflineAccessRecord {
  client: RemoteClient;
  employee: RemoteEmployee;
  farms: RemoteFarm[];
  pin_hash: string;
  session_token?: string;
  session_expires_at?: string;
  activated_farm_ids?: string[];
  cached_at: string;
}

const OFFLINE_ACCESS_KEY = "casco.offline_access.v1";

function readOfflineAccess(): OfflineAccessRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(OFFLINE_ACCESS_KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? (stored as OfflineAccessRecord[]) : [];
  } catch {
    return [];
  }
}

async function hashOfflinePin(companyCode: string, employeeId: string, pin: string) {
  const input = `${companyCode.trim().toUpperCase()}:${employeeId}:${pin}`;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function sameLogin(employee: RemoteEmployee, login: string) {
  const normalized = login.trim().toLocaleLowerCase("pt-BR");
  return [employee.login_name, employee.employee_code, employee.name].some(
    (value) => value?.trim().toLocaleLowerCase("pt-BR") === normalized,
  );
}

async function cacheOfflineAccess(
  companyCode: string,
  client: RemoteClient,
  employee: RemoteEmployee,
  farms: RemoteFarm[],
  pin: string,
  session?: { token?: string; expires_at?: string },
) {
  if (typeof localStorage === "undefined") return;
  const previous = readOfflineAccess().find(
    (item) =>
      item.client.activation_code.trim().toUpperCase() === companyCode.trim().toUpperCase() &&
      item.employee.id === employee.id,
  );
  const record: OfflineAccessRecord = {
    client,
    employee,
    farms,
    pin_hash: await hashOfflinePin(companyCode, employee.id, pin),
    session_token: session?.token,
    session_expires_at: session?.expires_at,
    activated_farm_ids: previous?.activated_farm_ids ?? [],
    cached_at: new Date().toISOString(),
  };
  const next = readOfflineAccess().filter(
    (item) =>
      !(
        item.client.activation_code.trim().toUpperCase() === companyCode.trim().toUpperCase() &&
        item.employee.id === employee.id
      ),
  );
  localStorage.setItem(OFFLINE_ACCESS_KEY, JSON.stringify([...next, record]));
}

function updateOfflineAccessRecord(
  companyCode: string,
  employeeId: string,
  update: (record: OfflineAccessRecord) => OfflineAccessRecord,
) {
  if (typeof localStorage === "undefined") return;
  const normalizedCode = companyCode.trim().toUpperCase();
  const records = readOfflineAccess();
  const next = records.map((record) =>
    record.client.activation_code.trim().toUpperCase() === normalizedCode &&
    record.employee.id === employeeId
      ? update(record)
      : record,
  );
  localStorage.setItem(OFFLINE_ACCESS_KEY, JSON.stringify(next));
}

function markOfflineFarmActivated(companyCode: string, employeeId: string, farmId: string) {
  updateOfflineAccessRecord(companyCode, employeeId, (record) => ({
    ...record,
    activated_farm_ids: Array.from(new Set([...(record.activated_farm_ids ?? []), farmId])),
  }));
}

async function updateOfflinePin(companyCode: string, employeeId: string, pin: string) {
  const pinHash = await hashOfflinePin(companyCode, employeeId, pin);
  updateOfflineAccessRecord(companyCode, employeeId, (record) => ({
    ...record,
    pin_hash: pinHash,
    cached_at: new Date().toISOString(),
  }));
}

function findOfflineAccess(companyCode: string, login: string) {
  return readOfflineAccess().find(
    (item) =>
      item.client.activation_code.trim().toUpperCase() === companyCode.trim().toUpperCase() &&
      sameLogin(item.employee, login),
  );
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
  return import("@/configuracao/tenant-bootstrap");
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
      const cached = readOfflineAccess().find(
        (item) => item.client.activation_code.trim().toUpperCase() === normalized,
      );
      if (!cached) {
        throw new Error(
          "Este aparelho ainda não tem o acesso offline desta empresa. Entre uma vez com internet.",
        );
      }
      return { client: { ...cached.client, source: "remote" } };
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
      await cacheOfflineAccess(
        normalizedCode,
        localResult.client,
        localResult.employee,
        localResult.farms,
        pin,
      );
      return localResult;
    }

    if (!canReachServer()) {
      const cached = findOfflineAccess(normalizedCode, login);
      if (!cached) {
        throw new Error(
          "Este funcionário ainda não foi liberado para uso offline neste aparelho. Entre uma vez com internet.",
        );
      }
      const pinHash = await hashOfflinePin(normalizedCode, cached.employee.id, pin);
      if (pinHash !== cached.pin_hash) throw new Error("Funcionário ou PIN inválidos.");
      if (cached.session_token) {
        farmContextService.savePendingSession({
          token: cached.session_token,
          expires_at: cached.session_expires_at,
        });
      }
      return {
        client: { ...cached.client, source: "remote" },
        employee: cached.employee,
        farms: cached.farms,
      };
    }

    const supabase = requireSupabase();
    const isMasterLogin = login.trim() === "000";
    const { data, error } = await supabase.rpc(
      isMasterLogin ? "authenticate_hoof_platform_employee" : "authenticate_hoof_employee",
      {
        p_activation_code: normalizedCode,
        p_login: login.trim(),
        p_password: pin,
      },
    );
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

    const permissionResult = await supabase.rpc("hoof_employee_permissions");
    const permissions = permissionResult.error
      ? null
      : (permissionResult.data as { can_view_financial?: boolean } | null);

    try {
      await cacheOfflineAccess(
        normalizedCode,
        { ...result.client, source: "remote" },
        {
          ...result.employee,
          can_view_financial:
            result.employee.is_platform_admin === true ||
            result.employee.employee_code === "000" ||
            permissions?.can_view_financial === true,
        },
        result.farms,
        pin,
        { token: result.session_token, expires_at: result.session_expires_at },
      );
    } catch {
      // O login online continua funcionando mesmo se o armazenamento local estiver cheio.
    }

    return {
      client: { ...result.client, source: "remote" },
      employee: {
        ...result.employee,
        can_view_financial:
          result.employee.is_platform_admin === true ||
          result.employee.employee_code === "000" ||
          permissions?.can_view_financial === true,
      },
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
    const isPlatformAdmin = employee.is_platform_admin === true || employee.employee_code === "000";
    const platformFarmMode =
      isPlatformAdmin && client?.activation_code?.trim().toUpperCase() !== "000";

    if (localActivation) {
      const localSession = farmContextService.getPendingSession();
      const cachedAccess = findOfflineAccess(
        client?.activation_code ?? "",
        employee.employee_code ?? employee.login_name ?? employee.name,
      );
      const farmAlreadyActivated =
        client?.source === "bootstrap" ||
        cachedAccess?.activated_farm_ids?.includes(farm.id) === true;
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
        is_platform_admin: isPlatformAdmin,
        platform_farm_mode: platformFarmMode,
        can_view_financial: employee.can_view_financial === true,
        device_id: deviceId,
        session_token: localSession?.token,
        session_expires_at: localSession?.expires_at,
        device_activation_pending: !farmAlreadyActivated,
        last_license_check_at: now,
        grace_period_days: farm.grace_period_days ?? 7,
      };
      farmContextService.saveContext(ctx);
      if (client?.source === "bootstrap" && client.activation_code) {
        markOfflineFarmActivated(client.activation_code, employee.id, farm.id);
      }
      return ctx;
    }

    const supabase = requireSupabase();

    const pendingSession = farmContextService.getPendingSession();
    if (!pendingSession?.token) throw new Error("Sessão de ativação inválida. Entre novamente.");

    const activationResult = await supabase.rpc(
      isPlatformAdmin ? "activate_hoof_platform_device" : "activate_hoof_device",
      {
        p_farm_id: farm.id,
        p_device_name:
          typeof navigator === "undefined" ? "Navegador" : navigator.userAgent.slice(0, 120),
      },
    );
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
      is_platform_admin: isPlatformAdmin,
      platform_farm_mode: platformFarmMode,
      can_view_financial: employee.can_view_financial === true,
      device_id: deviceId,
      session_token: pendingSession.token,
      session_expires_at: pendingSession.expires_at,
      device_activation_pending: false,
      last_license_check_at: now,
      grace_period_days: farm.grace_period_days ?? 7,
      trial_started_at: activation.license_expires_at
        ? (activation.license_starts_at ?? now)
        : undefined,
      trial_expires_at: activation.license_expires_at ?? undefined,
    };
    farmContextService.saveContext(ctx);
    if (client?.activation_code) {
      markOfflineFarmActivated(client.activation_code, employee.id, farm.id);
    }
    return ctx;
  },

  cachedFarmsForCurrentEmployee(): RemoteFarm[] {
    const context = farmContextService.getContext();
    if (!context) return [];
    const cached = readOfflineAccess().find(
      (record) =>
        record.client.activation_code.trim().toUpperCase() ===
          context.client_code?.trim().toUpperCase() && record.employee.id === context.employee_id,
    );
    if (cached?.farms.length) return cached.farms.filter((farm) => farm.status !== "blocked");
    return [
      {
        id: context.farm_id,
        name: context.farm_name,
        client_id: context.client_id,
        status: "active",
        grace_period_days: context.grace_period_days,
      },
    ];
  },

  rememberFarmForOffline(companyCode: string, employeeId: string, farm: RemoteFarm) {
    updateOfflineAccessRecord(companyCode, employeeId, (record) => ({
      ...record,
      farms: [...record.farms.filter((item) => item.id !== farm.id), farm],
      cached_at: new Date().toISOString(),
    }));
  },

  async switchFarm(farmId: string): Promise<FarmContext> {
    const context = farmContextService.getContext();
    if (!context?.client_code) throw new Error("Acesso da empresa não encontrado neste aparelho.");
    const cached = readOfflineAccess().find(
      (record) =>
        record.client.activation_code.trim().toUpperCase() ===
          context.client_code?.trim().toUpperCase() && record.employee.id === context.employee_id,
    );
    const farm = cached?.farms.find((item) => item.id === farmId && item.status !== "blocked");
    if (!cached || !farm) {
      throw new Error("Esta fazenda ainda não está disponível offline neste aparelho.");
    }
    if (farm.id === context.farm_id) return context;

    if (canReachServer()) {
      if (context.session_token) {
        farmContextService.savePendingSession({
          token: context.session_token,
          expires_at: context.session_expires_at,
        });
      }
      return this.activate(farm, cached.employee, cached.client);
    }

    return (
      farmContextService.updateContext({
        farm_id: farm.id,
        farm_name: farm.name,
        grace_period_days: farm.grace_period_days ?? context.grace_period_days,
        device_activation_pending: !cached.activated_farm_ids?.includes(farm.id),
        platform_farm_mode: false,
      }) ?? context
    );
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
      await updateOfflinePin(context.client_code, context.employee_id, newPin);
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
    await updateOfflinePin(context.client_code, context.employee_id, newPin);
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
    if (ctx.device_activation_pending) {
      const activationResult = await supabase.rpc(
        ctx.is_platform_admin ? "activate_hoof_platform_device" : "activate_hoof_device",
        {
          p_farm_id: ctx.farm_id,
          p_device_name:
            typeof navigator === "undefined" ? "Navegador" : navigator.userAgent.slice(0, 120),
        },
      );
      const activation = activationResult.data as { ok?: boolean; message?: string } | null;
      if (activationResult.error || !activation?.ok) {
        return {
          ok: false,
          message: activation?.message || "Entre novamente para liberar esta fazenda no aparelho.",
        };
      }
      farmContextService.updateContext({
        device_activation_pending: false,
        last_license_check_at: new Date().toISOString(),
      });
      if (ctx.client_code) markOfflineFarmActivated(ctx.client_code, ctx.employee_id, ctx.farm_id);
    }
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
      const permissionResult = await supabase.rpc("hoof_employee_permissions");
      const permissions = permissionResult.error
        ? null
        : (permissionResult.data as { can_view_financial?: boolean } | null);
      farmContextService.updateContext({
        farm_name: session.farm?.name ?? ctx.farm_name,
        employee_name: session.employee?.name ?? ctx.employee_name,
        employee_code: session.employee?.employee_code ?? ctx.employee_code,
        employee_login: session.employee?.login_name ?? ctx.employee_login,
        is_admin: session.employee?.is_admin === true,
        is_platform_admin: ctx.is_platform_admin === true,
        can_view_financial:
          ctx.is_platform_admin === true
            ? true
            : permissions?.can_view_financial === undefined
              ? ctx.can_view_financial
              : permissions.can_view_financial === true,
        session_expires_at: ctx.session_expires_at,
        last_license_check_at: new Date().toISOString(),
        trial_started_at: session.license_expires_at ? ctx.trial_started_at : undefined,
        trial_expires_at: session.license_expires_at ?? undefined,
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
