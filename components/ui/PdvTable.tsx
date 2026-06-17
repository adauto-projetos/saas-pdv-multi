import { cn } from "@/lib/utils";

import { TableCell, TableHead } from "@/components/ui/table";

export function PdvTableHead({
  className,
  ...props
}: React.ComponentProps<"th">) {
  return (
    <TableHead
      className={cn(
        "bg-gray-50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.5px] text-gray-500",
        className,
      )}
      {...props}
    />
  );
}

export function PdvTableCell({
  className,
  ...props
}: React.ComponentProps<"td">) {
  return (
    <TableCell
      className={cn("px-5 py-3 text-[13px] text-gray-700", className)}
      {...props}
    />
  );
}
