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
  await expect(page.getByRole("button", { name: "Configurações locais" })).toHaveCount(0);
});

test("Sandro entra na StarMilk no tablet", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await activate(page, "STARMILK", "Sandro");
  await expect(page.getByText("StarMilk", { exact: true }).first()).toBeVisible();
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

test("Romano registra visita sem lesão com auditoria automática", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("9876");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Todos os pés OK/i }).click();
  await expect(page.getByText("Horario (definido pelo app)")).toBeVisible();
  await expect(page.getByText("Romano", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /Salvar visita/i }).click();
  await expect(page.getByText("Visita registrada com sucesso!")).toBeVisible();
  await page.getByRole("button", { name: /^OK/ }).click();
  await expect(page.getByText("9876", { exact: true }).first()).toBeVisible();
});

test("aparelho ativado reabre sem internet", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  await expect(page.getByText(/Offline/).first()).toBeVisible();
});
