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

async function storedVisitCount(page) {
  return page.evaluate(() =>
    Object.entries(localStorage)
      .filter(([key]) => key.startsWith("casco.visits.v3"))
      .reduce((total, [, value]) => {
        try {
          const visits = JSON.parse(value);
          return total + (Array.isArray(visits) ? visits.length : 0);
        } catch {
          return total;
        }
      }, 0),
  );
}

test("Romano administra Hullsjob no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await expect(page.getByText("Fazenda Vitória", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("button", { name: "Administração" })).toBeVisible();
});

test("tela inicial concentra acompanhamento e permite retirar o filtro rápido", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");

  const main = page.locator("#conteudo-principal");
  await expect(main.getByText("Agenda clínica", { exact: true })).toBeVisible();
  await expect(main.getByText("Resumo", { exact: true })).toHaveCount(0);
  await expect(main.getByText("Histórico", { exact: true })).toHaveCount(0);

  const treatment = main.getByRole("button", { name: /Em tratamento/ });
  await expect(treatment).toHaveAttribute("aria-pressed", "true");
  await treatment.click();
  await expect(treatment).toHaveAttribute("aria-pressed", "false");
  await expect(main.getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Histórico dos animais" }).click();
  await expect(page.getByRole("heading", { name: "Histórico das vacas" })).toBeVisible();
});

test("visita abandonada antes do resumo final não é salva", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  const before = await storedVisitCount(page);

  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("909090");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.reload();

  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  expect(await storedVisitCount(page)).toBe(before);
  await expect(page.getByText("909090", { exact: true })).toHaveCount(0);
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

test("funcionário gera o próprio PDF detalhado", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await activate(page, "STARMILK", "Sandro");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("PDF-100");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.getByRole("button", { name: /Confirmar 1 lesão/i }).click();
  await page.getByRole("button", { name: /^Colocar taco/i }).click();
  await page.getByRole("button", { name: "Lado esquerdo do casco Frente Esq." }).click();
  await page.getByRole("button", { name: /Spray.*Produto/i }).click();
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await page.getByRole("button", { name: "Sim, agendar" }).click();
  await page.getByLabel("Intervalo personalizado em dias").fill("3");
  await page.getByLabel("Quantidade de revisões necessárias").fill("3");
  await page.getByRole("button", { name: /Ver resumo/i }).click();
  await page.getByRole("button", { name: /Salvar visita/i }).click();
  await page.getByRole("button", { name: "Meu trabalho e segurança" }).click();
  await expect(page.getByText("Este é o seu relatório individual")).toBeVisible();
  await expect(page.getByRole("button", { name: "Abrir relatório da equipe" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comparativo mensal" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detalhes do trabalho" })).toBeVisible();
  await page.getByRole("tab", { name: "Pés" }).click();
  await expect(page.getByText(/casco\(s\) com doença ou ação de taco/i)).toBeVisible();
  await page.getByRole("tab", { name: "Animais" }).click();
  await expect(page.getByText(/Brinco 100/i)).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar PDF" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^casqueamento-.*\.pdf$/);
  await download.saveAs(testInfo.outputPath("relatorio-funcionario.pdf"));
});

test("administrador escolhe entre relatório próprio e de toda a equipe", async ({
  page,
}, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 768, height: 1024 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Administração" }).click();
  const localMode = page.getByRole("heading", { name: "Modo local" });
  const adminPin = page.getByLabel("PIN do administrador");
  const reportsTitle = page.getByRole("heading", { name: "Desempenho da fazenda" });
  await expect(localMode.or(adminPin).or(reportsTitle)).toBeVisible();
  if (await localMode.isVisible()) {
    test.skip(true, "Relatórios administrativos exigem o servidor configurado.");
  }
  if (await adminPin.isVisible().catch(() => false)) {
    await adminPin.fill("1234");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
  }

  const teamScope = page.getByRole("button", { name: /Toda a equipe/i });
  const mineScope = page.getByRole("button", { name: /Só o meu/i });
  await expect(teamScope).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/inclui todo o histórico ativo da fazenda/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Baixar PDF completo da fazenda" })).toBeVisible();

  const teamDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF completo da fazenda" }).click();
  const teamDownload = await teamDownloadPromise;
  expect(teamDownload.suggestedFilename()).toMatch(/^casqueamento-.*\.pdf$/);
  await teamDownload.saveAs(testInfo.outputPath("relatorio-equipe.pdf"));

  await mineScope.click();
  await expect(mineScope).toHaveAttribute("aria-pressed", "true");
  const mineDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar meu PDF filtrado" }).click();
  const mineDownload = await mineDownloadPromise;
  expect(mineDownload.suggestedFilename()).toMatch(/^casqueamento-.*\.pdf$/);
});

