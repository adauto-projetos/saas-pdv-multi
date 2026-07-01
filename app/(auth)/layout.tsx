export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fundo = banner da marca (metade esquerda escura com o logo, metade direita
    // branca). Em telas largas (lg+), a metade esquerda fica livre (mostra a marca)
    // e o formulário centraliza na metade direita (branca). No mobile o banner é
    // largo (desktop) e seria RECORTADO pelo `cover` numa tela estreita — então no
    // mobile usamos um fundo CLARO com o logo completo (`logo-full.webp`, texto
    // escuro legível no claro) acima do card escuro — a mesma composição da metade
    // branca do desktop. A imagem do banner entra a partir de `lg`. `dark` mantém o
    // card azul legível.
    <div className="dark relative flex min-h-screen bg-gradient-to-b from-[#eef3f9] to-[#dbe4f0] bg-cover bg-center bg-no-repeat lg:bg-[url('/background.webp')]">
      <div className="hidden flex-1 lg:block" aria-hidden />
      <div className="flex w-full flex-col items-center justify-center gap-8 px-4 lg:w-1/2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full.webp"
          alt="PDV ART — Bar · Mercado · Lanchonete"
          className="w-full max-w-xs drop-shadow-sm lg:hidden"
        />
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
