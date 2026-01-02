"use client";

import React, { useState } from "react";
import useSupportedInputType, {
  getFallbackMeta,
  isDateLikeType
} from "./input-support";

export default function Input({
  label,
  error,
  type = "text",
  className = "",
  inputClassName = "",
  placeholder,
  inputMode,
  pattern,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const resolvedType = useSupportedInputType(type);
  const isFallback = isDateLikeType(type) && resolvedType === "text";
  const fallbackMeta = isFallback ? getFallbackMeta(type) : {};
  const resolvedPlaceholder =
    placeholder ?? fallbackMeta.placeholder;
  const resolvedInputMode = inputMode ?? (isFallback ? "numeric" : undefined);
  const resolvedPattern = pattern ?? fallbackMeta.pattern;

  const borderColor = error
    ? "border-danger-600"
    : focused
      ? "border-primary-500"
      : "border-[#EADAF1]";

  return (
    <div className={`w-full ${className}`}>
      {label ? (
        <label className="mb-1 block text-lg text-primary-500">{label}</label>
      ) : null}
      <div className={`rounded-full border-2 px-4 py-3 ${borderColor}`}>
        <input
          type={resolvedType}
          className={`w-full bg-transparent text-secondary-400 outline-none placeholder:text-neutral-400 ${inputClassName}`}
          placeholder={resolvedPlaceholder}
          inputMode={resolvedInputMode}
          pattern={resolvedPattern}
          onFocus={(event) => {
            setFocused(true);
            props.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            props.onBlur?.(event);
          }}
          {...props}
        />
      </div>
      {error ? (
        <p className="mt-2 text-sm text-danger-600">{error}</p>
      ) : null}
    </div>
  );
}
