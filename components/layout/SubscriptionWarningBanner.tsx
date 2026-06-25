interface SubscriptionWarningBannerProps {
  daysLeft: number;
}

export function SubscriptionWarningBanner({
  daysLeft,
}: SubscriptionWarningBannerProps) {
  return (
    <div className="w-full bg-amber-400 px-4 py-2 text-center text-sm font-medium text-amber-950">
      {daysLeft <= 0
        ? "Seu período expira hoje."
        : daysLeft === 1
          ? "Seu período expira amanhã."
          : `Seu período expira em ${daysLeft} dias.`}{" "}
      Pague via PIX —{" "}
      <span className="font-semibold">WhatsApp 13 99130-6911</span>
    </div>
  );
}
