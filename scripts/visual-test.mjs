/**
 * Teste visual completo — abre o Chromium headed e navega por todas as áreas.
 * Executar: node scripts/visual-test.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const EMAIL = "djadauto05@gmail.com";
const PASSWORD = "1234";
const PAUSE = 1200; // ms entre cada ação

function log(area, msg) {
  console.log(`\n[${area}] ${msg}`);
}

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const browser = await chromium.launch({
  headless: false,
  slowMo: 300,
  args: ["--start-maximized"],
});

const ctx = await browser.newContext({ viewport: null });
const page = await ctx.newPage();

// ──────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────
log("LOGIN", "Abrindo página de login...");
await page.goto(`${BASE}/login`);
await wait(PAUSE);

log("LOGIN", "Preenchendo e-mail e senha...");
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASSWORD);
await wait(500);

log("LOGIN", "Clicando em Entrar...");
await page.click('button[type="submit"]');
await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 10_000 });
log("LOGIN", `Logado! Redirecionado para: ${page.url()}`);
await wait(PAUSE);

// Ir direto para o Caixa
log("CAIXA", "Navegando para /caixa...");
await page.goto(`${BASE}/caixa`);
await wait(PAUSE);

// ──────────────────────────────────────────────
// CAIXA — grade de produtos
// ──────────────────────────────────────────────
log("CAIXA", "Tela da Caixa carregada. Verificando grade de produtos...");
await wait(PAUSE);

log("CAIXA", "Buscando produto pelo nome...");
const searchInput = page.getByTestId("barcode-input");
await searchInput.fill("refri");
await wait(PAUSE);

log("CAIXA", "Clicando em um tile de produto para adicionar ao carrinho...");
const firstTile = page.locator("button").filter({ hasText: /R\$/ }).first();
if (await firstTile.count()) {
  await firstTile.click();
  await wait(PAUSE);
}

log("CAIXA", "Limpando busca e testando filtro por categoria...");
await searchInput.fill("");
await wait(500);

const pills = page.locator("button").filter({ hasText: /Bebidas|Lanches|Mercearia|Hortifruti/ });
if (await pills.count()) {
  await pills.first().click();
  await wait(PAUSE);
  log("CAIXA", `Filtro '${await pills.first().textContent()}' ativo.`);
  await wait(PAUSE);
  // volta para Todos
  await page.locator("button").filter({ hasText: "Todos" }).first().click();
  await wait(PAUSE);
}

log("CAIXA", "Adicionando mais produtos ao carrinho clicando nos tiles...");
const tiles = page.locator("button").filter({ hasText: /R\$/ });
const tileCount = await tiles.count();
for (let i = 0; i < Math.min(3, tileCount); i++) {
  await tiles.nth(i).click();
  await wait(600);
}

log("CAIXA", "Testando controles +/− no carrinho...");
const incBtn = page.locator("button").filter({ hasText: "+" }).first();
if (await incBtn.count()) {
  await incBtn.click();
  await wait(500);
  await incBtn.click();
  await wait(500);
}

// ──────────────────────────────────────────────
// CAIXA — Finalizar venda (PaymentDialog)
// ──────────────────────────────────────────────
log("CAIXA", "Abrindo dialog de pagamento...");
const finalizarBtn = page.getByRole("button", { name: /finalizar venda/i });
if (await finalizarBtn.count()) {
  await finalizarBtn.click();
  await wait(PAUSE);

  log("CAIXA", "Dialog: testando método Cartão...");
  const cartaoBtn = page.getByRole("button", { name: /cartão/i });
  if (await cartaoBtn.count()) {
    await wait(PAUSE);
  }

  log("CAIXA", "Dialog: selecionando Dinheiro → preenche valor recebido...");
  await page.getByRole("button", { name: "Dinheiro" }).click();
  await wait(PAUSE);

  log("CAIXA", "Escolhendo valor rápido (primeiro botão)...");
  const quickBtn = page.locator("button").filter({ hasText: /^R\$\d+$/ }).first();
  if (await quickBtn.count()) {
    await quickBtn.click();
    await wait(500);
  } else {
    await page.getByLabel("Valor recebido").fill("100");
    await wait(500);
  }

  log("CAIXA", "Confirmando venda...");
  await page.getByRole("button", { name: /confirmar venda/i }).click();
  await wait(PAUSE * 2);

  log("CAIXA", "Tela de sucesso — troco exibido. Fechando...");
  await page.getByRole("button", { name: /fechar/i }).click();
  await wait(PAUSE);
}

// ──────────────────────────────────────────────
// VENDAS
// ──────────────────────────────────────────────
log("VENDAS", "Navegando para Vendas...");
await page.goto(`${BASE}/vendas`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// PRODUTOS
// ──────────────────────────────────────────────
log("PRODUTOS", "Navegando para Produtos...");
await page.goto(`${BASE}/products`);
await wait(PAUSE * 2);

log("PRODUTOS", "Abrindo formulário de novo produto...");
await page.getByRole("link", { name: /novo produto/i }).click();
await wait(PAUSE);

log("PRODUTOS", "Preenchendo nome, emoji e categoria...");
await page.getByLabel("Nome").fill("Coca-Cola Lata Teste");
await wait(400);
await page.getByLabel(/emoji/i).fill("🥤");
await wait(400);

const catSelect = page.getByLabel("Categoria");
if (await catSelect.count()) {
  await catSelect.selectOption("Bebidas");
  await wait(400);
}

await page.getByLabel(/custo/i).fill("3,50");
await wait(400);

log("PRODUTOS", "Voltando sem salvar...");
await page.goto(`${BASE}/products`);
await wait(PAUSE);

// ──────────────────────────────────────────────
// ESTOQUE
// ──────────────────────────────────────────────
log("ESTOQUE", "Navegando para Estoque...");
await page.goto(`${BASE}/estoque`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// COMANDAS
// ──────────────────────────────────────────────
log("COMANDAS", "Navegando para Comandas...");
await page.goto(`${BASE}/comandas`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// FINANCEIRO
// ──────────────────────────────────────────────
log("FINANCEIRO", "Navegando para Financeiro...");
await page.goto(`${BASE}/financeiro/caixa`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// LUCRO
// ──────────────────────────────────────────────
log("LUCRO", "Navegando para Lucro...");
await page.goto(`${BASE}/lucro`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// CONFIGURAÇÕES
// ──────────────────────────────────────────────
log("CONFIG", "Navegando para Configurações...");
await page.goto(`${BASE}/settings`);
await wait(PAUSE * 2);

// ──────────────────────────────────────────────
// FIM
// ──────────────────────────────────────────────
log("DONE", "✅ Todas as áreas testadas! Deixando o browser aberto 5s...");
await wait(5000);

await browser.close();
console.log("\n✅ Teste visual concluído.");
