import type { PropsWithChildren } from "react";

interface TooltipProps extends PropsWithChildren {
  label: string;
}

export function Tooltip({ label, children }: TooltipProps) {
  return (
    <span className="tooltip" data-tooltip={label}>
      {children}
    </span>
  );
}
