import React from "react";

export function TextField({ label, value, onChange, error, disabled, placeholder }) {
  return (
    <div>
      <label className="text-xs text-slate-600 block mb-1">{label}</label>
      <input
        disabled={disabled}
        value={value || ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-50 ${
          error ? "border-rose-300" : "border-slate-200"
        }`}
      />
    </div>
  );
}

export function TextAreaField({ label, value, onChange, error, disabled, rows = 2 }) {
  return (
    <div>
      <label className="text-xs text-slate-600 block mb-1">{label}</label>
      <textarea
        disabled={disabled}
        value={value || ""}
        rows={rows}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-50 ${
          error ? "border-rose-300" : "border-slate-200"
        }`}
      />
    </div>
  );
}

export function SelectField({ label, value, onChange, options, error, disabled }) {
  return (
    <div>
      <label className="text-xs text-slate-600 block mb-1">{label}</label>
      <select
        disabled={disabled}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg py-1.5 px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/20 disabled:bg-slate-50 ${
          error ? "border-rose-300" : "border-slate-200"
        }`}
      >
        <option value="">בחר/י</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function RadioGroup({ label, value, onChange, options, error, disabled }) {
  return (
    <div>
      {label && <div className="text-xs text-slate-600 mb-1.5">{label}</div>}
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="radio" disabled={disabled} checked={value === o.value} onChange={() => onChange(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {error && <div className="text-xs text-rose-600 mt-1">{error}</div>}
    </div>
  );
}

export function BooleanField({ label, value, onChange, error, disabled, yesLabel = "כן", noLabel = "לא" }) {
  return (
    <div>
      {label && <div className="text-xs text-slate-600 mb-1.5">{label}</div>}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" disabled={disabled} checked={value === true} onChange={() => onChange(true)} /> {yesLabel}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="radio" disabled={disabled} checked={value === false} onChange={() => onChange(false)} /> {noLabel}
        </label>
      </div>
      {error && <div className="text-xs text-rose-600 mt-1">{error}</div>}
    </div>
  );
}

export function CheckboxGroup({ label, values, onChange, options, error, disabled, exclusiveValue }) {
  const list = values || [];
  function toggle(v) {
    if (disabled) return;
    if (exclusiveValue && v === exclusiveValue) {
      onChange(list.includes(v) ? [] : [v]);
      return;
    }
    let next = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
    if (exclusiveValue) next = next.filter((x) => x !== exclusiveValue);
    onChange(next);
  }
  return (
    <div>
      {label && <div className="text-xs text-slate-600 mb-1.5">{label}</div>}
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" disabled={disabled} checked={list.includes(o.value)} onChange={() => toggle(o.value)} />
            {o.label}
          </label>
        ))}
      </div>
      {error && <div className="text-xs text-rose-600 mt-1">{error}</div>}
    </div>
  );
}
