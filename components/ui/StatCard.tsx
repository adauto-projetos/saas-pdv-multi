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
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.7px] text-gray-400">
        {label}
      </div>
      <div className="text-[28px] font-bold leading-tight tracking-tight text-gray-900">
        {value}
      </div>
      {sub && <div className="mt-1 text-[12px] text-gray-500">{sub}</div>}
    </PageCard>
  );
}
