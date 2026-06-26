import { SignupForm } from "@/components/auth/SignupForm";
import { getMonthlyPlanPriceCents } from "@/lib/services/platform/settings-repository";

export const metadata = { title: "Criar loja — SAAS PDV.multi" };

export default async function SignupPage() {
  const monthlyPriceCents = await getMonthlyPlanPriceCents();
  return <SignupForm monthlyPriceCents={monthlyPriceCents} />;
}
