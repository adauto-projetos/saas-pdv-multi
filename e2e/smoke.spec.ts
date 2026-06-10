import { expect, test } from "@playwright/test";

// Fluxo real ponta a ponta: criar loja (signup) -> cadastrar produto com markup
// ao vivo -> ver na lista. Exercita form + server action + sessão + RLS + banco.
test("signup, cadastra produto com markup e vê na lista", async ({ page }) => {
  const email = `e2e+${Date.now()}@example.com`;

  // Criar loja (onboarding cria usuário + tenant + sessão)
  await page.goto("/signup");
  await page.getByLabel("Nome da loja").fill("Loja E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha123");
  await page.getByRole("button", { name: "Criar loja" }).click();

  await expect(page).toHaveURL(/\/products$/);

  // Ir para Novo produto
  await page
    .getByRole("link", { name: /Novo produto|Adicionar produto/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/products\/new$/);

  // Preencher (margem já vem 30 do tenant -> preço ao vivo 13,00)
  await page.getByLabel("Nome").fill("Coca-Cola 350ml");
  await page.getByLabel("Custo").fill("10,00");
  await expect(page.getByTestId("live-price")).toContainText("13,00");

  await page.getByRole("button", { name: "Salvar produto" }).click();

  // Volta para a lista e o produto aparece com o preço calculado
  await expect(page).toHaveURL(/\/products$/);
  await expect(page.getByText("Coca-Cola 350ml")).toBeVisible();
  await expect(page.getByText(/13,00/).first()).toBeVisible();
});
