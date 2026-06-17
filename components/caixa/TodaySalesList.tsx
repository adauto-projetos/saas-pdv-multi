"use client";

import { PageCard, PageCardHeader } from "@/components/ui/PageCard";
import { StatCard } from "@/components/ui/StatCard";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import { centsToBRL } from "@/lib/format/money";
import type { PaymentMethod, SaleDto } from "@/types/sale";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  cartao: "Cartão",
  fiado: "Fiado",
};

export function TodaySalesList({ sales }: { sales: SaleDto[] }) {
  const total = sales.reduce((sum, s) => sum + s.totalCents, 0);
  const ticket = sales.length ? Math.round(total / sales.length) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          label="Total do dia"
          value={centsToBRL(total)}
          sub="Faturamento hoje"
        />
        <StatCard
          label="Vendas"
          value={sales.length}
          sub="Transações hoje"
        />
        <StatCard
          label="Ticket médio"
          value={centsToBRL(ticket)}
          sub="Por venda"
        />
      </div>

      <PageCard>
        <PageCardHeader>Histórico do dia</PageCardHeader>
        {sales.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">
            Nenhuma venda hoje ainda.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <PdvTableHead>Hora</PdvTableHead>
                <PdvTableHead>Itens</PdvTableHead>
                <PdvTableHead>Pagamento</PdvTableHead>
                <PdvTableHead className="text-right">Total</PdvTableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <PdvTableCell>
                    {new Date(sale.createdAt).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </PdvTableCell>
                  <PdvTableCell>{sale.items.length}</PdvTableCell>
                  <PdvTableCell>
                    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                      {PAYMENT_LABELS[sale.paymentMethod]}
                    </span>
                  </PdvTableCell>
                  <PdvTableCell className="text-right font-bold text-gray-900">
                    {centsToBRL(sale.totalCents)}
                  </PdvTableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageCard>
    </div>
  );
}
