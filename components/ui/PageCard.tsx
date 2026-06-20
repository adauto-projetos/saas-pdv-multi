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
      className={cn("bg-white overflow-hidden", className)}
      style={{
        border: "1px solid #eef1f5",
        borderRadius: "var(--pdv-card-radius, 18px)",
        boxShadow: "0 1px 2px rgba(16,24,40,.04)",
      }}
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
      className={cn("px-5 py-4 border-b border-gray-100", className)}
      style={{
        fontFamily: "var(--font-jakarta)",
        fontWeight: 800,
        fontSize: 16,
        color: "#0f172a",
      }}
    >
      {children}
    </div>
  );
}
