import { useEffect, useMemo, useRef, useState } from "react";
import type { FilterOption } from "../types";

interface MultiSelectFieldProps {
  label: string;
  value: string[];
  options: FilterOption[];
  onChange: (value: string[]) => void;
  id?: string;
}

const ALL_VALUE = "TODOS";

export function MultiSelectField({ label, value, options, onChange, id }: MultiSelectFieldProps) {
  const fieldId = id || label.toLowerCase().replace(/\s+/g, "-");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedValues = value.length > 0 ? value : [ALL_VALUE];
  const selectedOptions = useMemo(
    () => options.filter((option) => selectedValues.includes(option.valor)),
    [options, selectedValues],
  );
  const summary = buildSummary(selectedOptions);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  function toggleValue(nextValue: string) {
    if (nextValue === ALL_VALUE) {
      onChange([ALL_VALUE]);
      return;
    }

    const withoutAll = selectedValues.filter((item) => item !== ALL_VALUE);
    const nextSelection = withoutAll.includes(nextValue)
      ? withoutAll.filter((item) => item !== nextValue)
      : [...withoutAll, nextValue];

    onChange(nextSelection.length > 0 ? nextSelection : [ALL_VALUE]);
  }

  return (
    <div className="field-stack multi-select" ref={containerRef}>
      <span className="field-label" id={`${fieldId}-label`}>
        {label}
      </span>
      <button
        className={`multi-select-trigger ${isOpen ? "multi-select-trigger--open" : ""}`}
        type="button"
        aria-label={`${label}: ${summary}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${fieldId}-options`}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{summary}</span>
        <span className="material-symbols-outlined" aria-hidden="true">
          expand_more
        </span>
      </button>
      {isOpen ? (
        <div className="multi-select-menu" id={`${fieldId}-options`} role="group" aria-labelledby={`${fieldId}-label`}>
          {options.map((option) => {
            const checked = selectedValues.includes(option.valor);
            return (
              <label className={`multi-select-option ${checked ? "multi-select-option--checked" : ""}`} key={option.valor}>
                <input type="checkbox" checked={checked} onChange={() => toggleValue(option.valor)} />
                <span>{option.etiqueta}</span>
              </label>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function buildSummary(selectedOptions: FilterOption[]): string {
  if (selectedOptions.length === 0 || selectedOptions.some((option) => option.valor === ALL_VALUE)) {
    return "Todos";
  }
  if (selectedOptions.length === 1) {
    return selectedOptions[0].etiqueta;
  }
  return `${selectedOptions.length} seleccionadas`;
}
