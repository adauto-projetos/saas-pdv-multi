-- ============================================================================
-- 0008_subscription_lifecycle.sql — Ciclo de vida de assinatura (feature 0011F SF01)
-- ----------------------------------------------------------------------------
-- Estende `tenants` e `users` com colunas de assinatura e cria `subscription_log`
-- como audit trail append-only de cada mudança de estado (trial/renovação/suspensão).
-- ============================================================================

-- tenants: valid_until define até quando a loja está paga/em trial (nullable).
-- suspended_at: quando preenchida, força status 'travada' independente de valid_until (RN03).
ALTER TABLE "tenants" ADD COLUMN "valid_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "suspended_at" timestamp with time zone;--> statement-breakpoint

-- users: is_founder distingue o dono da plataforma dos donos de loja (RF07).
ALTER TABLE "users" ADD COLUMN "is_founder" boolean NOT NULL DEFAULT false;--> statement-breakpoint

-- subscription_log: audit trail imutável de cada liberação/suspensão de tenant.
-- app_user só pode SELECT + INSERT (append-only por GRANT em 0008_subscription_rls.sql).
CREATE TABLE "subscription_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"action" text NOT NULL,
	"valid_until_before" timestamp with time zone,
	"valid_until_after" timestamp with time zone,
	"by_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_log_action_valid" CHECK ("subscription_log"."action" IN ('trial_started', 'renewed', 'suspended', 'released'))
);--> statement-breakpoint

ALTER TABLE "subscription_log" ADD CONSTRAINT "subscription_log_tenant_id_tenants_id_fk"
  FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "subscription_log" ADD CONSTRAINT "subscription_log_by_user_id_users_id_fk"
  FOREIGN KEY ("by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

-- Índice primário: histórico por tenant ordenado do mais recente para o mais antigo.
CREATE INDEX "subscription_log_tenant_at_idx" ON "subscription_log" USING btree ("tenant_id", "at" DESC);--> statement-breakpoint

-- Índice secundário: filtragem por ação (ex: detectar se houve 'renewed').
CREATE INDEX "subscription_log_tenant_action_idx" ON "subscription_log" USING btree ("tenant_id", "action");
