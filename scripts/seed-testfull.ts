import { config } from "dotenv";
import { and, eq } from "drizzle-orm";

config({ path: ".env.local" });

import { db } from "../db";
import { products, tenantMembers, tenants, users } from "../db/schema";
import { hashPassword } from "../lib/auth/password";
import { calculateSalePrice } from "../lib/services/products/markup";

const EMAIL = "djadauto05@gmail.com";
const PASSWORD = "1234";
const TENANT_NAME = "TestFull";

type Unit = "un" | "kg";
type Item = {
  name: string;
  unit: Unit;
  cost?: number; // centavos
  markup?: number; // %
  price?: number; // preço manual (centavos) — sem custo
  stock: number;
  barcode?: string;
};

// 50 itens: mercado (un c/ código), hortifruti (kg s/ código), bar, lanchonete.
const CATALOG: Item[] = [
  { name: "Arroz Branco 5kg", unit: "un", cost: 2200, markup: 30, stock: 40, barcode: "7890000000001" },
  { name: "Feijão Carioca 1kg", unit: "un", cost: 750, markup: 35, stock: 60, barcode: "7890000000002" },
  { name: "Açúcar Refinado 1kg", unit: "un", cost: 420, markup: 30, stock: 50, barcode: "7890000000003" },
  { name: "Café Torrado 500g", unit: "un", cost: 1500, markup: 40, stock: 30, barcode: "7890000000004" },
  { name: "Óleo de Soja 900ml", unit: "un", cost: 690, markup: 25, stock: 45, barcode: "7890000000005" },
  { name: "Macarrão Espaguete 500g", unit: "un", cost: 380, markup: 35, stock: 70, barcode: "7890000000006" },
  { name: "Farinha de Trigo 1kg", unit: "un", cost: 480, markup: 30, stock: 40, barcode: "7890000000007" },
  { name: "Leite Integral 1L", unit: "un", cost: 520, markup: 28, stock: 80, barcode: "7890000000008" },
  { name: "Sal Refinado 1kg", unit: "un", cost: 250, markup: 40, stock: 35, barcode: "7890000000009" },
  { name: "Molho de Tomate 340g", unit: "un", cost: 310, markup: 35, stock: 55, barcode: "7890000000010" },
  { name: "Bolacha Recheada 130g", unit: "un", cost: 230, markup: 45, stock: 90, barcode: "7890000000011" },
  { name: "Sabão em Pó 1kg", unit: "un", cost: 1290, markup: 30, stock: 25, barcode: "7890000000012" },
  { name: "Detergente 500ml", unit: "un", cost: 270, markup: 40, stock: 60, barcode: "7890000000013" },
  { name: "Papel Higiênico 12un", unit: "un", cost: 1890, markup: 28, stock: 30, barcode: "7890000000014" },
  { name: "Amaciante 2L", unit: "un", cost: 1490, markup: 30, stock: 20, barcode: "7890000000015" },
  { name: "Margarina 500g", unit: "un", cost: 560, markup: 32, stock: 40, barcode: "7890000000016" },
  { name: "Biscoito Cream Cracker", unit: "un", cost: 290, markup: 45, stock: 75, barcode: "7890000000017" },
  { name: "Achocolatado 400g", unit: "un", cost: 740, markup: 38, stock: 50, barcode: "7890000000018" },
  { name: "Maionese 500g", unit: "un", cost: 640, markup: 35, stock: 35, barcode: "7890000000019" },
  { name: "Vinagre 750ml", unit: "un", cost: 230, markup: 50, stock: 45, barcode: "7890000000020" },
  // Hortifruti por kg (sem código de barras)
  { name: "Banana Prata", unit: "kg", cost: 380, markup: 40, stock: 25.5 },
  { name: "Tomate", unit: "kg", cost: 590, markup: 45, stock: 18 },
  { name: "Batata", unit: "kg", cost: 420, markup: 50, stock: 30 },
  { name: "Cebola", unit: "kg", cost: 350, markup: 50, stock: 22.5 },
  { name: "Maçã", unit: "kg", cost: 690, markup: 40, stock: 15 },
  { name: "Laranja", unit: "kg", cost: 320, markup: 45, stock: 28 },
  { name: "Cenoura", unit: "kg", cost: 380, markup: 50, stock: 12.5 },
  { name: "Alface (unidade)", unit: "un", cost: 250, markup: 60, stock: 20 },
  // Bar — bebidas
  { name: "Cerveja Lata 350ml", unit: "un", cost: 290, markup: 55, stock: 120, barcode: "7890000000031" },
  { name: "Cerveja Long Neck 355ml", unit: "un", cost: 450, markup: 60, stock: 80, barcode: "7890000000032" },
  { name: "Refrigerante Lata 350ml", unit: "un", cost: 250, markup: 50, stock: 100, barcode: "7890000000033" },
  { name: "Refrigerante 2L", unit: "un", cost: 720, markup: 35, stock: 40, barcode: "7890000000034" },
  { name: "Água Mineral 500ml", unit: "un", cost: 120, markup: 80, stock: 150, barcode: "7890000000035" },
  { name: "Água com Gás 500ml", unit: "un", cost: 150, markup: 70, stock: 90, barcode: "7890000000036" },
  { name: "Suco Caixa 1L", unit: "un", cost: 480, markup: 40, stock: 50, barcode: "7890000000037" },
  { name: "Energético 250ml", unit: "un", cost: 590, markup: 50, stock: 60, barcode: "7890000000038" },
  { name: "Gelo 2kg", unit: "un", cost: 600, markup: 50, stock: 30, barcode: "7890000000039" },
  // Bar — doses sem custo (preço manual)
  { name: "Dose de Whisky", unit: "un", price: 1500, stock: 0 },
  { name: "Dose de Vodka", unit: "un", price: 1200, stock: 0 },
  { name: "Caipirinha", unit: "un", price: 1800, stock: 0 },
  // Lanchonete
  { name: "X-Burguer", unit: "un", cost: 650, markup: 60, stock: 0 },
  { name: "X-Salada", unit: "un", cost: 780, markup: 60, stock: 0 },
  { name: "X-Bacon", unit: "un", cost: 950, markup: 55, stock: 0 },
  { name: "Cachorro-Quente", unit: "un", cost: 500, markup: 70, stock: 0 },
  { name: "Batata Frita P", unit: "un", cost: 400, markup: 75, stock: 0 },
  { name: "Coxinha", unit: "un", cost: 280, markup: 80, stock: 40 },
  { name: "Pastel de Carne", unit: "un", cost: 350, markup: 70, stock: 35 },
  { name: "Pão de Queijo", unit: "un", cost: 180, markup: 90, stock: 50 },
  { name: "Açaí 300ml", unit: "un", cost: 700, markup: 60, stock: 0 },
  { name: "Café Expresso", unit: "un", cost: 120, markup: 150, stock: 0 },
];

