import { requireSupabase } from "./supabase";

const MANAGER_SESSION_KEY = "casco.manager_session.v1";

export interface AdminFarm {
  id: string;
  name: string;
  status: "active" | "blocked" | "expired";
  max_devices: number;
  grace_period_days: number;
  created_at: string;
}

export interface AdminEmployee {
  id: string;
  name: string;
  login_name: string;
  employee_code: string;
  status: "active" | "blocked";
  is_admin: boolean;
  farm_ids: string[];
  created_at: string;
}

export interface AdminDevice {
  id: string;
  farm_id: string;
  employee_id?: string | null;
  device_name?: string | null;
  status: "active" | "blocked";
  last_seen_at?: string | null;
  created_at: string;
}

export interface AdminLicense {
  id: string;
  farm_id: string;
  status: "active" | "blocked" | "expired";
  starts_at?: string | null;
  expires_at?: string | null;
  updated_at: string;
}

export interface AdminAuditEntry {
  id: number;
  employee_id?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface AdminOverview {
  farms: AdminFarm[];
  employees: AdminEmployee[];
  devices: AdminDevice[];
  licenses: AdminLicense[];
  audit: AdminAuditEntry[];
}

interface ManagerSession {
  token: string;
  expires_at: string;
}

function readManagerSession(): ManagerSession | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const session = JSON.parse(
      sessionStorage.getItem(MANAGER_SESSION_KEY) ?? "null",
    ) as ManagerSession | null;
    if (!session?.token || new Date(session.expires_at).getTime() <= Date.now()) {
      sessionStorage.removeItem(MANAGER_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(MANAGER_SESSION_KEY);
    return null;
  }
}

function managerTokenOrThrow() {
  const session = readManagerSession();
  if (!session) throw new Error("Acesso gerente expirado. Informe seu PIN novamente.");
  return session.token;
}

function rpcUnavailable(error: { code?: string | null } | null) {
  return error?.code === "PGRST202";
}

export const adminService = {
  isUnlocked() {
    return Boolean(readManagerSession());
  },

  clear() {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(MANAGER_SESSION_KEY);
  },

  async unlock(pin: string) {
    if (!/^\d{4,6}$/.test(pin)) throw new Error("Informe seu PIN de 4 a 6 números.");
    const { data, error } = await requireSupabase().rpc("authenticate_hoof_manager", {
      p_password: pin,
    });
    if (error) {
      if (rpcUnavailable(error)) throw new Error("A atualização do painel ainda não foi aplicada.");
      throw new Error("Não foi possível validar o acesso gerente.");
    }
    const result = data as {
      ok?: boolean;
      message?: string;
      manager_token?: string;
      expires_at?: string;
    } | null;
    if (!result?.ok || !result.manager_token || !result.expires_at) {
      throw new Error(result?.message || "PIN incorreto.");
    }
    sessionStorage.setItem(
      MANAGER_SESSION_KEY,
      JSON.stringify({ token: result.manager_token, expires_at: result.expires_at }),
    );
  },

  async overview(): Promise<AdminOverview> {
    const { data, error } = await requireSupabase().rpc("hoof_admin_overview", {
      p_manager_token: managerTokenOrThrow(),
    });
    if (error) throw new Error("Não foi possível carregar a administração.");
    const result = data as ({ ok?: boolean; message?: string } & Partial<AdminOverview>) | null;
    if (!result?.ok) {
      this.clear();
      throw new Error(result?.message || "Acesso gerente expirado.");
    }
    return {
      farms: result.farms ?? [],
      employees: result.employees ?? [],
      devices: result.devices ?? [],
      licenses: result.licenses ?? [],
      audit: result.audit ?? [],
    };
  },

  async action(action: string, payload: Record<string, unknown>) {
    const { data, error } = await requireSupabase().rpc("hoof_admin_action", {
      p_manager_token: managerTokenOrThrow(),
      p_action: action,
      p_payload: payload,
    });
    if (error) throw new Error("Não foi possível concluir esta ação.");
    const result = data as { ok?: boolean; message?: string; id?: string } | null;
    if (!result?.ok) {
      if (result?.message?.includes("expirado")) this.clear();
      throw new Error(result?.message || "Não foi possível concluir esta ação.");
    }
    return result;
  },
};
