-- ============================================================================
-- 0008_subscription_rls.sql — RLS da tabela subscription_log (feature 0011F SF01)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- Tabela: subscription_log
-- ============================================================================

-- subscription_log: append-only audit trail — SELECT + INSERT apenas (sem UPDATE/DELETE).
-- RN04: histórico de assinatura nunca apagado nem alterado por app_user.
-- Política usa FOR ALL; UPDATE/DELETE são bloqueados pelo GRANT acima (defesa em profundidade).
GRANT SELECT, INSERT ON "subscription_log" TO app_user;

ALTER TABLE "subscription_log" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "subscription_log";
CREATE POLICY "tenant_isolation" ON "subscription_log"
  FOR ALL TO app_user
  USING (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  )
  WITH CHECK (
    "tenant_id" IN (
      SELECT "tenant_id" FROM "tenant_members"
      WHERE "user_id" = current_app_user()
    )
  );
