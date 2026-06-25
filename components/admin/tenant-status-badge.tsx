import type { TenantStatus } from "@/lib/services/subscriptions/subscription-status";

const STATUS_CONFIG: Record<
  TenantStatus,
  { label: string; color: string; bg: string }
> = {
  testando: { label: "Testando", color: "#1d4ed8", bg: "#dbeafe" },
  ativa: { label: "Ativa", color: "#15803d", bg: "#dcfce7" },
  travada: { label: "Travada", color: "#b91c1c", bg: "#fee2e2" },
};

interface TenantStatusBadgeProps {
  status: TenantStatus;
}

export function TenantStatusBadge({ status }: TenantStatusBadgeProps) {
  const { label, color, bg } = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        background: bg,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
