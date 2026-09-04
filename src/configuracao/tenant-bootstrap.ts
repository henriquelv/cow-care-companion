export interface BootstrapClient {
  id: string;
  name: string;
  activation_code: string;
  status: "active";
  grace_period_days: number;
  source: "bootstrap";
}

export interface BootstrapFarm {
  id: string;
  client_id: string;
  name: string;
  activation_code: string;
  status: "active";
  grace_period_days: number;
}

export interface BootstrapEmployee {
  id: string;
  client_id: string;
  farm_id: string;
  employee_code: string;
  login_name: string;
  name: string;
  status: "active";
  is_admin: boolean;
  is_platform_admin?: boolean;
  can_view_financial: boolean;
}

interface BootstrapAccess {
  client: BootstrapClient;
  farms: BootstrapFarm[];
  employees: Array<BootstrapEmployee & { temporary_password: string }>;
}

const LOCAL_PIN_OVERRIDES_KEY = "casco.employee_pin_overrides.v1";
const LOCAL_FARMS_KEY = "casco.bootstrap_farms.v1";

interface LocalBootstrapFarm extends BootstrapFarm {
  employee_ids: string[];
}

function readLocalPinOverrides(): Record<string, string> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LOCAL_PIN_OVERRIDES_KEY) ?? "{}") as Record<
      string,
      string
    >;
  } catch {
    return {};
  }
}

export function saveLocalEmployeePin(employeeId: string, pin: string) {
  if (typeof localStorage === "undefined") return;
  const overrides = readLocalPinOverrides();
  overrides[employeeId] = pin;
  localStorage.setItem(LOCAL_PIN_OVERRIDES_KEY, JSON.stringify(overrides));
}

function readLocalFarms(): LocalBootstrapFarm[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(LOCAL_FARMS_KEY) ?? "[]") as unknown;
    return Array.isArray(stored) ? (stored as LocalBootstrapFarm[]) : [];
  } catch {
    return [];
  }
}

