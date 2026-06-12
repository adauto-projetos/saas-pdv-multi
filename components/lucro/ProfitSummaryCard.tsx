import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { centsToBRL } from "@/lib/format/money";
import type { ProfitDto } from "@/types/profit";

/**
 * RF02/RF03 — resumo do lucro do período: faturamento, custo, lucro
 * (verde se ≥0, vermelho se <0) e margem %. Avisa quando há itens sem custo
 * cadastrado (lucro superestimado — RN04).
 */
export function ProfitSummaryCard({ profit }: { profit: ProfitDto }) {
  const loss = profit.profitCents < 0;

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardDescription>Lucro do período</CardDescription>
        <CardTitle
          className={
            loss
              ? "font-mono text-2xl text-destructive"
              : "font-mono text-2xl text-primary"
          }
        >
          {centsToBRL(profit.profitCents)}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Faturamento</span>
          <span className="font-mono">{centsToBRL(profit.revenueCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Custo</span>
          <span className="font-mono">{centsToBRL(profit.costCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Margem</span>
          <span
            className={loss ? "font-mono text-destructive" : "font-mono"}
          >
            {profit.marginPercent}%
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Vendas</span>
          <span className="font-mono">{profit.salesCount}</span>
        </div>

        {profit.itemsWithoutCost > 0 ? (
          <p className="mt-1 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            Lucro superestimado: {profit.itemsWithoutCost}{" "}
            {profit.itemsWithoutCost === 1
              ? "item sem custo cadastrado"
              : "itens sem custo cadastrado"}{" "}
            (contam como custo zero).
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
