export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // Fundo = banner da marca (metade esquerda escura com o logo, metade direita
    // branca). Em telas largas, a metade esquerda fica livre (mostra a marca) e o
    // formulário centraliza na metade direita (branca). Em telas estreitas, o
    // formulário centraliza na tela toda. `dark` mantém o card azul legível.
    <div
      className="dark relative flex min-h-screen"
      style={{
        backgroundImage: "url('/background.webp')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="hidden flex-1 lg:block" aria-hidden />
      <div className="flex w-full items-center justify-center px-4 lg:w-1/2">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
