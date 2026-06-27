-- ============================================================================
-- 0010_usuarios_rls.sql — RLS da tabela user_permissions (feature 0014F SF01)
-- ----------------------------------------------------------------------------
-- `app_user`, `current_app_user()` e `current_app_tenants()` já existem
-- (0001_rls.sql / 0009_impersonation_rls.sql). Este arquivo ordena DEPOIS do 0009
-- em `npm run db:rls` (apply-rls.ts aplica *_rls.sql em ordem alfabética).
--
-- Objetivo: isolar user_permissions por tenant, como as demais business tables.
-- A leitura do próprio menu (operador lê as próprias linhas) e a escrita do dono
-- (CRUD de operador roda na conexão `db`/owner, que bypassa RLS) são cobertas:
--   • app_user (operador via withUserRls) lê/escreve só linhas do seu tenant;
--   • o anti-escalonamento (quem pode conceder o quê) é regra de NEGÓCIO, no
--     serviço (lib/services/permissions) — RLS é a última linha de defesa (RNF01/RNF02).
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON "user_permissions" TO app_user;

ALTER TABLE "user_permissions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "user_permissions";
CREATE POLICY "tenant_isolation" ON "user_permissions"
  FOR ALL TO app_user
  USING ("tenant_id" IN (SELECT current_app_tenants()))
  WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()));
