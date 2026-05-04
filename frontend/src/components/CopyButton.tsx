import { useState } from "react";
import { Tooltip } from "./Tooltip";

interface CopyButtonProps {
  label: string;
  copiedLabel: string;
  icon?: string;
  tooltip?: string;
  variant?: "subtle" | "floating";
  iconOnly?: boolean;
  disabled?: boolean;
  onCopy: () => Promise<void>;
  onCopied?: (message: string) => void;
  onError?: (message: string) => void;
}

export function CopyButton({
  label,
  copiedLabel,
  icon = "content_copy",
  tooltip,
  variant = "subtle",
  iconOnly = false,
  disabled = false,
  onCopy,
  onCopied,
  onError,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await onCopy();
      setCopied(true);
      onCopied?.(copiedLabel);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : "No fue posible copiar.");
    }
  }

  const button = (
    <button
      className={`copy-button copy-button--${variant} ${iconOnly ? "copy-button--icon-only" : ""}`}
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      aria-label={tooltip || label}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
      {iconOnly ? null : <span>{copied ? copiedLabel : label}</span>}
    </button>
  );

  if (iconOnly && tooltip) {
    return <Tooltip label={copied ? copiedLabel : tooltip}>{button}</Tooltip>;
  }

  return button;
}
