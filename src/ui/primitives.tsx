"use client";

import type { ReactNode } from "react";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  testId,
  disabled,
}: {
  value: T;
  options: { value: T; label: ReactNode; testId?: string; disabled?: boolean; title?: string }[];
  onChange: (v: T) => void;
  label: string;
  testId?: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} data-testid={testId} className="flex gap-0.5 rounded-[10px] bg-white/5 p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={o.testId}
            title={o.title}
            disabled={disabled || o.disabled}
            onClick={() => onChange(o.value)}
            className={`h-7 flex-1 whitespace-nowrap rounded-[8px] px-2.5 text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
              on ? "bg-[#E9EEF4] text-[#0B0E14]" : "text-ink-1 hover:bg-white/10"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SectionLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
      <span className="micro">{children}</span>
      {hint && <span className="mono text-[10px] text-ink-3">{hint}</span>}
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  children,
  active,
  testId,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      data-testid={testId}
      onClick={onClick}
      className={`grid h-8 min-w-8 place-items-center rounded-[10px] px-2 text-[12px] transition-colors ${
        active ? "bg-[#E9EEF4] text-[#0B0E14]" : "bg-white/[0.07] text-ink-1 hover:bg-white/15"
      }`}
    >
      {children}
    </button>
  );
}
