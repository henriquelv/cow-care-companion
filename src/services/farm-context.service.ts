export interface FarmContext {
  client_id?: string;
  client_name?: string;
  client_code?: string;
  farm_id: string;
  farm_name: string;
  employee_id: string;
  employee_name: string;
  device_id: string;
  last_license_check_at: string;
  grace_period_days: number;
  trial_started_at?: string;
  trial_expires_at?: string;
  admin_pin?: string;
}

export const TRIAL_DAYS = 15;

const CONTEXT_KEY = "casco.farm_context.v2";
const DEVICE_KEY = "casco.device_id.v1";

function createDeviceId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const farmContextService = {
  getDeviceId(): string {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = createDeviceId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  },

  getContext(): FarmContext | null {
    if (typeof window === "undefined") return null;
    return readJson<FarmContext>(CONTEXT_KEY);
  },

  isActivated(): boolean {
    const ctx = this.getContext();
    return Boolean(ctx?.farm_id && ctx.employee_id && ctx.device_id);
  },

  saveContext(ctx: FarmContext) {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
  },

  updateContext(patch: Partial<FarmContext>) {
    const current = this.getContext();
    if (!current) return null;
    const next = { ...current, ...patch };
    this.saveContext(next);
    return next;
  },

  ensureTrial() {
    const current = this.getContext();
    if (!current) return null;
    if (current.trial_started_at && current.trial_expires_at) return current;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt);
    expiresAt.setDate(expiresAt.getDate() + TRIAL_DAYS);
    return this.updateContext({
      trial_started_at: startedAt.toISOString(),
      trial_expires_at: expiresAt.toISOString(),
    });
  },

  getTrialStatus() {
    const context = this.getContext();
    if (!context?.trial_expires_at) return null;
    const expiresAt = new Date(context.trial_expires_at);
    const remainingMs = expiresAt.getTime() - Date.now();
    return {
      expiresAt: context.trial_expires_at,
      daysRemaining: Math.max(0, Math.ceil(remainingMs / 86400000)),
      expired: remainingMs <= 0,
    };
  },

  clearContext() {
    localStorage.removeItem(CONTEXT_KEY);
  },

  getFarmId(): string | null {
    return this.getContext()?.farm_id ?? null;
  },

  getEmployeeName(): string {
    return this.getContext()?.employee_name ?? "";
  },
};
