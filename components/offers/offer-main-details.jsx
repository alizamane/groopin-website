"use client";

import React, { useMemo, useState } from "react";

import { useI18n } from "../i18n-provider";
import { getLocalizedText } from "./offer-text";
import {
  CalendarDaysIcon,
  MapPinIcon,
  TagIcon
} from "../ui/heroicons";
import Modal from "../ui/modal";

const KNOWN_PLACE_TYPES = new Set([
  "establishment",
  "point_of_interest",
  "park",
  "tourist_attraction",
  "museum",
  "natural_feature"
]);

const normalizePlaceTypes = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).toLowerCase());
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item).toLowerCase());
        }
      } catch {
        return [];
      }
    }
    return trimmed
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  return [];
};

const isKnownPlaceType = (types) =>
  types.some((type) => KNOWN_PLACE_TYPES.has(type));

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

export default function OfferMainDetails({ offer, enablePlacePreview = false }) {
  const { t, locale } = useI18n();
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
  const cityName = getLocalizedText(offer?.city?.name, locale);
  const addressText = getLocalizedText(offer?.address, locale);
  const address = [cityName, addressText].filter(Boolean).join(" - ");
  const place = offer?.place || {};
  const hasPlace = Boolean(place?.id || (place?.lat && place?.lng));
  const placeTypes = normalizePlaceTypes(place?.types);
  const isPhotoEligible = isKnownPlaceType(placeTypes);
  const [isPlaceOpen, setIsPlaceOpen] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
  const mapQuery = useMemo(() => {
    if (place?.lat && place?.lng) {
      return `${place.lat},${place.lng}`;
    }
    return "";
  }, [place?.lat, place?.lng]);
  const mapEmbedSrc = mapQuery
    ? `https://maps.google.com/maps?q=${encodeURIComponent(
        mapQuery
      )}&z=15&output=embed`
    : "";
  const placeUrl =
    place?.url ||
    (mapQuery
      ? `https://maps.google.com/?q=${encodeURIComponent(mapQuery)}`
      : "");
  const photoUrl =
    apiKey && place?.photo_reference
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${place.photo_reference}&key=${apiKey}`
      : "";
  const canShowPhoto = Boolean(photoUrl && isPhotoEligible && !photoError);
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
        <CalendarDaysIcon {...iconProps} />
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
      {enablePlacePreview && hasPlace ? (
        <button
          type="button"
          onClick={() => setIsPlaceOpen(true)}
          className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-left text-primary-900 sm:col-span-2"
        >
          <MapPinIcon {...iconProps} />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium">{address || "-"}</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">
              {t("offers.view_place")}
            </span>
          </div>
        </button>
      ) : (
        <div className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-[#F7F1FA] px-3 py-2 text-primary-900 sm:col-span-2">
          <MapPinIcon {...iconProps} />
          <span className="truncate font-medium">{address || "-"}</span>
        </div>
      )}

      <Modal
        open={enablePlacePreview && hasPlace && isPlaceOpen}
        onClose={() => setIsPlaceOpen(false)}
        title={t("offers.location_details")}
      >
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-primary-900">
              {place?.name || address || "-"}
            </p>
            {address ? (
              <p className="text-xs text-secondary-400">{address}</p>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-100">
            {canShowPhoto ? (
              <img
                src={photoUrl}
                alt={place?.name || address || t("offers.place_photo")}
                className="h-44 w-full object-cover"
                onError={() => setPhotoError(true)}
                loading="lazy"
              />
            ) : (
              <div className="flex h-44 items-center justify-center bg-[#F7F1FA] text-xs text-secondary-400">
                {t("offers.place_photo_unavailable")}
              </div>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-neutral-100">
            {mapEmbedSrc ? (
              <iframe
                title={t("offers.place_map")}
                src={mapEmbedSrc}
                className="h-48 w-full"
                loading="lazy"
              />
            ) : (
              <div className="flex h-48 items-center justify-center bg-[#F7F1FA] text-xs text-secondary-400">
                {t("offers.place_map_unavailable")}
              </div>
            )}
          </div>
          {placeUrl ? (
            <a
              href={placeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-500"
            >
              {t("offers.open_in_maps")}
            </a>
          ) : null}
        </div>
      </Modal>
    </div>
  );

}
