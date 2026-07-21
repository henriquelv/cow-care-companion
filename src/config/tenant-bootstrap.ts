export interface BootstrapClient {
  id: string;
  name: string;
  activation_code: string;
  status: "active";
  max_devices: number;
  grace_period_days: number;
  source: "bootstrap";
}

export interface BootstrapFarm {
  id: string;
  client_id: string;
  name: string;
  activation_code: string;
  status: "active";
  max_devices: number;
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
  admin_pin: null;
}

interface BootstrapAccess {
  client: BootstrapClient;
  farms: BootstrapFarm[];
  employees: Array<BootstrapEmployee & { temporary_password: string }>;
}

const LOCAL_PIN_OVERRIDES_KEY = "casco.employee_pin_overrides.v1";

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
      id: "10000000-0000-4000-8000-000000000001",
      name: "StarMilk",
      activation_code: "STARMILK",
      status: "active",
      max_devices: 10,
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
        max_devices: 10,
        grace_period_days: 7,
      },
    ],
    employees: [
      {
        id: "30000000-0000-4000-8000-000000000001",
        client_id: "10000000-0000-4000-8000-000000000001",
        farm_id: "20000000-0000-4000-8000-000000000001",
        employee_code: "001",
        login_name: "StarMilk",
        name: "StarMilk",
        status: "active",
        is_admin: true,
        admin_pin: null,
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
      max_devices: 10,
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
        max_devices: 10,
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
        is_admin: false,
        admin_pin: null,
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
        admin_pin: null,
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
        admin_pin: null,
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
  const employee = tenant.employees.find(
    (item) =>
      (pinOverrides[item.id] ?? item.temporary_password) === pin &&
      (item.employee_code === login.trim() ||
        item.login_name.toLocaleLowerCase("pt-BR") === normalizedLogin),
  );
  if (!employee) return null;

  const { temporary_password: _temporaryPassword, ...safeEmployee } = employee;
  return {
    client: tenant.client,
    employee: safeEmployee,
    farms: tenant.farms.filter((farm) => farm.id === employee.farm_id),
  };
}
