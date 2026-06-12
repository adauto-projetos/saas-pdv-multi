import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToBRL } from "@/lib/format/money";

/** Card do saldo corrente do caixa (RF03). */
export function CashBalanceCard({ balanceCents }: { balanceCents: number }) {
  const negative = balanceCents < 0;

  return (
    <Card className="w-fit min-w-60">
      <CardHeader>
        <CardDescription>Saldo do caixa</CardDescription>
        <CardTitle
          className={
            negative
              ? "font-mono text-2xl text-destructive"
              : "font-mono text-2xl"
          }
        >
          {centsToBRL(balanceCents)}
        </CardTitle>
      </CardHeader>
    </Card>
  );
}
