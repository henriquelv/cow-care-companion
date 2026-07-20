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

export function authenticateBootstrapEmployee(code: string, login: string, password: string) {
  const tenant = TENANTS.find((item) => item.client.activation_code === code);
  if (!tenant) return null;

  const normalizedLogin = login.trim().toLocaleLowerCase("pt-BR");
  const employee = tenant.employees.find(
    (item) =>
      item.temporary_password === password &&
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
