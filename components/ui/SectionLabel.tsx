import { cn } from "@/lib/utils";

export function SectionLabel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-[10px] uppercase tracking-[0.7px] text-gray-400 font-semibold",
        className,
      )}
    >
      {children}
    </div>
  );
}
