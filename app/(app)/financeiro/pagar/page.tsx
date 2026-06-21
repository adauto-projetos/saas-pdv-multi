import { PagarView } from "@/components/financeiro/PagarView";

export const dynamic = "force-dynamic";

export default function PagarPage() {
  return (
    <div className="grid gap-8 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Contas a pagar</h1>
      <PagarView />
    </div>
  );
}
