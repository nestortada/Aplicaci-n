import type { ButtonHTMLAttributes } from "react";
import { Tooltip } from "./Tooltip";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  label: string;
  tone?: "neutral" | "danger" | "copy";
}

export function IconButton({ icon, label, tone = "neutral", className = "", ...buttonProps }: IconButtonProps) {
  return (
    <Tooltip label={label}>
      <button
        {...buttonProps}
        className={`icon-button icon-button--${tone} ${className}`}
        type={buttonProps.type || "button"}
        aria-label={label}
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          {icon}
        </span>
      </button>
    </Tooltip>
  );
}
