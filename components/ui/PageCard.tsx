import { cn } from "@/lib/utils";

export function PageCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageCardHeader({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-gray-100 text-sm font-semibold text-gray-900",
        className,
      )}
    >
      {children}
    </div>
  );
}
