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
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[5fr_7fr]">
      <section className="grid min-w-0 gap-3">
        <h2 className="font-medium">Nova conta a pagar</h2>
        <NewPayableForm onCreated={() => setReloadKey((k) => k + 1)} />
      </section>

      <section className="grid min-w-0 gap-3">
        <h2 className="font-medium">Contas</h2>
        <PayableList reloadKey={reloadKey} />
      </section>
    </div>
  );
}
