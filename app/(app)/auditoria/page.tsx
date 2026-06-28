import { getAuditAction } from "@/app/(app)/auditoria/actions";
import { AuditoriaClient } from "@/app/(app)/auditoria/AuditoriaClient";

export const dynamic = "force-dynamic";

export const metadata = { title: "Auditoria — PDV.ART.br" };

export default async function AuditoriaPage() {
  const result = await getAuditAction();

  return (
    <div className="flex flex-col gap-5 px-4 md:px-7 py-6 max-w-[1280px]">
      <h1
        style={{
          fontFamily: "var(--font-jakarta)",
          fontWeight: 800,
          fontSize: 24,
          margin: 0,
          color: "#0f172a",
        }}
      >
        Auditoria
      </h1>
      <p className="text-sm text-gray-400 -mt-3">
        Quem fez o quê por operador e período: vendas, caixas, comandas e
        movimentações.
      </p>

      {!result.ok ? (
        <p className="text-sm text-destructive">
          Você não tem permissão para ver a auditoria.
        </p>
      ) : (
        <AuditoriaClient initial={result.data} />
      )}
    </div>
  );
}
