import Link from "next/link";

import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import { InfoButton } from "@/components/ui/help-tip";
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
          <PdvTableHead>
            <span className="inline-flex items-center gap-1">
              Estoque baixo
              <InfoButton
                title="O que é estoque baixo?"
                detail={"São os produtos que estão com quantidade menor ou igual ao estoque mínimo que você configurou.\n\nQuando um produto aparece aqui, é hora de pedir mais para o fornecedor antes que acabe.\n\nVocê configura o estoque mínimo de cada produto na tela de Produtos (botão Editar)."}
              />
            </span>
          </PdvTableHead>
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
