import { getDefaultMarkupAction } from "@/app/(app)/settings/actions";
import { PageCard, PageCardHeader } from "@/components/ui/PageCard";
import { DefaultMarkupSettingsForm } from "@/components/settings/DefaultMarkupSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const result = await getDefaultMarkupAction();
  const defaultMarginPercent = result.ok ? result.data.defaultMarkupPercent : 30;

  return (
    <div className="flex flex-col gap-5 px-7 py-6 max-w-[520px]">
      <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: 24, margin: 0, color: "#0f172a" }}>
        Configurações
      </h1>
      <PageCard>
        <PageCardHeader>
          <div>Margem padrão</div>
          <div className="mt-0.5 text-[12px] font-normal text-gray-400">
            Configure a margem % usada como padrão nos novos produtos (RF05).
          </div>
        </PageCardHeader>
        <div className="p-5">
          <DefaultMarkupSettingsForm defaultMarginPercent={defaultMarginPercent} />
        </div>
      </PageCard>
    </div>
  );
}
