"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import OfferMainDetails from "./offer-main-details";
import { getLocalizedText } from "./offer-text";
import UserAvatar from "../user/user-avatar";
import UsersAvatarsList from "../user/users-avatars-list";
import Modal from "../ui/modal";
import Button from "../ui/button";
import { useI18n } from "../i18n-provider";
import { UserPlusIcon } from "../ui/heroicons";
import { apiRequest } from "../../app/lib/api-client";

const HeartIcon = ({ filled }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  </svg>
);

const combineDateAndTime = (date, time) => {
  if (!date) return null;
  const normalizedTime = time ? time.split(":").slice(0, 2).join(":") : "00:00";
  const dateTime = new Date(`${date}T${normalizedTime}`);
  if (Number.isNaN(dateTime.getTime())) return null;
  return dateTime;
};

const formatTimeRemaining = (milliseconds, t) => {
  const seconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const daysUnit = t("time_units.days");
  const hoursUnit = t("time_units.hours");
  const minutesUnit = t("time_units.minutes");

  const remainingHours = hours % 24;
  const displayMinutes = minutes % 60;

  // If more than 1 day away, only show days and hours (no minutes)
  if (days > 0) {
    return `${days}${daysUnit} ${remainingHours}${hoursUnit}`;
  }

  // Less than 1 day: show hours and minutes
  if (hours > 0) {
    return `${hours}${hoursUnit} ${displayMinutes}${minutesUnit}`;
  }
  return `${displayMinutes}${minutesUnit}`;
};

