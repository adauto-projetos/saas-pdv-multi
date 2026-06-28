import { listOperatorsAction } from "@/app/(app)/usuarios/actions";
import { UsuariosClient } from "@/app/(app)/usuarios/UsuariosClient";
import { getMaxOperators } from "@/lib/services/platform/settings-repository";

export const dynamic = "force-dynamic";

export const metadata = { title: "Usuários — PDV.ART.br" };

export default async function UsuariosPage() {
  const [result, maxOperators] = await Promise.all([
    listOperatorsAction(),
    getMaxOperators(),
  ]);

  return (
    <div className="flex flex-col gap-5 px-4 md:px-7 py-6">
      <h1
        style={{
          fontFamily: "var(--font-jakarta)",
          fontWeight: 800,
          fontSize: 24,
          margin: 0,
          color: "#0f172a",
        }}
      >
        Usuários
      </h1>
      <p className="text-sm text-gray-400 -mt-3">
        Cadastre operadores e escolha, função por função, o que cada um pode
        acessar. O dono tem acesso a tudo.
      </p>

      {!result.ok ? (
        <p className="text-sm text-destructive">
          Você não tem permissão para gerenciar usuários.
        </p>
      ) : (
        <UsuariosClient operators={result.data} maxOperators={maxOperators} />
      )}
    </div>
  );
}
