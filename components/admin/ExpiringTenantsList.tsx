interface ExpiringTenant {
  id: string;
  name: string;
  validUntil: Date;
}

interface ExpiringTenantsListProps {
  tenants: ExpiringTenant[];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR");
}

export function ExpiringTenantsList({ tenants }: ExpiringTenantsListProps) {
  if (tenants.length === 0) return null;

  return (
    <div
      style={{
        background: "#fffbeb",
        border: "1px solid #fde68a",
        borderRadius: 14,
        padding: "16px 20px",
      }}
    >
      <div
        style={{
          fontWeight: 800,
          fontSize: 13.5,
          color: "#92400e",
          marginBottom: 12,
        }}
      >
        Vence em 3 dias ({tenants.length} {tenants.length === 1 ? "loja" : "lojas"})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tenants.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 13.5,
              color: "#78350f",
            }}
          >
            <span style={{ fontWeight: 700 }}>{t.name}</span>
            <span style={{ fontSize: 12.5, color: "#b45309" }}>
              vence em {formatDate(t.validUntil)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
