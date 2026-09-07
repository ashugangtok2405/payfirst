export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900";

export const labelClass = "block text-sm font-medium text-slate-700 mb-1";

export const primaryButtonClass =
  "bg-slate-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-60";

export const ghostButtonClass =
  "text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg px-3 py-1.5 hover:bg-slate-100";

export const dangerButtonClass =
  "text-sm font-medium text-red-600 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50";

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