test("Sandro gerencia doenças e prazos da fazenda", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "STARMILK", "Sandro");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Gestão da fazenda" }).click();
  await page.getByRole("tab", { name: /Regras clínicas/i }).click();

  await page.getByLabel("Dias para revisão de Dermatite Digital").fill("8");
  await page.getByLabel("Nome da nova doença").fill("Dermatite interdigital");
  await page.getByLabel("Dias para revisão da nova doença").fill("12");
  await page.getByRole("button", { name: "Adicionar doença" }).click();
  await expect(page.getByLabel("Nome da doença Dermatite interdigital")).toBeVisible();
  await page.getByRole("button", { name: "Salvar regras" }).click();

  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Gestão da fazenda" }).click();
  await page.getByRole("tab", { name: /Regras clínicas/i }).click();
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
  const unexpectedDialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    unexpectedDialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("9876");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Todos os cascos estão normais/i }).click();
  await expect(page.getByText("Horario (definido pelo app)")).toBeVisible();
  await expect(page.getByText("Romano", { exact: true })).toBeVisible();
  await expect(page.getByText("Casco normal", { exact: true })).toBeVisible();
  await expect(page.getByText(/Encontrou alguma doença durante o preventivo/i)).toBeVisible();
  await page.getByRole("button", { name: /Salvar visita/i }).click();
  expect(unexpectedDialogs).toEqual([]);
  await expect(page.getByText(/Animal 9876 cadastrado automaticamente/i)).toBeVisible();
  await page.getByRole("button", { name: /^Todos/ }).click();
  await expect(page.getByText("9876", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Preventivo" }).click();
  await expect(
    page.getByRole("button", { name: "Iniciar avaliação preventiva do brinco 9876" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calendário" }).click();
  await page.getByRole("button", { name: /Abrir primeiro compromisso da agenda/i }).click();
  await expect(page.getByText("Casqueamento preventivo", { exact: true })).toBeVisible();
});

test("preventivo vira atendimento clínico com várias doenças", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("9101");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Todos os cascos estão normais/i }).click();
  await page.getByRole("button", { name: /Registrar doença encontrada/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /TD Trás Dir/i }).click();
  await page.getByRole("button", { name: /Continuar com 2 pé/i }).click();

  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.getByRole("button", { name: "Úlcera de Sola: grau 1" }).click();
  await expect(page.getByText(/2 lesão\(ões\) neste casco/i)).toBeVisible();
  await page.getByRole("button", { name: /Confirmar 2 lesão/i }).click();
  await page.getByRole("button", { name: /Spray.*Produto/i }).click();
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await page.getByRole("button", { name: /Próximo pé/i }).click();

  await page.getByRole("button", { name: "Problema de Locomoção: grau 3" }).click();
  await page.getByRole("button", { name: /Confirmar 1 lesão/i }).click();
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await page.getByRole("button", { name: /Ver resumo/i }).click();

  await expect(page.getByText("Derm. Digital", { exact: true })).toBeVisible();
  await expect(page.getByText("Úlcera Sola", { exact: true })).toBeVisible();
  await expect(page.getByText("Locomoção", { exact: true })).toBeVisible();
  await expect(
    page.locator("#conteudo-principal").getByText("Preventivo", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Salvar visita concluída/i }).click();
  await expect(page.getByText(/Animal 9101 cadastrado automaticamente/i)).toBeVisible();
});

test("Dermatite Digital sugere 7 dias e só agenda após confirmação", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("7654");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.getByRole("button", { name: /Confirmar/i }).click();
  await expect(page.getByRole("button", { name: /Aplicar bloco/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Remover bloco/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Bloco mantido/i })).toHaveCount(0);
  await page.getByRole("button", { name: /^Colocar taco/i }).click();
  await expect(page.getByText(/Escolha o lado esquerdo ou direito/i)).toBeVisible();
  await page.getByRole("button", { name: "Lado esquerdo do casco Frente Esq." }).click();
  await page.getByRole("button", { name: /Spray.*Produto/i }).click();
  await page.getByRole("button", { name: /Confirmar/i }).click();
  await expect(page.getByText("Prazo sugerido: 7 dias")).toBeVisible();
  await expect(page.getByText(/Nenhuma revisão será criada/i)).toBeVisible();
  await page.getByRole("button", { name: "Sim, agendar" }).click();
  await expect(page.getByLabel("Escolher data da revisão")).not.toHaveValue("");
  await page.getByLabel("Intervalo personalizado em dias").fill("3");
  await page.getByLabel("Quantidade de revisões necessárias").fill("3");
  await expect(page.getByText(/3 revisão\(ões\) a cada 3 dia\(s\)/i)).toBeVisible();
});

