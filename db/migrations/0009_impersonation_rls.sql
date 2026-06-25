-- ============================================================================
-- 0009_impersonation_rls.sql — Impersonação do super admin (feature 0011F SF03)
-- ----------------------------------------------------------------------------
-- `app_user` e `current_app_user()` já existem (0001_rls.sql).
-- Aplicado por `npm run db:rls` (apply-rls.ts aplica *_rls.sql em ordem; este é o
-- ÚLTIMO, então redefine funções e repõe as políticas das migrations anteriores).
--
-- Objetivo: o founder (super admin) pode "entrar" numa loja da qual NÃO é membro.
-- Centralizamos o conjunto de tenants acessíveis em current_app_tenants():
--   (a) memberships normais (tenant_members)  ∪
--   (b) o tenant impersonado (GUC app.impersonate_tenant_id) — SOMENTE se founder.
--
-- Defesa em profundidade (RN03): mesmo que a GUC seja setada para um não-founder,
-- current_app_is_founder() retorna false e o tenant impersonado NÃO entra no set.
-- A app (withUserRls) só seta a GUC quando o cookie é de um founder; o banco
-- confere de novo. Duas barreiras independentes.
-- ============================================================================

-- O usuário da sessão é founder? Lê users.is_founder do current_app_user().
-- SQL STABLE (não SECURITY DEFINER): roda com a RLS do app_user — a policy
-- user_self_read já permite ao usuário ler a própria linha (id = current_app_user()).
CREATE OR REPLACE FUNCTION current_app_is_founder() RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (SELECT "is_founder" FROM "users" WHERE "id" = current_app_user()),
    false
  )
$$;

-- Conjunto de tenants que a sessão atual pode acessar.
-- (a) lojas das quais o usuário é membro; (b) loja impersonada, se founder.
CREATE OR REPLACE FUNCTION current_app_tenants() RETURNS SETOF uuid
  LANGUAGE sql STABLE AS $$
  SELECT "tenant_id" FROM "tenant_members" WHERE "user_id" = current_app_user()
  UNION
  SELECT NULLIF(current_setting('app.impersonate_tenant_id', true), '')::uuid
  WHERE current_app_is_founder()
    AND NULLIF(current_setting('app.impersonate_tenant_id', true), '') IS NOT NULL
$$;

-- ----------------------------------------------------------------------------
-- tenants: leitura/atualização da própria loja OU da loja impersonada (founder).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "tenant_self_read" ON "tenants";
CREATE POLICY "tenant_self_read" ON "tenants"
  FOR SELECT TO app_user
  USING ("id" IN (SELECT current_app_tenants()));

DROP POLICY IF EXISTS "tenant_self_update" ON "tenants";
CREATE POLICY "tenant_self_update" ON "tenants"
  FOR UPDATE TO app_user
  USING ("id" IN (SELECT current_app_tenants()))
  WITH CHECK ("id" IN (SELECT current_app_tenants()));

-- ----------------------------------------------------------------------------
-- Repõe tenant_isolation em TODAS as tabelas de negócio usando current_app_tenants().
-- Mesma forma para todas: tenant_id IN (SELECT current_app_tenants()).
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
  business_tables text[] := ARRAY[
    'products',
    'sales',
    'sale_items',
    'stock_movements',
    'customers',
    'cash_movements',
    'receivables',
    'receivable_payments',
    'payables',
    'payable_payments',
    'cash_sessions',
    'comandas',
    'comanda_items',
    'print_logs',
    'kitchen_order_seqs',
    'subscription_log'
  ];
BEGIN
  FOREACH tbl IN ARRAY business_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation" ON %I', tbl);
    EXECUTE format($f$
      CREATE POLICY "tenant_isolation" ON %I
        FOR ALL TO app_user
        USING ("tenant_id" IN (SELECT current_app_tenants()))
        WITH CHECK ("tenant_id" IN (SELECT current_app_tenants()))
    $f$, tbl);
  END LOOP;
END $$;
