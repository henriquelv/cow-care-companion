import { test, expect } from "@playwright/test";

async function activate(page, company: string, employee: string) {
  await page.goto("/");
  await page.getByLabel("Link ou código da empresa").fill(company);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome ou código do funcionário").fill(employee);
  await page.getByLabel("PIN de acesso").fill("1234");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: /Entrar na fazenda/i }).click();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
}

test("Romano administra Hullsjob no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await expect(page.getByText("Fazenda Vitória", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("button", { name: "Administração" })).toBeVisible();
});

test("Jeová não recebe ações de gerente", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Jeová");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("button", { name: "Administração" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Gestão da fazenda" })).toHaveCount(0);
});

test("Sandro entra na StarMilk no tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await activate(page, "STARMILK", "Sandro");
  await expect(page.getByText("StarMilk", { exact: true }).first()).toBeVisible();
});

test("Sandro gerencia doenças e prazos da fazenda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "STARMILK", "Sandro");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Gestão da fazenda" }).click();
  await page.getByRole("button", { name: "Regras" }).click();

  await page.getByLabel("Dias para revisão de Dermatite Digital").fill("8");
  await page.getByLabel("Nome da nova doença").fill("Dermatite interdigital");
  await page.getByLabel("Dias para revisão da nova doença").fill("12");
  await page.getByRole("button", { name: "Adicionar doença" }).click();
  await expect(page.getByLabel("Nome da doença Dermatite interdigital")).toBeVisible();
  await page.getByRole("button", { name: "Salvar regras" }).click();

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Gestão da fazenda" }).click();
  await page.getByRole("button", { name: "Regras" }).click();
  await expect(page.getByLabel("Dias para revisão de Dermatite Digital")).toHaveValue("8");
  await page.getByRole("button", { name: "Remover doença Dermatite interdigital" }).click();
  await expect(
    page.getByRole("button", { name: "Restaurar doença Dermatite interdigital" }),
  ).toBeVisible();
});

test("Romano consulta a agenda antes de escolher a fazenda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("Link ou código da empresa").fill("HULLSJOB");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Nome ou código do funcionário").fill("Romano");
  await page.getByLabel("PIN de acesso").fill("1234");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Minha agenda" }).click();
  await expect(page.getByRole("heading", { name: "Minha agenda" })).toBeVisible();
  await expect(page.getByText("Romano · 1 fazenda(s)")).toBeVisible();
  await page.getByRole("button", { name: "Voltar para escolher a fazenda" }).click();
  await expect(page.getByRole("button", { name: /Entrar na fazenda/i })).toBeVisible();
});

test("Romano registra casco normal como preventivo com auditoria automática", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("9876");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Casco normal/i }).click();
  await expect(page.getByText("Horario (definido pelo app)")).toBeVisible();
  await expect(page.getByText("Romano", { exact: true })).toBeVisible();
  await expect(page.getByText("Casco normal", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Salvar visita/i }).click();
  await expect(page.getByText(/Casqueamento preventivo registrado/i)).toBeVisible();
  await page.getByRole("button", { name: /^OK/ }).click();
  await expect(page.getByText("9876", { exact: true }).first()).toBeVisible();
});

test("Dermatite Digital sugere revisão automática em 7 dias", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("7654");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /1 pé\(s\) com problema/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.getByRole("button", { name: /Confirmar/i }).click();
  await page.getByRole("button", { name: /Spray.*Produto/i }).click();
  await page.getByRole("button", { name: /Confirmar/i }).click();
  await expect(page.getByText("Prazo sugerido: 7 dias")).toBeVisible();
  await expect(page.getByLabel("Escolher data da revisão")).not.toHaveValue("");
  await page.getByLabel("Intervalo personalizado em dias").fill("3");
  await page.getByLabel("Quantidade de revisões necessárias").fill("3");
  await expect(page.getByText(/3 revisão\(ões\) a cada 3 dia\(s\)/i)).toBeVisible();
});

test("aparelho ativado reabre sem internet", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  await expect(page.getByText(/Offline/).first()).toBeVisible();
});
