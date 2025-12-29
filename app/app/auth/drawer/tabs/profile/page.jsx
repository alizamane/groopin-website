"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import OfferCard from "../../../../../../components/offers/offer-card";
import UserAvatar from "../../../../../../components/user/user-avatar";
import Button from "../../../../../../components/ui/button";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";
import { getUser } from "../../../../../lib/session";

export default function ProfilePage() {
  const { t, locale } = useI18n();
  const [createdOffers, setCreatedOffers] = useState([]);
  const [participatedOffers, setParticipatedOffers] = useState([]);
  const [status, setStatus] = useState("loading");
  const user = getUser();
  const memberSinceDate = user?.created_at ? new Date(user.created_at) : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.valueOf())
      ? memberSinceDate.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric"
        })
      : "-";
  const createdCount =
    status === "ready"
      ? createdOffers.length
      : Number(user?.owning_offers_count || 0);
  const participatedCount =
    status === "ready"
      ? participatedOffers.length
      : Number(user?.participated_offers_count || 0);
  const profileCompletion =
    typeof user?.profile_completion === "number"
      ? user.profile_completion
      : 0;
  const extraInfoSource = {
    ...(user?.resolved_dynamic_answers || user?.dynamic_answers || {})
  };
  if (user?.date_of_birth) {
    extraInfoSource.date_of_birth = user.date_of_birth;
  }

  const answerBlocks = [
    { key: "interests", label: t("Interests"), icon: "interests" },
    { key: "marital_status", label: t("marital_status"), icon: "marital" },
    { key: "job", label: t("field of activity"), icon: "job" },
    { key: "city", label: t("City"), icon: "city" },
    { key: "date_of_birth", label: t("date_of_birth"), icon: "birthday" }
  ];

  const groupedKeys = new Set(answerBlocks.map((item) => item.key));
  const extraInfoBlocks = answerBlocks
    .map((item) => ({
      ...item,
      value: extraInfoSource[item.key]
    }))
    .filter(
      (item) =>
        item.value !== null &&
        item.value !== undefined &&
        String(item.value).trim() !== ""
    );
  const extraInfoExtras = Object.entries(extraInfoSource).filter(
    ([key, value]) =>
      !groupedKeys.has(key) &&
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
  );
  const hasExtraInfo = extraInfoBlocks.length > 0 || extraInfoExtras.length > 0;
  const stats = [
    { label: t("profile.member_since"), value: memberSinceLabel },
    { label: t("profile.offers_created"), value: createdCount },
    { label: t("profile.participated"), value: participatedCount },
    { label: t("profile.complete_profile"), value: `${profileCompletion}%` }
  ];
  const birthdayLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
  const formatBirthday = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const day = new Intl.DateTimeFormat(birthdayLocale, {
      day: "2-digit"
    }).format(date);
    const month = new Intl.DateTimeFormat(birthdayLocale, {
      month: "short"
    }).format(date);
    const year = new Intl.DateTimeFormat(birthdayLocale, {
      year: "numeric"
    }).format(date);
    return `${day} ${month} ${year}`;
  };

  useEffect(() => {
    Promise.all([
      apiRequest("my-offers?filter[status]=closed&lite=1"),
      apiRequest("participating?filter[status]=closed&filter[isowner]=0&lite=1")
    ])
      .then(([created, participated]) => {
        setCreatedOffers(created?.data || []);
        setParticipatedOffers(participated?.data || []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6 pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            {t("profile.title")}
          </h1>
          <p className="text-secondary-400">
            {t("profile.complete_profile_question")}
          </p>
        </div>
        <Link href="/app/auth/profile/edit">
          <Button label={t("profile.edit_profile")} size="sm" className="px-4" />
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <UserAvatar user={user} size={86} withBorder />
        <div className="space-y-2">
          <p className="text-xl font-semibold text-primary-900">
            {user.first_name} {user.last_name}
          </p>
          {user.average_rating ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, index) => (
                  <StarIcon
                    key={`star-${index}`}
                    filled={index + 1 <= Math.round(user.average_rating)}
                  />
                ))}
              </div>
              <span className="text-sm text-secondary-500">
                {user.average_rating.toFixed(1)}/5
              </span>
            </div>
          ) : (
            <p className="text-sm text-secondary-400">
              {t("No user ratings yet")}
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-[#EADAF1] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label}>
            <p className="text-xs uppercase tracking-wide text-secondary-400">
              {item.label}
            </p>
            <p className="text-lg font-semibold text-primary-900">
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="lg:w-[38%]">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t("bio")}
            </h2>
            <div className="mt-3 rounded-2xl bg-[#F7F1FA] px-4 py-3">
              <p className="text-sm text-secondary-600 leading-relaxed">
                {user.bio || t("nothingToShow")}
              </p>
            </div>
          </div>

          <div className="h-px bg-[#EADAF1] lg:h-auto lg:w-px" />

          <div className="flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t("profile.survey")}
            </h2>
            {!hasExtraInfo ? (
              <p className="mt-3 text-sm text-secondary-400">
                {t("nothingToShow")}
              </p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {extraInfoBlocks.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-[#EADAF1] bg-[#F7F1FA] px-4 py-3"
                  >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-secondary-500">
                      <InfoIcon type={item.icon} />
                    </span>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-secondary-500">
                      {item.label}
                    </p>
                  </div>
                    <p className="mt-2 text-sm font-semibold text-primary-900">
                      {item.key === "date_of_birth"
                        ? formatBirthday(item.value)
                        : String(item.value)}
                    </p>
                  </div>
                ))}
              {extraInfoExtras.length > 0 ? (
                <div className="rounded-2xl border border-[#EADAF1] bg-[#F7F1FA] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white text-secondary-500">
                      <InfoIcon type="details" />
                    </span>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-secondary-500">
                      {t("Details")}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {extraInfoExtras.map(([key, value]) => (
                      <span
                        key={key}
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-secondary-600"
                        >
                          {String(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {status === "loading" ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-28 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-danger-600">
          {t("general.error_has_occurred")}
        </p>
      ) : null}

      {status === "ready" ? (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-primary-800">
              {t("profile.offers_history")}
            </h2>
            {createdOffers.length === 0 ? (
              <p className="text-sm text-secondary-400">
                {t("nothingToShow")}
              </p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {createdOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-primary-800">
              {t("profile.participation_history")}
            </h2>
            {participatedOffers.length === 0 ? (
              <p className="text-sm text-secondary-400">
                {t("nothingToShow")}
              </p>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {participatedOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    currentUserId={user.id}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function StarIcon({ filled }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "#B12587" : "none"}
      stroke="#B12587"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3.5 14.8 9l5.9.9-4.3 4.2 1 5.8L12 17.8 6.6 19.9l1-5.8-4.3-4.2L9.2 9 12 3.5Z" />
    </svg>
  );
}

function InfoIcon({ type }) {
  const className = "h-4 w-4";

  if (type === "interests") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 3.5 14.8 9l5.9.9-4.3 4.2 1 5.8L12 17.8 6.6 19.9l1-5.8-4.3-4.2L9.2 9 12 3.5Z" />
      </svg>
    );
  }

  if (type === "marital") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    );
  }

  if (type === "job") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M3 7h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        <path d="M3 12h18" />
      </svg>
    );
  }

  if (type === "city") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 22s7-4.4 7-11a7 7 0 1 0-14 0c0 6.6 7 11 7 11z" />
        <circle cx="12" cy="11" r="2.5" />
      </svg>
    );
  }

  if (type === "birthday") {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1.2" />
      <circle cx="4" cy="12" r="1.2" />
      <circle cx="4" cy="18" r="1.2" />
    </svg>
  );
}
