export const inputClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent transition-shadow";

export const labelClass = "block text-sm font-medium text-ink mb-1";

export const primaryButtonClass =
  "bg-accent text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-accent-strong disabled:opacity-60 transition-colors";

export const ghostButtonClass =
  "text-sm font-medium text-muted hover:text-ink border border-border rounded-xl px-3 py-1.5 hover:bg-accent-soft transition-colors";

export const dangerButtonClass =
  "text-sm font-medium text-coral hover:text-coral border border-coral/40 rounded-xl px-3 py-1.5 hover:bg-coral-soft transition-colors";

export function TextField({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  step,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  placeholder?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? undefined}
        required={required}
        placeholder={placeholder}
        step={step}
        min={min}
        max={max}
        className={inputClass}
      />
    </div>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
