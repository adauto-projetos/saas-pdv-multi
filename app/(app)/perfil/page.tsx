import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { PageCard, PageCardHeader } from "@/components/ui/PageCard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Meu perfil — SAAS PDV.multi" };

export default function PerfilPage() {
  return (
    <div className="flex flex-col gap-5 px-4 md:px-7 py-6 max-w-[520px]">
      <h1
        style={{
          fontFamily: "var(--font-jakarta)",
          fontWeight: 800,
          fontSize: 24,
          margin: 0,
          color: "#0f172a",
        }}
      >
        Meu perfil
      </h1>
      <PageCard>
        <PageCardHeader>
          <div>Trocar minha senha</div>
          <div className="mt-0.5 text-[12px] font-normal text-gray-400">
            Defina uma nova senha pessoal. Use ao menos 6 caracteres.
          </div>
        </PageCardHeader>
        <div className="p-5">
          <ChangePasswordForm />
        </div>
      </PageCard>
    </div>
  );
}
