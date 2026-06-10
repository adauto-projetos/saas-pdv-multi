import Link from "next/link";

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
import type { ProductDto } from "@/types/product";

/**
 * Lista de produtos (RF07). Estoque é SOMENTE LEITURA (RF08) — exibido como texto,
 * sem nenhum controle editável; movimentação fica na feature de Estoque.
 */
export function ProductsTable({ products }: { products: ProductDto[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Preço de venda</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Estoque</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <TableCell className="font-medium">{product.name}</TableCell>
            <TableCell className="font-mono">
              {centsToBRL(product.salePriceCents)}
            </TableCell>
            <TableCell>
              <Badge variant="outline">{product.unit}</Badge>
            </TableCell>
            <TableCell data-testid="stock-cell">
              {product.stockQuantity}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/products/${product.id}/edit`}
                className="text-sm text-primary hover:underline"
              >
                Editar
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
