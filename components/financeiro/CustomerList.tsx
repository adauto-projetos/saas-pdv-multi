import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { centsToBRL } from "@/lib/format/money";
import type { CustomerDto, ReceivableDto } from "@/types/finance";

/**
 * Lista de clientes com o total em aberto por cliente (RF10). O total é a soma do
 * saldo (remainingCents) das contas a receber abertas/parciais do cliente, agregado
 * a partir das receivables carregadas pela página — evita uma chamada por linha.
 */
export function CustomerList({
  customers,
  receivables,
}: {
  customers: CustomerDto[];
  receivables: ReceivableDto[];
}) {
  const owedByCustomer = new Map<string, number>();
  for (const r of receivables) {
    if (r.status === "quitado") continue;
    owedByCustomer.set(
      r.customerId,
      (owedByCustomer.get(r.customerId) ?? 0) + r.remainingCents,
    );
  }

  if (customers.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum cliente cadastrado.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Total em aberto</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {customers.map((c) => {
          const owed = owedByCustomer.get(c.id) ?? 0;
          return (
            <TableRow key={c.id}>
              <TableCell className="font-medium">{c.name}</TableCell>
              <TableCell className="text-muted-foreground">
                {c.phone ?? "—"}
              </TableCell>
              <TableCell
                className={owed > 0 ? "font-mono text-destructive" : "font-mono"}
              >
                {centsToBRL(owed)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
