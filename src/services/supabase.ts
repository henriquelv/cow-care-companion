import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function hasRealSupabaseConfig(url?: string, anonKey?: string) {
  const cleanUrl = url?.trim() ?? "";
  const cleanKey = anonKey?.trim() ?? "";
  if (!cleanUrl || !cleanKey) return false;
  if (cleanUrl.includes("seu-projeto.supabase.co")) return false;
  if (cleanKey === "sua-chave-anon-publica") return false;
  return cleanUrl.startsWith("https://") && cleanKey.length > 30;
}

const forceLocalDevelopment = import.meta.env.DEV && import.meta.env.VITE_FORCE_LOCAL === "true";

export const isSupabaseConfigured =
  !forceLocalDevelopment && hasRealSupabaseConfig(supabaseUrl, supabaseAnonKey);

const CONTEXT_KEY = "casco.farm_context.v2";
const DEVICE_KEY = "casco.device_id.v1";
const PENDING_SESSION_KEY = "casco.employee_session.pending.v1";

function readSessionToken() {
  if (typeof localStorage === "undefined") return null;
  try {
    const context = JSON.parse(localStorage.getItem(CONTEXT_KEY) ?? "null") as {
      session_token?: string;
    } | null;
    if (context?.session_token) return context.session_token;
    const pending = JSON.parse(localStorage.getItem(PENDING_SESSION_KEY) ?? "null") as {
      token?: string;
    } | null;
    return pending?.token ?? null;
  } catch {
    return null;
  }
}

function readDeviceId() {
  if (typeof localStorage === "undefined") return null;
  let deviceId = localStorage.getItem(DEVICE_KEY);
  if (!deviceId) {
    deviceId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, deviceId);
  }
  return deviceId;
}

async function sessionFetch(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  const sessionToken = readSessionToken();
  const deviceId = readDeviceId();
  if (sessionToken) headers.set("x-hoof-session", sessionToken);
  if (deviceId) headers.set("x-hoof-device-id", deviceId);
  return fetch(input, { ...init, headers });
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: { fetch: sessionFetch },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}