async function main() {
  // 1) Usuário (cria ou atualiza a senha p/ garantir o login)
  const passwordHash = await hashPassword(PASSWORD);
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, EMAIL))
    .limit(1);

  let userId: string;
  if (existingUser[0]) {
    userId = existingUser[0].id;
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  } else {
    const [u] = await db
      .insert(users)
      .values({ email: EMAIL, passwordHash })
      .returning({ id: users.id });
    userId = u.id;
  }

  // 2) Loja (reusa a do usuário, se já houver; senão cria)
  const membership = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  let tenantId: string;
  if (membership[0]) {
    tenantId = membership[0].tenantId;
    await db
      .update(tenants)
      .set({ name: TENANT_NAME, defaultMarkupPercent: "30.00" })
      .where(eq(tenants.id, tenantId));
  } else {
    const [t] = await db
      .insert(tenants)
      .values({ name: TENANT_NAME, defaultMarkupPercent: "30.00" })
      .returning({ id: tenants.id });
    tenantId = t.id;
    await db
      .insert(tenantMembers)
      .values({ tenantId, userId, role: "owner" });
  }

  // 3) Limpa produtos atuais e insere os 50 (idempotente)
  await db.delete(products).where(eq(products.tenantId, tenantId));

  const rows = CATALOG.map((item) => {
    const isManual = item.price != null;
    const salePriceCents = isManual
      ? item.price!
      : calculateSalePrice(item.cost ?? 0, item.markup ?? 0);
    return {
      tenantId,
      name: item.name,
      barcode: item.barcode ?? null,
      unit: item.unit,
      costCents: isManual ? null : (item.cost ?? null),
      markupPercent: isManual ? null : item.markup?.toString() ?? null,
      salePriceCents,
      priceIsManual: isManual,
      stockQuantity: item.stock.toString(),
    };
  });

  await db.insert(products).values(rows);

  const count = await db
    .select()
    .from(products)
    .where(and(eq(products.tenantId, tenantId)));

  console.log("✓ Conta e loja prontas:");
  console.log(`  e-mail: ${EMAIL}`);
  console.log(`  senha:  ${PASSWORD}`);
  console.log(`  loja:   ${TENANT_NAME} (${tenantId})`);
  console.log(`  produtos cadastrados: ${count.length}`);
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error("✗ Falha no seed:", e);
    process.exit(1);
  },
);
