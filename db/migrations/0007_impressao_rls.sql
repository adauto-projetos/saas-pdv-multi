-- ============================================================================
-- 0007_impressao_rls.sql — RLS das tabelas print_logs + kitchen_order_seqs (feature 0007F)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` junto com os demais *_rls.sql.
-- Tabelas: print_logs, kitchen_order_seqs
-- ============================================================================

-- print_logs: append-only audit trail — SELECT + INSERT apenas (sem UPDATE/DELETE).
-- Política usa FOR ALL; UPDATE/DELETE são bloqueados pelo GRANT acima (defesa em profundidade).
GRANT SELECT, INSERT ON "print_logs" TO app_user;

ALTER TABLE "print_logs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "print_logs";
CREATE POLICY "tenant_isolation" ON "print_logs"
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

-- kitchen_order_seqs: upsert atômico requer UPDATE além de INSERT.
GRANT SELECT, INSERT, UPDATE ON "kitchen_order_seqs" TO app_user;

ALTER TABLE "kitchen_order_seqs" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON "kitchen_order_seqs";
CREATE POLICY "tenant_isolation" ON "kitchen_order_seqs"
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
