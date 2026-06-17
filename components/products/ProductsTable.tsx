import Link from "next/link";

import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import {
  Table,
  TableBody,
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
          <PdvTableHead>Produto</PdvTableHead>
          <PdvTableHead className="text-right">Preço de venda</PdvTableHead>
          <PdvTableHead className="text-center">Un.</PdvTableHead>
          <PdvTableHead className="text-right">Estoque</PdvTableHead>
          <PdvTableHead className="text-center">Ações</PdvTableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products.map((product) => (
          <TableRow key={product.id}>
            <PdvTableCell className="font-medium">{product.name}</PdvTableCell>
            <PdvTableCell className="text-right font-semibold text-green-600">
              {centsToBRL(product.salePriceCents)}
            </PdvTableCell>
            <PdvTableCell className="text-center text-gray-500">
              {product.unit}
            </PdvTableCell>
            <PdvTableCell
              data-testid="stock-cell"
              className={[
                "text-right font-medium",
                product.stockQuantity < 0
                  ? "text-destructive"
                  : product.stockQuantity === 0
                    ? "text-red-500"
                    : "",
              ].join(" ")}
            >
              {product.stockQuantity}
            </PdvTableCell>
            <PdvTableCell className="text-center">
              <Link
                href={`/products/${product.id}/edit`}
                className="text-[12px] font-medium text-green-600 hover:underline"
              >
                Editar
              </Link>
            </PdvTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
