"use client";


export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  accent = "var(--color-ink-0)",
  testId,
  kelvin,
  disabled,
  title,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  accent?: string;
  testId?: string;
  kelvin?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="ls-slider" title={title}>
      <span className="ls-slider-label">{label}</span>
      <input
        type="range"
        className={`ls-range ${kelvin ? "ls-kelvin" : ""}`}
        style={{ "--pct": `${Math.min(100, Math.max(0, pct))}%`, "--accent": accent } as React.CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format(value)}
        data-testid={testId}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="mono truncate text-right text-[11px] text-ink-0">{format(value)}</span>
    </label>
  );
}
