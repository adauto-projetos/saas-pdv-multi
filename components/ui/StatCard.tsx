import { cn } from "@/lib/utils";

import { PageCard } from "./PageCard";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function StatCard({ label, value, sub, className }: StatCardProps) {
  return (
    <PageCard className={cn("p-5", className)}>
      <div
        style={{
          fontSize: 11,
          letterSpacing: "1.4px",
          fontWeight: 800,
          color: "#aab2c0",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-jakarta)",
          fontSize: 30,
          fontWeight: 800,
          color: "#0f172a",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 12.5, color: "#9aa3b2", fontWeight: 600, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </PageCard>
  );
}
