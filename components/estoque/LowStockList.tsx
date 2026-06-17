import Link from "next/link";

import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import type { ProductDto } from "@/types/product";

/** RF07 — produtos com estoque baixo (≤ mínimo). */
export function LowStockList({ products }: { products: ProductDto[] }) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-8 text-center text-sm text-muted-foreground">
        Nenhum produto com estoque baixo.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <PdvTableHead>Produto</PdvTableHead>
          <PdvTableHead className="text-right">Estoque</PdvTableHead>
          <PdvTableHead className="text-right">Mínimo</PdvTableHead>
          <PdvTableHead className="text-right">Movimentações</PdvTableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} data-testid="low-row">
            <PdvTableCell className="font-medium">{product.name}</PdvTableCell>
            <PdvTableCell
              className={[
                "text-right font-bold",
                product.stockQuantity < 0 ? "text-red-500" : "text-red-500",
              ].join(" ")}
            >
              {product.stockQuantity}
            </PdvTableCell>
            <PdvTableCell className="text-right text-gray-500">
              {product.minStock ?? "—"}
            </PdvTableCell>
            <PdvTableCell className="text-right">
              <Link
                href={`/estoque/${product.id}`}
                className="text-[12px] font-medium text-green-600 hover:underline"
              >
                Histórico
              </Link>
            </PdvTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
