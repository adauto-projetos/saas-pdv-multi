import { listCustomersAction } from "@/app/(app)/financeiro/customers/actions";
import { listReceivablesAction } from "@/app/(app)/financeiro/receber/actions";
import { CustomerForm } from "@/components/financeiro/CustomerForm";
import { CustomerList } from "@/components/financeiro/CustomerList";
import { PageCard } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [customersResult, receivablesResult] = await Promise.all([
    listCustomersAction({}),
    listReceivablesAction({}),
  ]);

  return (
    <div className="flex flex-col gap-6 px-4 md:px-7 py-6 max-w-[1280px]">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
        <section className="grid min-w-0 gap-3">
          <h2 className="font-medium">Novo cliente</h2>
          <CustomerForm />
        </section>

        <section className="grid min-w-0 gap-3">
          <h2 className="font-medium">Clientes cadastrados</h2>
          <PageCard className="min-w-0">
            {customersResult.ok ? (
              <div className="overflow-x-auto">
                <CustomerList
                  customers={customersResult.data}
                  receivables={receivablesResult.ok ? receivablesResult.data : []}
                />
              </div>
            ) : (
              <p className="p-5 text-destructive">
                Não foi possível carregar os clientes.
              </p>
            )}
          </PageCard>
        </section>
      </div>
    </div>
  );
}
