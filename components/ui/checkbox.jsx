"use client";

import React from "react";

export default function Checkbox({
  label,
  checked,
  onChange,
  disabled = false,
  className = ""
}) {
  return (
    <label
      className={`flex items-center gap-3 ${disabled ? "opacity-60" : ""} ${className}`}
    >
      <input
        type="checkbox"
        className="h-5 w-5 rounded border-neutral-300 text-[#B12587] focus:ring-[#B12587]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="text-sm text-neutral-700">{label}</span>
    </label>
  );
}