export default function OfferCard({
  offer,
  currentUserId,
  showRating = false
}) {
  const pathname = usePathname();
  const { t, locale } = useI18n();
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [isFavorite, setIsFavorite] = useState(
    Boolean(offer?.auth_user_is_favorite)
  );
  const [favoriteCount, setFavoriteCount] = useState(
    offer?.favorited_by_count ?? offer?.favorited_by?.length ?? 0
  );
  const [isPending, setIsPending] = useState(
    Boolean(offer?.auth_user_is_pending_participant)
  );
  const [isParticipant, setIsParticipant] = useState(
    Boolean(offer?.auth_user_is_participant)
  );
  const [now, setNow] = useState(() => Date.now());
  const isClosed = Boolean(offer?.is_closed) || offer?.status === "closed";

  useEffect(() => {
    setIsFavorite(Boolean(offer?.auth_user_is_favorite));
    setFavoriteCount(offer?.favorited_by_count ?? offer?.favorited_by?.length ?? 0);
    setIsPending(Boolean(offer?.auth_user_is_pending_participant));
    setIsParticipant(Boolean(offer?.auth_user_is_participant));
  }, [offer]);

  useEffect(() => {
    if (!offer?.start_date) return undefined;
    if (
      isClosed ||
      offer?.is_draft ||
      offer?.status === "draft" ||
      offer?.status === "pending"
    ) {
      return undefined;
    }
    const startDateTime = combineDateAndTime(offer.start_date, offer.start_time);
    if (!startDateTime) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, [offer?.start_date, offer?.start_time, offer?.status, offer?.is_draft, isClosed]);

  const ownerFullName = useMemo(() => {
    if (!offer?.owner) return "-";
    return `${offer.owner.first_name} ${offer.owner.last_name}`;
  }, [offer?.owner]);

  const participantsText = useMemo(() => {
    const count = offer?.participants_count ?? 0;
    const max = offer?.max_participants;
    if (!max) return String(count);
    const displayMax = count > max ? count : max;
    return `${count}/${displayMax}`;
  }, [offer?.participants_count, offer?.max_participants]);

  const backgroundUrl =
    offer?.category?.background_image_url ||
    offer?.category?.parent?.background_image_url ||
    "";

  const categoryLabel =
    getLocalizedText(offer?.category?.name, locale) || t("Groops");
  const titleLabel = getLocalizedText(offer?.title, locale) || t("offers.title");
  const isOwner = offer?.owner?.id === currentUserId;
  const ratingRaw =
    offer?.auth_user_rating ??
    offer?.average_rating ??
    offer?.ratings_avg_rating ??
    offer?.rating ??
    null;
  const ratingValue =
    typeof ratingRaw === "string" ? Number(ratingRaw) : ratingRaw;
  const hasRatingValue = Number.isFinite(ratingValue) && ratingValue > 0;
  const isOffersContext =
    pathname === "/app/auth/drawer/tabs" ||
    pathname?.startsWith("/app/auth/offers");
  const pendingCount = offer?.pending_participants_count ?? 0;
  const isOfferPending = offer?.status === "pending";
  const participantStatus = !isOwner && isParticipant;
  const pendingStatus = !isOwner && isPending;
  const statusLabel = (() => {
    if (offer?.is_draft || offer?.status === "draft") return t("Draft");
    if (isClosed) return t("closed");
    if (isOwner && offer?.localized_status) return offer.localized_status;
    if (pendingStatus) return t("pending request");
    if (participantStatus) return t("request_accepted");
    if (offer?.localized_status) return offer.localized_status;
    return t("Actives");
  })();
  const statusTone = (() => {
    if (offer?.is_draft || offer?.status === "draft") {
      return "bg-[#F1E5F6] text-secondary-600";
    }
    if (isClosed) return "bg-secondary-400 text-white";
    if (isOfferPending) return "bg-[#D59500] text-white";
    if (pendingStatus) return "bg-[#D59500] text-white";
    if (participantStatus) return "bg-secondary-500 text-white";
    return "bg-secondary-500 text-white";
  })();
  const isActiveStatus =
    (!isClosed &&
      !offer?.is_draft &&
      offer?.status === "active" &&
      !pendingStatus &&
      !participantStatus) ||
    statusLabel === t("Actives");
  const isRequestDisabled =
    isOwner || isParticipant || isPending || isClosed || actionState !== "idle";
  const showActionButton = !isOwner && !isParticipant && !isPending && !isClosed;
  const startsInLabel = useMemo(() => {
    if (!offer?.start_date) return "";
    if (
      isClosed ||
      offer?.is_draft ||
      offer?.status === "draft" ||
      offer?.status === "pending"
    ) {
      return "";
    }
    const startDateTime = combineDateAndTime(offer.start_date, offer.start_time);
    if (!startDateTime) return "";
    const diffMs = startDateTime.getTime() - now;
    if (diffMs > 0) {
      const formattedTime = formatTimeRemaining(diffMs, t);
      return t("starts_in_time", { time: formattedTime });
    }
    // Offer has started - show "In progress"
    return t("in_progress");
  }, [
    offer?.start_date,
    offer?.start_time,
    offer?.status,
    offer?.is_draft,
    isClosed,
    now,
    t
  ]);
  const showStartsIn = Boolean(startsInLabel);

  const href =
    offer?.owner?.id === currentUserId
      ? `/app/auth/my-offers/${offer.id}`
      : `/app/auth/offers/${offer.id}`;

  const handleToggleFavorite = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (actionState !== "idle" || isOwner) return;
    setActionError("");
    setActionState("favorite");
    try {
      await apiRequest(`offers/${offer.id}/favorite`, {
        method: isFavorite ? "DELETE" : "POST"
      });
      setIsFavorite((prev) => !prev);
      setFavoriteCount((prev) => (isFavorite ? Math.max(prev - 1, 0) : prev + 1));
    } catch (error) {
      setActionError(error?.message || "Unable to update favorite.");
    } finally {
      setActionState("idle");
    }
  };

  const handleOpenRequest = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isRequestDisabled) return;
    setActionError("");
    setRequestMessage("");
    setRequestModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (isRequestDisabled) return;
    setActionState("request");
    try {
      await apiRequest(`requests/${offer.id}`, {
        method: "POST",
        body: { message: requestMessage.trim() || null }
      });
      setIsPending(true);
      setRequestModalOpen(false);
    } catch (error) {
      setActionError(error?.message || "Unable to send request.");
    } finally {
      setActionState("idle");
    }
  };

  return (
    <>
      <Link
        href={href}
        className="group flex w-full flex-col overflow-hidden rounded-3xl border border-[#EADAF1] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      >
        <div className="relative h-36">
          {backgroundUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition group-hover:scale-105"
              style={{ backgroundImage: `url(${backgroundUrl})` }}
            />
          ) : (
            <div className="absolute inset-0 bg-[#F7F1FA]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />
          <div className="relative flex h-full flex-col justify-end px-4 pb-3">
            <span className="block max-w-full truncate text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
              {categoryLabel}
            </span>
            <h3 className="mt-1 truncate text-lg font-semibold text-primary-900">
              {titleLabel}
            </h3>
          </div>
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {isOffersContext && !isActiveStatus ? (
              <span
                className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold ${statusTone}`}
              >
                {statusLabel}
              </span>
            ) : null}
            <button
              type="button"
              onClick={handleToggleFavorite}
              disabled={isOwner}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                isFavorite
                  ? "bg-primary-600 text-white"
                  : "bg-white/90 text-primary-700"
              } ${isOwner ? "cursor-default opacity-70" : ""}`}
            >
              <HeartIcon filled={isFavorite} />
              {favoriteCount ? <span>{favoriteCount}</span> : null}
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-4 px-4 pb-4 pt-3">
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <UserAvatar user={offer.owner} size={52} withBorder />
                {offer?.owner?.age ? (
                  <span className="mt-1 text-[11px] text-secondary-400">
                    {t("years_old", { count: offer.owner.age })}
                  </span>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-primary-900">
                    {ownerFullName}
                  </p>
                  <div className="flex items-center gap-2">
                    {showRating && isClosed && hasRatingValue ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600">
                        <StarIcon filled />
                        {ratingValue.toFixed(1)}
                      </span>
                    ) : null}
                    {isOwner && pendingCount > 0 && !isClosed ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-secondary-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                        <UserPlusIcon size={14} className="text-white" />
                        {pendingCount > 99 ? "99" : pendingCount}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="mt-1 min-h-[28px]">
                  <UsersAvatarsList
                    users={offer.participants || []}
                    lastItemText={participantsText}
                  />
                </div>
              </div>
            </div>
            {showStartsIn ? (
              <div className="self-start">
                <span
                  className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold text-white"
                  style={{ backgroundColor: "rgb(35, 19, 106)" }}
                >
                  {startsInLabel}
                </span>
              </div>
            ) : null}
          </div>

          <div className="space-y-3">
            <OfferMainDetails offer={offer} />

            {showActionButton ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleOpenRequest}
                  disabled={isRequestDisabled}
                  className={`w-2/3 rounded-full px-4 py-2.5 text-xs font-semibold transition ${
                    isRequestDisabled
                      ? "bg-[#EADAF1] text-secondary-400"
                      : "bg-gradient-to-r from-primary-500 via-[#822485] to-secondary-500 text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {t("Participate")}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14" />
                      <path d="M13 5l6 7-6 7" />
                    </svg>
                  </span>
                </button>
              </div>
            ) : null}

            {actionError ? (
              <p className="text-xs text-danger-600">{actionError}</p>
            ) : null}
          </div>
        </div>
      </Link>

      <Modal
        open={isRequestModalOpen}
        title={t("Participation requests")}
        onClose={() => setRequestModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("Sending participation request")}
        </p>
        <textarea
          value={requestMessage}
          onChange={(event) => setRequestMessage(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm text-secondary-500 outline-none focus:border-primary-500"
          placeholder={t("Type your message here")}
        />
        {actionError ? (
          <p className="mt-3 text-xs text-danger-600">{actionError}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            label={t("Cancel")}
            className="w-full"
            onClick={() => setRequestModalOpen(false)}
            disabled={actionState === "request"}
          />
          <Button
            label={t("Submit")}
            className="w-full"
            onClick={handleSubmitRequest}
            loading={actionState === "request"}
          />
        </div>
      </Modal>
    </>
  );
}

function StarIcon({ filled }) {
  return (
    <svg
      width="14"
      height="14"
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
