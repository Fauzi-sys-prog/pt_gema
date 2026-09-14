import React from "react";

export const UNIT_OPTIONS = [
  "Orang", "Lot", "Unit", "Paket", "Set", "Pcs", "Kgs", "Kg", "Gram",
  "Liter", "ml", "Box", "Roll", "Lembar", "m", "m²", "m³", "Meter",
  "Ton", "Hari", "Jam", "Bulan", "Trip", "LS",
];

export function UnitSelect({
  value,
  onChange,
  className = "",
  inputClassName = "",
  placeholder = "Tulis satuan...",
}: {
  value?: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}) {
  const current = value || "";
  const isPreset = UNIT_OPTIONS.includes(current);
  return (
    <div className={className}>
      <select
        value={isPreset ? current : "Lainnya"}
        onChange={(e) => onChange(e.target.value === "Lainnya" ? "" : e.target.value)}
        className={`${inputClassName || "w-full px-3 py-2 border border-gray-300 rounded-lg bg-white"} focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600`}
      >
        {UNIT_OPTIONS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
        <option value="Lainnya">Lainnya</option>
      </select>
      {!isPreset && (
        <input
          type="text"
          value={current}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="w-full mt-2 px-3 py-2 border border-emerald-400 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600"
        />
      )}
    </div>
  );
}
