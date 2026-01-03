"use client";

import React, { useMemo, useState } from "react";
import DatePicker from "react-datepicker";

const pad = (value) => String(value).padStart(2, "0");

const isValidDate = (value) =>
  value instanceof Date && !Number.isNaN(value.getTime());

const parseDateValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split("/").map(Number);
    return new Date(year, month - 1, day);
  }
  return null;
};

const parseTimeValue = (value) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (!/^\d{1,2}:\d{2}$/.test(trimmed)) return null;
  const [hours, minutes] = trimmed.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
};

const formatDateValue = (date) => {
  if (!isValidDate(date)) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`;
};

const formatTimeValue = (date) => {
  if (!isValidDate(date)) return "";
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const variants = {
  default: {
    label: "mb-1 block text-lg text-primary-500",
    container: "flex items-center gap-3 rounded-full border-2 px-4 py-3",
    input:
      "flex-1 bg-transparent text-secondary-400 outline-none placeholder:text-neutral-400",
    error: "mt-2 text-sm text-danger-600"
  },
  compact: {
    label: "text-sm font-semibold text-primary-900",
    container: "flex items-center gap-2 rounded-2xl border px-3 py-2",
    input:
      "w-full bg-transparent text-sm text-secondary-600 outline-none placeholder:text-neutral-400",
    error: "mt-2 text-xs text-danger-600"
  }
};

export default function DateTimeField({
  label,
  error,
  type = "date",
  value,
  onChange,
  placeholder,
  className = "",
  containerClassName = "",
  inputClassName = "",
  labelClassName = "",
  errorClassName = "",
  variant = "default",
  timeIntervals = 15,
  onFocus,
  onBlur,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const isTime = type === "time";
  const config = variants[variant] || variants.default;
  const selected = useMemo(
    () => (isTime ? parseTimeValue(value) : parseDateValue(value)),
    [isTime, value]
  );
  const borderColor = error
    ? "border-danger-600"
    : focused
      ? "border-primary-500"
      : "border-[#EADAF1]";

  const handleChange = (date) => {
    if (!onChange) return;
    if (!isValidDate(date)) {
      onChange("");
      return;
    }
    onChange(isTime ? formatTimeValue(date) : formatDateValue(date));
  };

  const handleRawChange = (event) => {
    if (!onChange || !event?.target) return;
    const rawValue = event.target.value;
    if (!rawValue) {
      onChange("");
      return;
    }
    const parsed = isTime ? parseTimeValue(rawValue) : parseDateValue(rawValue);
    if (parsed) {
      onChange(isTime ? formatTimeValue(parsed) : formatDateValue(parsed));
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {label ? (
        <label className={labelClassName || config.label}>{label}</label>
      ) : null}
      <div className={`${config.container} ${borderColor} ${containerClassName}`}>
        <DatePicker
          selected={selected}
          onChange={handleChange}
          onChangeRaw={handleRawChange}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          showTimeSelect={isTime}
          showTimeSelectOnly={isTime}
          timeIntervals={timeIntervals}
          timeFormat="HH:mm"
          dateFormat={isTime ? "HH:mm" : "dd/MM/yyyy"}
          placeholderText={placeholder}
          className={`${config.input} ${inputClassName}`}
          wrapperClassName="w-full"
          showPopperArrow={false}
          {...props}
        />
      </div>
      {error ? (
        <p className={errorClassName || config.error}>{error}</p>
      ) : null}
    </div>
  );
}
