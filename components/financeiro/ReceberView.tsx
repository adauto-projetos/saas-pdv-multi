"use client";

import * as React from "react";

import { NewReceivableForm } from "./NewReceivableForm";
import { ReceivableList } from "./ReceivableList";

/**
 * Wrapper client para a página /financeiro/receber.
 * Compartilha `reloadKey` entre o formulário de criação e a lista, de modo que
 * uma nova conta criada pelo formulário dispara o re-fetch da lista imediatamente
 * (sem depender de router.refresh() que não reseta o estado do client component).
 */
export function ReceberView() {
  const [reloadKey, setReloadKey] = React.useState(0);

  return (
    <>
      <section className="grid gap-3">
        <h2 className="font-medium">Nova conta a receber</h2>
        <NewReceivableForm onCreated={() => setReloadKey((k) => k + 1)} />
      </section>

      <section className="grid gap-3">
        <h2 className="font-medium">Contas</h2>
        <ReceivableList reloadKey={reloadKey} />
      </section>
    </>
  );
}
