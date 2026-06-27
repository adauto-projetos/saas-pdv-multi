import { ManualContent } from "@/components/manual/ManualContent";

export const dynamic = "force-dynamic";

export const metadata = { title: "Manual — SAAS PDV.multi" };

export default function ManualPage() {
  return (
    <div className="flex flex-col gap-5 px-4 md:px-7 py-6 max-w-[1280px]">
      <div>
        <h1
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: 24,
            margin: 0,
            color: "#0f172a",
          }}
        >
          Manual do app
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Guia completo de todas as áreas. Dica: ligue o “Modo Ajuda” na barra
          lateral para ver explicações em cima de cada tela enquanto trabalha.
        </p>
      </div>
      <ManualContent />
    </div>
  );
}
