"use client";

import React from "react";

import { useI18n } from "../i18n-provider";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  TagIcon
} from "../ui/heroicons";

const formatDate = (value, locale) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const formatTime = (value) => {
  if (!value) return "-";
  const parts = value.split(":");
  if (parts.length >= 2) {
    return `${parts[0]}:${parts[1]}`;
  }
  return value;
};

const iconProps = { size: 14, className: "text-secondary-500", strokeWidth: 1.5 };

export default function OfferMainDetails({ offer }) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";
  const address = [offer?.city?.name, offer?.address].filter(Boolean).join(" - ");
  const dateLabel = formatDate(offer?.start_date, dateLocale);
  const timeLabel = formatTime(offer?.start_time);
  const endDateLabel = formatDate(offer?.end_date, dateLocale);
  const endTimeLabel = formatTime(offer?.end_time);
  const priceLabel = offer?.price
    ? `${offer.price} MAD`
    : t("Budget not specified");
  const showStartTime = timeLabel && timeLabel !== "-";
  const showEndTime = endTimeLabel && endTimeLabel !== "-";

  return (
    <div className="grid gap-2 text-xs text-secondary-500 sm:grid-cols-2">
      <div className="flex items-start gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <CalendarDaysIcon {...iconProps} />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">
            {t("Start date")}
          </span>
          <span className="text-xs font-semibold text-primary-900">
            {dateLabel}
          </span>
          {showStartTime ? (
            <span className="text-[11px] text-secondary-500">{timeLabel}</span>
          ) : null}
        </div>
      </div>
      <div className="flex items-start gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <ClockIcon {...iconProps} />
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">
            {t("End date")}
          </span>
          <span className="text-xs font-semibold text-primary-900">
            {endDateLabel}
          </span>
          {showEndTime ? (
            <span className="text-[11px] text-secondary-500">
              {endTimeLabel}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex min-w-0 items-center gap-2 rounded-full bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <TagIcon {...iconProps} />
        <span className="truncate font-medium">{priceLabel}</span>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900 sm:col-span-2">
        <MapPinIcon {...iconProps} />
        <span className="truncate font-medium">{address || "-"}</span>
      </div>
    </div>
  );

}
