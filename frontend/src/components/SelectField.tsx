import type { SelectHTMLAttributes } from "react";
import type { FilterOption } from "../types";

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: FilterOption[];
  placeholder?: string;
}

export function SelectField({ label, options, placeholder, id, className = "", ...selectProps }: SelectFieldProps) {
  const fieldId = id || selectProps.name || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="field-stack">
      <label className="field-label" htmlFor={fieldId}>
        {label}
      </label>
      <select {...selectProps} id={fieldId} className={`field-control ${className}`}>
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.valor} value={option.valor}>
            {option.etiqueta}
          </option>
        ))}
      </select>
    </div>
  );
}