test("taco existente é reconhecido e pré-selecionado na próxima visita", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("8765");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /TD.*Trás Dir/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 2" }).click();
  await page.getByRole("button", { name: /Confirmar 1 lesão/i }).click();
  await page.getByRole("button", { name: /^Colocar taco/i }).click();
  await page.getByRole("button", { name: "Lado direito do casco Trás Dir." }).click();
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await page.getByRole("button", { name: /Ver resumo/i }).click();
  await expect(page.getByText(/Colocar taco · Lado direito/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /Salvar visita/i })).toBeEnabled();
  await page.getByRole("button", { name: /Salvar visita/i }).click();

  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("8765");
  await expect(page.getByText(/Taco ativo · Trás Dir/i)).toBeVisible();
  await page.getByRole("button", { name: /Continuar/i }).click();
  await expect(page.getByText(/Pé\(s\) em acompanhamento já marcados/i)).toBeVisible();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: /Confirmar 1 lesão/i }).click();
  await expect(page.getByText("Taco já colocado")).toBeVisible();
  await expect(page.getByRole("button", { name: /Deixar taco colocado/i })).toHaveClass(
    /bg-primary/,
  );
});

test("problema curado pode ser liberado para preventivo", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");

  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("6543");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /FE Frente Esq/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: "Dermatite Digital: grau 1" }).click();
  await page.getByRole("button", { name: /Confirmar 1 lesão/i }).click();
  await page.getByRole("button", { name: /Spray.*Produto/i }).click();
  await page.getByRole("button", { name: /^Confirmar$/i }).click();
  await expect(page.getByText(/Nenhuma revisão será criada/i)).toBeVisible();
  await page.getByRole("button", { name: /Ver resumo/i }).click();
  await page.getByRole("button", { name: /Salvar visita/i }).click();

  await page.getByRole("button", { name: "Nova visita", exact: true }).click();
  await page.getByLabel("Número do brinco").fill("6543");
  await page.getByRole("button", { name: /Continuar/i }).click();
  await page.getByRole("button", { name: /Continuar com 1 pé/i }).click();
  await page.getByRole("button", { name: /O problema não existe mais/i }).click();
  await page.getByRole("button", { name: /Sim, está curado/i }).click();
  await expect(page.getByText(/Problema encerrado neste casco/i)).toBeVisible();
  await expect(page.getByText(/Precisa agendar revisão/i)).toBeVisible();
  await page.getByRole("button", { name: /Ver resumo/i }).click();
  await expect(page.getByText(/Marcado como CURADO/i)).toBeVisible();
  await expect(page.getByText(/Destino do animal após a cura/i)).toBeVisible();
  await page.getByRole("button", { name: /Liberar para preventivo/i }).click();
  await expect(
    page.locator("#conteudo-principal").getByText("Preventivo", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Salvar visita/i }).click();
});

test("aparelho ativado reabre sem internet", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page, "HULLSJOB", "Romano");
  const firstDeviceId = await page.evaluate(() => localStorage.getItem("casco.device_id.v1"));
  expect(firstDeviceId).toBeTruthy();
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain("casco_device_id_v1=");
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, undefined, {
    timeout: 15_000,
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("casco.device_id.v1"))).toBe(firstDeviceId);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Nova visita", exact: true })).toBeVisible();
  await expect(page.getByText(/Offline/).first()).toBeVisible();
});

test("página longa rola até o fim em celular estreito", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await activate(page, "STARMILK", "Sandro");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Gestão da fazenda" }).click();
  await page.getByRole("tab", { name: /Regras clínicas/i }).click();

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  expect(dimensions.scrollHeight).toBeGreaterThan(568);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.getByRole("button", { name: "Salvar regras" })).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
});

test("ajuda mantém ações acessíveis em tela baixa e bloqueia o fundo", async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 360 });
  await activate(page, "HULLSJOB", "Romano");
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await page.getByRole("button", { name: "Ajuda" }).click();

  const dialog = page.getByRole("dialog", { name: "Tela inicial" });
  await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await dialog.getByRole("button", { name: "Entendi" }).scrollIntoViewIfNeeded();
  await expect(dialog.getByRole("button", { name: "Entendi" })).toBeInViewport();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
});
