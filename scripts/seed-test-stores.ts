import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

import { db } from "../db";
import { products, tenantMembers, tenants, users } from "../db/schema";
import { hashPassword } from "../lib/auth/password";
import { calculateSalePrice } from "../lib/services/products/markup";

const PASSWORD = "123456";

type Unit = "un" | "kg";
type Item = {
  name: string;
  unit: Unit;
  cost?: number; // centavos
  markup?: number; // %
  price?: number; // preço manual (centavos)
  stock: number;
  barcode?: string;
};

type Store = {
  email: string;
  tenantName: string;
  catalog: Item[];
};

const STORES: Store[] = [
  {
    email: "mercado@teste.com",
    tenantName: "Mercado Central",
    catalog: [
      { name: "Arroz Branco 5kg", unit: "un", cost: 2200, markup: 30, stock: 40, barcode: "7891000000101" },
      { name: "Feijão Carioca 1kg", unit: "un", cost: 750, markup: 35, stock: 60, barcode: "7891000000102" },
      { name: "Açúcar Refinado 1kg", unit: "un", cost: 420, markup: 30, stock: 50, barcode: "7891000000103" },
      { name: "Café Torrado 500g", unit: "un", cost: 1500, markup: 40, stock: 30, barcode: "7891000000104" },
      { name: "Óleo de Soja 900ml", unit: "un", cost: 690, markup: 25, stock: 45, barcode: "7891000000105" },
      { name: "Leite Integral 1L", unit: "un", cost: 520, markup: 28, stock: 80, barcode: "7891000000106" },
      { name: "Banana Prata", unit: "kg", cost: 380, markup: 40, stock: 25.5 },
      { name: "Tomate", unit: "kg", cost: 590, markup: 45, stock: 18 },
      { name: "Batata", unit: "kg", cost: 420, markup: 50, stock: 30 },
      { name: "Sabão em Pó 1kg", unit: "un", cost: 1290, markup: 30, stock: 25, barcode: "7891000000107" },
    ],
  },
  {
    email: "bar@teste.com",
    tenantName: "Bar do Zé",
    catalog: [
      { name: "Cerveja Lata 350ml", unit: "un", cost: 290, markup: 55, stock: 120, barcode: "7892000000201" },
      { name: "Cerveja Long Neck 355ml", unit: "un", cost: 450, markup: 60, stock: 80, barcode: "7892000000202" },
      { name: "Refrigerante Lata 350ml", unit: "un", cost: 250, markup: 50, stock: 100, barcode: "7892000000203" },
      { name: "Água Mineral 500ml", unit: "un", cost: 120, markup: 80, stock: 150, barcode: "7892000000204" },
      { name: "Energético 250ml", unit: "un", cost: 590, markup: 50, stock: 60, barcode: "7892000000205" },
      { name: "Gelo 2kg", unit: "un", cost: 600, markup: 50, stock: 30, barcode: "7892000000206" },
      { name: "Dose de Whisky", unit: "un", price: 1500, stock: 0 },
      { name: "Caipirinha", unit: "un", price: 1800, stock: 0 },
      { name: "Amendoim 100g", unit: "un", cost: 180, markup: 90, stock: 40, barcode: "7892000000207" },
      { name: "Porção de Batata", unit: "un", cost: 800, markup: 75, stock: 0 },
    ],
  },
  {
    email: "lanchonete@teste.com",
    tenantName: "Lanchonete da Praça",
    catalog: [
      { name: "X-Burguer", unit: "un", cost: 650, markup: 60, stock: 0 },
      { name: "X-Salada", unit: "un", cost: 780, markup: 60, stock: 0 },
      { name: "X-Bacon", unit: "un", cost: 950, markup: 55, stock: 0 },
      { name: "Cachorro-Quente", unit: "un", cost: 500, markup: 70, stock: 0 },
      { name: "Batata Frita P", unit: "un", cost: 400, markup: 75, stock: 0 },
      { name: "Coxinha", unit: "un", cost: 280, markup: 80, stock: 40 },
      { name: "Pastel de Carne", unit: "un", cost: 350, markup: 70, stock: 35 },
      { name: "Pão de Queijo", unit: "un", cost: 180, markup: 90, stock: 50 },
      { name: "Açaí 300ml", unit: "un", cost: 700, markup: 60, stock: 0 },
      { name: "Refrigerante Lata 350ml", unit: "un", cost: 250, markup: 50, stock: 60, barcode: "7893000000301" },
    ],
  },
];

async function seedStore(store: Store) {
  const passwordHash = await hashPassword(PASSWORD);

  // 1) Usuário (cria ou atualiza senha)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, store.email))
    .limit(1);

  let userId: string;
  if (existing[0]) {
    userId = existing[0].id;
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  } else {
    const [u] = await db
      .insert(users)
      .values({ email: store.email, passwordHash })
      .returning({ id: users.id });
    userId = u.id;
  }

  // 2) Loja (reusa a do usuário se houver; senão cria com 30 dias de validade)
  const membership = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let tenantId: string;
  if (membership[0]) {
    tenantId = membership[0].tenantId;
    await db
      .update(tenants)
      .set({ name: store.tenantName, defaultMarkupPercent: "30.00", validUntil, suspendedAt: null })
      .where(eq(tenants.id, tenantId));
  } else {
    const [t] = await db
      .insert(tenants)
      .values({ name: store.tenantName, defaultMarkupPercent: "30.00", validUntil })
      .returning({ id: tenants.id });
    tenantId = t.id;
    await db.insert(tenantMembers).values({ tenantId, userId, role: "owner" });
  }

  // 3) Produtos (idempotente: limpa e reinsere)
  await db.delete(products).where(eq(products.tenantId, tenantId));
  const rows = store.catalog.map((item) => {
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

  return { tenantId, count: rows.length };
}

async function main() {
  console.log("Criando 3 lojas de teste...\n");
  for (const store of STORES) {
    const { tenantId, count } = await seedStore(store);
    console.log(`✓ ${store.tenantName}`);
    console.log(`    login: ${store.email}  |  senha: ${PASSWORD}`);
    console.log(`    tenant: ${tenantId}  |  produtos: ${count}\n`);
  }
}

void main().then(
  () => process.exit(0),
  (e) => {
    console.error("✗ Falha no seed:", e);
    process.exit(1);
  },
);
