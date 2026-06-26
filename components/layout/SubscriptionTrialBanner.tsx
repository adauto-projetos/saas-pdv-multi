interface SubscriptionTrialBannerProps {
  daysLeft: number;
}

/**
 * Banner informativo (azul, não-alarmante) exibido durante o período de teste
 * grátis enquanto ainda há folga (> 3 dias). Quando faltam ≤ 3 dias, o
 * SubscriptionWarningBanner (âmbar) assume o aviso urgente.
 *
 * Objetivo: deixar SEMPRE visível para o lojista quantos dias de teste restam,
 * em vez de só avisar na reta final.
 */
export function SubscriptionTrialBanner({
  daysLeft,
}: SubscriptionTrialBannerProps) {
  return (
    <div className="w-full bg-sky-100 px-4 py-2 text-center text-sm font-medium text-sky-900">
      Período de teste grátis —{" "}
      <span className="font-semibold">
        {daysLeft === 1 ? "falta 1 dia" : `faltam ${daysLeft} dias`}
      </span>
      . Para continuar depois, pague via PIX —{" "}
      <span className="font-semibold">WhatsApp 13 99130-6911</span>
    </div>
  );
}
