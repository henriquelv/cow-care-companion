import { requireSupabase } from "./supabase";

const PLATFORM_SESSION_KEY = "casco.platform_manager_session.v1";

export type PlatformClient = {
  id: string;
  name: string;
  activation_code: string;
  status: "active" | "blocked" | "expired";
  created_at: string;
};

export type PlatformFarm = {
  id: string;
  client_id: string;
  name: string;
  status: "active" | "blocked" | "expired";
  created_at: string;
};

export type PlatformEmployee = {
  id: string;
  client_id: string;
  farm_id: string;
  name: string;
  login_name: string;
  employee_code: string;
  status: "active" | "blocked";
  is_admin: boolean;
  updated_at: string;
};

export type PlatformOverview = {
  clients: PlatformClient[];
  farms: PlatformFarm[];
  employees: PlatformEmployee[];
};

export type PlatformFarmSelection = {
  client: {
    id: string;
    name: string;
    activation_code: string;
  };
  farm: {
    id: string;
    name: string;
    grace_period_days?: number | null;
  };
};

type PlatformSession = { token: string; expires_at: string };

function readSession(): PlatformSession | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(PLATFORM_SESSION_KEY) ?? "null") as PlatformSession | null;
    if (!value?.token || new Date(value.expires_at).getTime() <= Date.now()) {
      sessionStorage.removeItem(PLATFORM_SESSION_KEY);
      return null;
    }
    return value;
  } catch {
    sessionStorage.removeItem(PLATFORM_SESSION_KEY);
    return null;
  }
}

function tokenOrThrow() {
  const session = readSession();
  if (!session) throw new Error("Confirme o PIN da conta mestra para continuar.");
  return session.token;
}

export const platformAdminService = {
  isUnlocked() {
    return Boolean(readSession());
  },

  clear() {
    sessionStorage.removeItem(PLATFORM_SESSION_KEY);
  },

  async unlock(pin: string) {
    if (!/^\d{4,6}$/.test(pin)) throw new Error("Informe o PIN de 4 a 6 números.");
    const { data, error } = await requireSupabase().rpc("authenticate_hoof_manager", {
      p_password: pin,
    });
    if (error) throw new Error("Não foi possível validar a conta mestra.");
    const result = data as { ok?: boolean; message?: string; manager_token?: string; expires_at?: string } | null;
    if (!result?.ok || !result.manager_token || !result.expires_at) {
      throw new Error(result?.message || "PIN incorreto.");
    }
    sessionStorage.setItem(
      PLATFORM_SESSION_KEY,
      JSON.stringify({ token: result.manager_token, expires_at: result.expires_at }),
    );
  },

  async overview(): Promise<PlatformOverview> {
    const { data, error } = await requireSupabase().rpc("hoof_platform_overview", {
      p_manager_token: tokenOrThrow(),
    });
    if (error) throw new Error("Não foi possível carregar a administração central.");
    const result = data as ({ ok?: boolean; message?: string } & Partial<PlatformOverview>) | null;
    if (!result?.ok) {
      this.clear();
      throw new Error(result?.message || "Acesso central expirado.");
    }
    return {
      clients: result.clients ?? [],
      farms: result.farms ?? [],
      employees: result.employees ?? [],
    };
  },

  async action(action: string, payload: Record<string, unknown>) {
    const { data, error } = await requireSupabase().rpc("hoof_platform_action", {
      p_manager_token: tokenOrThrow(),
      p_action: action,
      p_payload: payload,
    });
    if (error) throw new Error("Não foi possível salvar a alteração.");
    const result = data as { ok?: boolean; message?: string; id?: string } | null;
    if (!result?.ok) throw new Error(result?.message || "Não foi possível salvar a alteração.");
    return result;
  },

  async openFarm(farmId: string): Promise<PlatformFarmSelection> {
    const { data, error } = await requireSupabase().rpc("hoof_platform_activate_farm", {
      p_manager_token: tokenOrThrow(),
      p_farm_id: farmId,
    });
    if (error) throw new Error("Não foi possível abrir esta fazenda.");
    const result = data as {
      ok?: boolean;
      message?: string;
      client?: PlatformFarmSelection["client"];
      farm?: PlatformFarmSelection["farm"];
    } | null;
    if (!result?.ok || !result.client || !result.farm) {
      throw new Error(result?.message || "Não foi possível abrir esta fazenda.");
    }
    return { client: result.client, farm: result.farm };
  },
};
