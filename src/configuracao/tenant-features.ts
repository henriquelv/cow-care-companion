import type { FarmContext } from "@/servicos/farm-context.service";

export interface TenantFeatures {
  hoofMap: boolean;
  pricing: boolean;
  financial: boolean;
  limpingRequests: boolean;
  workSessions: boolean;
  reportTitle: string;
}

export type TenantFeatureOverrides = Partial<Omit<TenantFeatures, "reportTitle">> & {
  reportTitle?: string;
};

const DEFAULT_FEATURES: TenantFeatures = {
  hoofMap: false,
  pricing: false,
  financial: false,
  limpingRequests: false,
  workSessions: false,
  reportTitle: "Gestão de Cascos",
};

const CLIENT_FEATURES: Record<string, TenantFeatures> = {
  HULLSJOB: {
    hoofMap: true,
    pricing: true,
    financial: true,
    limpingRequests: true,
    workSessions: true,
    reportTitle: "HullsApp",
  },
  STARMILK: {
    hoofMap: false,
    pricing: false,
    financial: false,
    limpingRequests: false,
    workSessions: false,
    reportTitle: "StarMilk",
  },
};

export function tenantFeatures(
  context: Pick<FarmContext, "client_code"> | null | undefined,
  overrides?: TenantFeatureOverrides,
): TenantFeatures {
  const clientCode = context?.client_code?.trim().toUpperCase() ?? "";
  return { ...(CLIENT_FEATURES[clientCode] ?? DEFAULT_FEATURES), ...overrides };
}

export function canViewFinancial(
  context:
    | Pick<FarmContext, "client_code" | "can_view_financial" | "is_platform_admin">
    | null
    | undefined,
  overrides?: TenantFeatureOverrides,
) {
  return (
    tenantFeatures(context, overrides).financial &&
    (context?.is_platform_admin === true || context?.can_view_financial === true)
  );
}
