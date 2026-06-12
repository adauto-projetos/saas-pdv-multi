"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centsToBRL } from "@/lib/format/money";
import type { PaymentMethod, SaleDto } from "@/types/sale";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  fiado: "Fiado",
};

export function TodaySalesList({ sales }: { sales: SaleDto[] }) {
  if (sales.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhuma venda hoje ainda.
      </p>
    );
  }

  const total = sales.reduce((sum, s) => sum + s.totalCents, 0);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        {sales.length} venda(s) · total{" "}
        <span className="font-mono font-medium text-foreground">
          {centsToBRL(total)}
        </span>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hora</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Pagamento</TableHead>
            <TableHead>Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map((sale) => (
            <TableRow key={sale.id}>
              <TableCell>
                {new Date(sale.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </TableCell>
              <TableCell>{sale.items.length}</TableCell>
              <TableCell>
                <Badge variant="outline">
                  {PAYMENT_LABELS[sale.paymentMethod]}
                </Badge>
              </TableCell>
              <TableCell className="font-mono">
                {centsToBRL(sale.totalCents)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
