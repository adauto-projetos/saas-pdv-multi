-- ============================================================================
-- 0011_override_rls.sql — RLS da tabela override_log (feature 0014F SF02)
-- ----------------------------------------------------------------------------
-- `app_user`, `current_app_user()` e `current_app_tenants()` já existem
-- (0001/0009). Ordena DEPOIS deles em `npm run db:rls` (ordem alfabética) — é o
-- novo ÚLTIMO *_rls.sql aplicado.
--
-- Isola override_log por tenant (RNF01), como as demais business tables. A
-- restrição extra de leitura (só owner/gerenciar_usuarios) é da camada de serviço
-- (SF04) — a RLS garante a barreira por tenant.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "override_log" TO app_user;

ALTER TABLE "override_log" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "override_log";
CREATE POLICY "tenant_isolation" ON "override_log"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT current_app_tenants()))
  WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()));