function createLocalId() {
  try {
    return crypto.randomUUID();
  } catch {
    return `farm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}

export function createBootstrapFarm(
  clientCode: string,
  employeeId: string,
  pin: string,
  name: string,
) {
  const tenant = TENANTS.find((item) => item.client.activation_code === clientCode);
  const employee = tenant?.employees.find((item) => item.id === employeeId);
  if (!tenant || !employee?.is_admin) {
    throw new Error("Somente administradores podem criar fazendas.");
  }
  const expectedPin = readLocalPinOverrides()[employee.id] ?? employee.temporary_password;
  if (pin !== expectedPin) throw new Error("PIN incorreto.");

  const cleanName = name.trim();
  if (cleanName.length < 2 || cleanName.length > 80) {
    throw new Error("Informe um nome de fazenda válido.");
  }
  const duplicate = [...tenant.farms, ...readLocalFarms()].some(
    (farm) =>
      farm.client_id === tenant.client.id &&
      farm.name.trim().toLocaleLowerCase("pt-BR") === cleanName.toLocaleLowerCase("pt-BR"),
  );
  if (duplicate) throw new Error("Já existe uma fazenda com esse nome nesta empresa.");

  const farm: LocalBootstrapFarm = {
    id: createLocalId(),
    client_id: tenant.client.id,
    name: cleanName,
    activation_code: "",
    status: "active",
    grace_period_days: 7,
    employee_ids: [employee.id],
  };
  localStorage.setItem(LOCAL_FARMS_KEY, JSON.stringify([...readLocalFarms(), farm]));
  return farm;
}

export function changeBootstrapEmployeePin(
  clientCode: string,
  employeeId: string,
  currentPin: string,
  newPin: string,
) {
  const tenant = TENANTS.find((item) => item.client.activation_code === clientCode);
  const employee = tenant?.employees.find((item) => item.id === employeeId);
  if (!employee) return false;
  const expectedPin = readLocalPinOverrides()[employee.id] ?? employee.temporary_password;
  if (expectedPin !== currentPin) return false;
  saveLocalEmployeePin(employee.id, newPin);
  return true;
}

const TENANTS: BootstrapAccess[] = [
  {
    client: {
      id: "10000000-0000-4000-8000-000000000000",
      name: "Administração central",
      activation_code: "000",
      status: "active",
      grace_period_days: 7,
      source: "bootstrap",
    },
    farms: [
      {
        id: "20000000-0000-4000-8000-000000000000",
        client_id: "10000000-0000-4000-8000-000000000000",
        name: "Administração central",
        activation_code: "000",
        status: "active",
        grace_period_days: 7,
      },
    ],
    employees: [
      {
        id: "30000000-0000-4000-8000-000000000000",
        client_id: "10000000-0000-4000-8000-000000000000",
        farm_id: "20000000-0000-4000-8000-000000000000",
        employee_code: "000",
        login_name: "000",
        name: "Conta mestra",
        status: "active",
        is_admin: true,
        is_platform_admin: true,
        can_view_financial: true,
        temporary_password: "1234",
      },
    ],
  },
  {
    client: {
      id: "10000000-0000-4000-8000-000000000001",
      name: "StarMilk",
      activation_code: "STARMILK",
      status: "active",
      grace_period_days: 7,
      source: "bootstrap",
    },
    farms: [
      {
        id: "20000000-0000-4000-8000-000000000001",
        client_id: "10000000-0000-4000-8000-000000000001",
        name: "StarMilk",
        activation_code: "STARMILK",
        status: "active",
        grace_period_days: 7,
      },
    ],
    employees: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        client_id: "10000000-0000-4000-8000-000000000001",
        farm_id: "20000000-0000-4000-8000-000000000001",
        employee_code: "001",
        login_name: "Sandro",
        name: "Sandro",
        status: "active",
        is_admin: true,
        can_view_financial: false,
        temporary_password: "1234",
      },
    ],
  },
  {
    client: {
      id: "10000000-0000-4000-8000-000000000002",
      name: "Hullsjob",
      activation_code: "HULLSJOB",
      status: "active",
      grace_period_days: 7,
      source: "bootstrap",
    },
    farms: [
      {
        id: "20000000-0000-4000-8000-000000000002",
        client_id: "10000000-0000-4000-8000-000000000002",
        name: "Fazenda Vitória",
        activation_code: "HULLSJOB-VITORIA",
        status: "active",
        grace_period_days: 7,
      },
    ],
    employees: [
      {
        id: "30000000-0000-4000-8000-000000000002",
        client_id: "10000000-0000-4000-8000-000000000002",
        farm_id: "20000000-0000-4000-8000-000000000002",
        employee_code: "001",
        login_name: "Romano",
        name: "Romano",
        status: "active",
        is_admin: true,
        can_view_financial: true,
        temporary_password: "1234",
      },
      {
        id: "30000000-0000-4000-8000-000000000003",
        client_id: "10000000-0000-4000-8000-000000000002",
        farm_id: "20000000-0000-4000-8000-000000000002",
        employee_code: "002",
        login_name: "Jeová",
        name: "Jeová",
        status: "active",
        is_admin: false,
        can_view_financial: true,
        temporary_password: "1234",
      },
      {
        id: "30000000-0000-4000-8000-000000000004",
        client_id: "10000000-0000-4000-8000-000000000002",
        farm_id: "20000000-0000-4000-8000-000000000002",
        employee_code: "003",
        login_name: "Patrick",
        name: "Patrick",
        status: "active",
        is_admin: false,
        can_view_financial: false,
        temporary_password: "1234",
      },
      {
        id: "30000000-0000-4000-8000-000000000005",
        client_id: "10000000-0000-4000-8000-000000000002",
        farm_id: "20000000-0000-4000-8000-000000000002",
        employee_code: "004",
        login_name: "Funcionários da Fazenda",
        name: "Funcionários da Fazenda",
        status: "active",
        is_admin: false,
        can_view_financial: false,
        temporary_password: "1234",
      },
    ],
  },
];

export function findBootstrapClient(code: string) {
  return TENANTS.find((tenant) => tenant.client.activation_code === code)?.client ?? null;
}

export function authenticateBootstrapEmployee(code: string, login: string, pin: string) {
  const tenant = TENANTS.find((item) => item.client.activation_code === code);
  if (!tenant) return null;

  const normalizedLogin = login.trim().toLocaleLowerCase("pt-BR");
  const pinOverrides = readLocalPinOverrides();
  const platformTenant = TENANTS.find((item) => item.client.activation_code === "000");
  const platformEmployee = platformTenant?.employees.find((item) => item.is_platform_admin);
  const platformPin = platformEmployee
    ? (pinOverrides[platformEmployee.id] ?? platformEmployee.temporary_password)
    : "";
  if (
    platformEmployee &&
    platformPin === pin &&
    (login.trim() === "000" ||
      normalizedLogin === platformEmployee.login_name.toLocaleLowerCase("pt-BR"))
  ) {
    const { temporary_password: _temporaryPassword, ...safePlatformEmployee } = platformEmployee;
    return {
      client: tenant.client,
      employee: safePlatformEmployee,
      farms: tenant.farms,
    };
  }
  const employee = tenant.employees.find(
    (item) =>
      (pinOverrides[item.id] ?? item.temporary_password) === pin &&
      (item.employee_code === login.trim() ||
        item.login_name.toLocaleLowerCase("pt-BR") === normalizedLogin),
  );
  if (!employee) return null;

  const { temporary_password: _temporaryPassword, ...safeEmployee } = employee;
  const localFarms = readLocalFarms().filter(
    (farm) => farm.client_id === tenant.client.id && farm.employee_ids.includes(employee.id),
  );
  return {
    client: tenant.client,
    employee: safeEmployee,
    farms: [...tenant.farms.filter((farm) => farm.id === employee.farm_id), ...localFarms],
  };
}
