-- ============================================================================
-- 0012_categorias_rls.sql — RLS da tabela product_categories (feature 0025F)
-- ----------------------------------------------------------------------------
-- `app_user`, `current_app_user()` e `current_app_tenants()` já existem
-- (0001/0009). Ordena DEPOIS deles em `npm run db:rls` (ordem alfabética) — é o
-- novo ÚLTIMO *_rls.sql aplicado.
--
-- Isola product_categories por tenant (RN02/RNF01), como as demais business
-- tables. Guard de tenant no `categoryId` do produto (checagem no service,
-- porque a FK do Postgres é validada como owner e não passa pela RLS) fica na
-- camada de serviço — este arquivo garante só a barreira por tenant no banco.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "product_categories" TO app_user;

ALTER TABLE "product_categories" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "product_categories";
CREATE POLICY "tenant_isolation" ON "product_categories"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT current_app_tenants()))
  WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()));
