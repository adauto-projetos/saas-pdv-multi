CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_markup_percent" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_members_tenant_user_unique" UNIQUE("tenant_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"barcode" text,
	"unit" text NOT NULL,
	"cost_cents" integer,
	"markup_percent" numeric(5, 2),
	"sale_price_cents" integer NOT NULL,
	"price_is_manual" boolean DEFAULT false NOT NULL,
	"stock_quantity" numeric(10, 3) DEFAULT '0' NOT NULL,
	"min_stock" numeric(10, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_cost_cents_non_negative" CHECK ("products"."cost_cents" >= 0),
	CONSTRAINT "products_sale_price_cents_non_negative" CHECK ("products"."sale_price_cents" >= 0),
	CONSTRAINT "products_unit_valid" CHECK ("products"."unit" in ('un', 'kg'))
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"total_cents" integer NOT NULL,
	"payment_method" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_total_cents_non_negative" CHECK ("sales"."total_cents" >= 0),
	CONSTRAINT "sales_payment_method_valid" CHECK ("sales"."payment_method" in ('dinheiro', 'pix', 'cartao'))
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid,
	"name_snapshot" text NOT NULL,
	"unit" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"subtotal_cents" integer NOT NULL,
	CONSTRAINT "sale_items_unit_price_non_negative" CHECK ("sale_items"."unit_price_cents" >= 0),
	CONSTRAINT "sale_items_subtotal_non_negative" CHECK ("sale_items"."subtotal_cents" >= 0),
	CONSTRAINT "sale_items_quantity_positive" CHECK ("sale_items"."quantity" > 0),
	CONSTRAINT "sale_items_unit_valid" CHECK ("sale_items"."unit" in ('un', 'kg'))
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"type" text NOT NULL,
	"quantity" numeric(10, 3) NOT NULL,
	"reason" text,
	"sale_id" uuid,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_type_valid" CHECK ("stock_movements"."type" in ('entrada', 'saida', 'ajuste')),
	CONSTRAINT "stock_movements_quantity_sign" CHECK ("stock_movements"."type" = 'ajuste' or ("stock_movements"."type" = 'entrada' and "stock_movements"."quantity" > 0) or ("stock_movements"."type" = 'saida' and "stock_movements"."quantity" < 0))
);
--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "products_tenant_barcode_unique" ON "products" USING btree ("tenant_id","barcode") WHERE "products"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "products_tenant_id_idx" ON "products" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "sales_tenant_created_idx" ON "sales" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_tenant_idx" ON "sale_items" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_product_created_idx" ON "stock_movements" USING btree ("tenant_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_tenant_idx" ON "stock_movements" USING btree ("tenant_id");