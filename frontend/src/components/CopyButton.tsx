import { useState } from "react";

interface CopyButtonProps {
  label: string;
  copiedLabel: string;
  icon?: string;
  tooltip?: string;
  variant?: "subtle" | "floating";
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

  return (
    <button
      className={`copy-button copy-button--${variant}`}
      type="button"
      onClick={handleCopy}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip || label}
    >
      <span className="material-symbols-outlined" aria-hidden="true">
        {icon}
      </span>
      <span>{copied ? copiedLabel : label}</span>
    </button>
  );
}
