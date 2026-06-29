import type { TenantStatus } from "@/lib/services/subscriptions/subscription-status";

interface MetricsCardsProps {
  stats: Record<TenantStatus, number>;
}

const CARDS: Array<{ key: TenantStatus; label: string; color: string; bg: string }> = [
  { key: "testando", label: "Testando", color: "#1d4ed8", bg: "#eff6ff" },
  { key: "ativa", label: "Ativas", color: "#15803d", bg: "#f0fdf4" },
  { key: "travada", label: "Travadas", color: "#b91c1c", bg: "#fef2f2" },
];

export function MetricsCards({ stats }: MetricsCardsProps) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
      {CARDS.map(({ key, label, color, bg }) => (
        <div
          key={key}
          style={{
            background: bg,
            border: "1px solid #eef1f5",
            borderRadius: 16,
            padding: "20px 22px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "1.4px",
              fontWeight: 800,
              color: "#aab2c0",
              textTransform: "uppercase",
              marginBottom: 10,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontFamily: "var(--font-jakarta)",
              fontSize: 36,
              fontWeight: 800,
              color,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {stats[key]}
          </div>
          <div style={{ fontSize: 12, color: "#9aa3b2", fontWeight: 600, marginTop: 4 }}>
            {key === "testando" ? "em período de teste" : key === "ativa" ? "assinatura ativa" : "acesso bloqueado"}
          </div>
        </div>
      ))}
    </div>
  );
}
