"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { QuantityInput } from "@/components/ui/QuantityInput";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
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
          <TableHead>Produto</TableHead>
          <TableHead>Qtd</TableHead>
          <TableHead>Subtotal</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.productId} data-testid="cart-row">
            <TableCell className="font-medium">
              {item.name}
              <span className="ml-1 text-xs text-muted-foreground">
                ({item.unit})
              </span>
            </TableCell>
            <TableCell className="w-28">
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
            </TableCell>
            <TableCell className="font-mono">
              {centsToBRL(itemSubtotal(item))}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remover ${item.name}`}
                onClick={() => onRemove(item.productId)}
              >
                <XIcon className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
