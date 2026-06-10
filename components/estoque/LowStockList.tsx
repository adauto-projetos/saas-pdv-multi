import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductDto } from "@/types/product";

/** RF07 — produtos com estoque baixo (≤ mínimo). */
export function LowStockList({ products }: { products: ProductDto[] }) {
  if (products.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum produto com estoque baixo. 🎉
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Estoque</TableHead>
          <TableHead>Mínimo</TableHead>
          <TableHead className="text-right">Movimentações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id} data-testid="low-row">
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell
              className={
                product.stockQuantity < 0 ? "text-destructive" : undefined
              }
            >
              {product.stockQuantity}
            </TableCell>
            <TableCell>{product.minStock ?? "—"}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/estoque/${product.id}`}
                className="text-sm text-primary hover:underline"
              >
                Histórico
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
