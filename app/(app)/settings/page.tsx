import { getDefaultMarkupAction } from "@/app/(app)/settings/actions";
import { DefaultMarkupSettingsForm } from "@/components/settings/DefaultMarkupSettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const result = await getDefaultMarkupAction();
  const defaultMarginPercent = result.ok ? result.data.defaultMarkupPercent : 30;

  return (
    <div className="grid max-w-sm gap-6">
      <div>
        <h1 className="text-xl font-semibold">Margem padrão</h1>
        <p className="text-sm text-muted-foreground">
          Configure a margem % usada como padrão nos novos produtos (RF05).
        </p>
      </div>
      <DefaultMarkupSettingsForm defaultMarginPercent={defaultMarginPercent} />
    </div>
  );
}
