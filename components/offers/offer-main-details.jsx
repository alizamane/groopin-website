"use client";

import React from "react";

import { useI18n } from "../i18n-provider";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  TagIcon
} from "../ui/heroicons";

const formatShortToken = (date, locale, options) => {
  const value = new Intl.DateTimeFormat(locale, options).format(date);
  const normalized = value.replace(/\./g, "").trim().slice(0, 3);
  if (!normalized) return value;
  const capitalized =
    normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  return `${capitalized}.`;
};

const formatDate = (value, locale) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const weekday = formatShortToken(date, locale, { weekday: "short" });
  const dayNumber = new Intl.DateTimeFormat(locale, { day: "numeric" }).format(date);
  const month = formatShortToken(date, locale, { month: "short" });
  const year = new Intl.DateTimeFormat(locale, { year: "numeric" }).format(date);
  return `${weekday} ${dayNumber} ${month} ${year}`;
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
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
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
    <div className="grid w-full gap-2 text-xs text-secondary-500 sm:grid-cols-2">
      <div className="flex w-full min-w-0 items-start gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <CalendarDaysIcon {...iconProps} />
        <div className="min-w-0 flex flex-col leading-tight">
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
      <div className="flex w-full min-w-0 items-start gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <ClockIcon {...iconProps} />
        <div className="min-w-0 flex flex-col leading-tight">
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
      <div className="flex w-full min-w-0 items-center gap-2 rounded-full bg-[#F7F1FA] px-3 py-2 text-primary-900">
        <TagIcon {...iconProps} />
        <span className="truncate font-medium">{priceLabel}</span>
      </div>
      <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900 sm:col-span-2">
        <MapPinIcon {...iconProps} />
        <span className="truncate font-medium">{address || "-"}</span>
      </div>
    </div>
  );

}
