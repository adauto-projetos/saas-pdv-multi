import { listCustomersAction } from "@/app/(app)/financeiro/customers/actions";
import { listReceivablesAction } from "@/app/(app)/financeiro/receber/actions";
import { CustomerForm } from "@/components/financeiro/CustomerForm";
import { CustomerList } from "@/components/financeiro/CustomerList";

export const dynamic = "force-dynamic";

export default async function ClientesPage() {
  const [customersResult, receivablesResult] = await Promise.all([
    listCustomersAction({}),
    listReceivablesAction({}),
  ]);

  return (
    <div className="grid gap-8 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <section className="grid gap-3">
        <h2 className="font-medium">Novo cliente</h2>
        <CustomerForm />
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Clientes cadastrados</h2>
        {customersResult.ok ? (
          <CustomerList
            customers={customersResult.data}
            receivables={receivablesResult.ok ? receivablesResult.data : []}
          />
        ) : (
          <p className="text-destructive">
            Não foi possível carregar os clientes.
          </p>
        )}
      </section>
    </div>
  );
}
