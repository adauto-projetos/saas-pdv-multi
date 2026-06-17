"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PdvTableCell, PdvTableHead } from "@/components/ui/PdvTable";
import { QuantityInput } from "@/components/ui/QuantityInput";
import {
  Table,
  TableBody,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { centsToBRL } from "@/lib/format/money";

import { itemSubtotal, type CartItem } from "./use-cart";

export function Cart({
  items,
  onSetQuantity,
  onRemove,
}: {
  items: CartItem[];
  onSetQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Carrinho vazio — bipe um produto para começar.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <PdvTableHead>Produto</PdvTableHead>
          <PdvTableHead>Qtd</PdvTableHead>
          <PdvTableHead className="text-right">Subtotal</PdvTableHead>
          <PdvTableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.productId} data-testid="cart-row">
            <PdvTableCell className="font-medium">
              {item.name}
              <span className="ml-1 text-xs text-gray-400">
                ({item.unit})
              </span>
            </PdvTableCell>
            <PdvTableCell className="w-28">
              <QuantityInput
                aria-label={`Quantidade de ${item.name}`}
                value={item.quantity}
                unit={item.unit}
                onChange={(q) =>
                  // Zerar a quantidade remove o item — nunca deixa item com 0 (RN04).
                  q <= 0
                    ? onRemove(item.productId)
                    : onSetQuantity(item.productId, q)
                }
              />
            </PdvTableCell>
            <PdvTableCell className="text-right font-bold text-green-600">
              {centsToBRL(itemSubtotal(item))}
            </PdvTableCell>
            <PdvTableCell>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remover ${item.name}`}
                onClick={() => onRemove(item.productId)}
              >
                <XIcon className="size-4" />
              </Button>
            </PdvTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
