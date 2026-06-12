"use client";

import * as React from "react";

import { NewPayableForm } from "./NewPayableForm";
import { PayableList } from "./PayableList";

/**
 * Wrapper client para a página /financeiro/pagar.
 * Compartilha `reloadKey` entre o formulário de criação e a lista, de modo que
 * uma nova conta criada pelo formulário dispara o re-fetch da lista imediatamente.
 */
export function PagarView() {
  const [reloadKey, setReloadKey] = React.useState(0);

  return (
    <>
      <section className="grid gap-3">
        <h2 className="font-medium">Nova conta a pagar</h2>
        <NewPayableForm onCreated={() => setReloadKey((k) => k + 1)} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Contas</h2>
        <PayableList reloadKey={reloadKey} />
      </section>
    </>
  );
}
