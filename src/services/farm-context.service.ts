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
  admin_pin?: string;
}

const CONTEXT_KEY = "casco.farm_context.v1";
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
