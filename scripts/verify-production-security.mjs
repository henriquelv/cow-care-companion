const supabaseUrl = process.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

async function request(path, { method = "GET", body, session, deviceId } = {}) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(session ? { "x-hoof-session": session } : {}),
      ...(deviceId ? { "x-hoof-device-id": deviceId } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${path}: HTTP ${response.status} - ${payload?.message ?? "falha"}`);
  }
  return payload;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function authenticate(company, login, pin, deviceId, expectedAdmin) {
  const result = await request("rpc/authenticate_hoof_employee", {
    method: "POST",
    deviceId,
    body: { p_activation_code: company, p_login: login, p_password: pin },
  });
  assert(result?.session_token, `${company}: sessão não emitida.`);
  assert(
    result?.employee?.is_admin === expectedAdmin,
    `${login}: permissão administrativa incorreta.`,
  );
  assert(result?.farms?.length > 0, `${login}: nenhuma fazenda permitida.`);
  return result;
}

async function verifyTenant({ company, login, pin, deviceId, expectedFarmName }) {
  const access = await authenticate(company, login, pin, deviceId, true);
  const farm = access.farms[0];
  assert(farm.name === expectedFarmName, `${company}: fazenda incorreta.`);

  const activation = await request("rpc/activate_hoof_device", {
    method: "POST",
    session: access.session_token,
    deviceId,
    body: { p_farm_id: farm.id, p_device_name: "Auditoria de produção" },
  });
  assert(activation?.ok === true, `${company}: aparelho não ativado.`);

  const validation = await request("rpc/validate_hoof_access", {
    method: "POST",
    session: access.session_token,
    deviceId,
    body: { p_farm_id: farm.id },
  });
  assert(validation?.ok === true, `${company}: sessão não validada.`);

  const manager = await request("rpc/authenticate_hoof_manager", {
    method: "POST",
    session: access.session_token,
    deviceId,
    body: { p_password: pin },
  });
  assert(manager?.ok === true && manager.manager_token, `${company}: gerente não liberado.`);

  const overview = await request("rpc/hoof_admin_overview", {
    method: "POST",
    session: access.session_token,
    deviceId,
    body: { p_manager_token: manager.manager_token },
  });
  assert(overview?.ok === true, `${company}: painel não carregou.`);

  return { access, farm, overview };
}

async function main() {
  const publicClients = await request("clients?select=id");
  assert(
    Array.isArray(publicClients) && publicClients.length === 0,
    "RLS público de clients falhou. Aplique a migration 202607220001_production_security.sql.",
  );

  const starMilk = await verifyTenant({
    company: "STARMILK",
    login: "Sandro",
    pin: process.env.QA_STARMILK_PIN ?? "1234",
    deviceId: "qa-production-starmilk",
    expectedFarmName: "StarMilk",
  });
  const hullsjob = await verifyTenant({
    company: "HULLSJOB",
    login: "Romano",
    pin: process.env.QA_HULLSJOB_PIN ?? "1234",
    deviceId: "qa-production-hullsjob",
    expectedFarmName: "Fazenda Vitória",
  });
  const jeova = await authenticate(
    "HULLSJOB",
    "Jeová",
    process.env.QA_HULLSJOB_PIN ?? "1234",
    "qa-production-hullsjob-jeova",
    false,
  );
  const patrick = await authenticate(
    "HULLSJOB",
    "Patrick",
    process.env.QA_HULLSJOB_PIN ?? "1234",
    "qa-production-hullsjob-patrick",
    false,
  );
  assert(
    jeova.farms.length === 1 && jeova.farms[0].id === hullsjob.farm.id,
    "Jeová: fazenda incorreta.",
  );
  assert(
    patrick.farms.length === 1 && patrick.farms[0].id === hullsjob.farm.id,
    "Patrick: fazenda incorreta.",
  );

  assert(
    !starMilk.overview.farms.some((farm) => farm.id === hullsjob.farm.id),
    "Painel StarMilk retornou fazenda Hullsjob.",
  );
  assert(
    !hullsjob.overview.farms.some((farm) => farm.id === starMilk.farm.id),
    "Painel Hullsjob retornou fazenda StarMilk.",
  );

  const crossFarmRows = await request(
    `hoof_visits?select=id&farm_id=eq.${encodeURIComponent(hullsjob.farm.id)}`,
    {
      session: starMilk.access.session_token,
      deviceId: "qa-production-starmilk",
    },
  );
  assert(
    Array.isArray(crossFarmRows) && crossFarmRows.length === 0,
    "Vazamento entre fazendas detectado.",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        public_access_blocked: true,
        starmilk: {
          farm: starMilk.farm.name,
          employees: starMilk.overview.employees.length,
        },
        hullsjob: {
          farm: hullsjob.farm.name,
          employees: hullsjob.overview.employees.length,
          common_employees_verified: 2,
        },
        cross_tenant_rows: crossFarmRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    `Verificação de produção falhou: ${error instanceof Error ? error.message : error}`,
  );
  process.exitCode = 1;
});
