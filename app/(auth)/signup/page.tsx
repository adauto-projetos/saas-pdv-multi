import { SignupForm } from "@/components/auth/SignupForm";
import { getMonthlyPlanPriceCents } from "@/lib/services/platform/settings-repository";

export const metadata = { title: "Criar loja — SAAS PDV.multi" };

// Lê o preço do plano (config global) por requisição, não no build: o valor é
// editável no super admin e o build do Docker não tem o banco acessível
// (prerender estático falharia com ECONNREFUSED e fixaria um preço velho).
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const monthlyPriceCents = await getMonthlyPlanPriceCents();
  return <SignupForm monthlyPriceCents={monthlyPriceCents} />;
}
