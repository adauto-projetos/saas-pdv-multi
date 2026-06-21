import { ReceberView } from "@/components/financeiro/ReceberView";

export const dynamic = "force-dynamic";

export default function ReceberPage() {
  return (
    <div className="grid gap-8 px-4 md:px-7 py-6">
      <h1 className="text-xl font-semibold">Contas a receber</h1>
      <ReceberView />
    </div>
  );
}
