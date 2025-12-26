"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import OfferMainDetails from "../../../../../components/offers/offer-main-details";
import UserAvatar from "../../../../../components/user/user-avatar";
import UsersAvatarsList from "../../../../../components/user/users-avatars-list";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import ConfirmModal from "../../../../../components/ui/confirm-modal";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getUser } from "../../../../lib/session";

const HeartIcon = ({ filled }) => (
  <svg
    width="18"
    height="18"
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

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [offer, setOffer] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [reportError, setReportError] = useState("");
  const [requestMessage, setRequestMessage] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const [isCancelModalOpen, setCancelModalOpen] = useState(false);
  const [isRemoveModalOpen, setRemoveModalOpen] = useState(false);
  const currentUser = getUser();

  const loadOffer = async () => {
    setStatus("loading");
    try {
      const payload = await apiRequest(`offers/${params.id}`);
      setOffer(payload?.data || null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadOffer();
  }, [params.id]);

  if (status === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  if (status === "error" || !offer) {
    return (
      <p className="text-sm text-danger-600">{t("no_offer_available")}</p>
    );
  }

  const backgroundUrl =
    offer?.category?.background_image_url ||
    offer?.category?.parent?.background_image_url ||
    "";
  const statusLabel =
    offer?.localized_status ||
    (offer?.is_closed ? t("closed") : t("Actives"));
  const ownerName = `${offer.owner?.first_name || ""} ${
    offer.owner?.last_name || ""
  }`.trim();
  const participantCount = offer?.participants_count ?? 0;
  const maxParticipants = offer?.max_participants ?? null;
  const maxParticipantsLabel = maxParticipants ?? "-";
  const isOwner = currentUser && offer?.owner?.id === currentUser.id;
  const isParticipant = Boolean(offer?.auth_user_is_participant);
  const isPending = Boolean(offer?.auth_user_is_pending_participant);
  const isClosed = Boolean(offer?.is_closed) || offer?.status === "closed";
  const isActionDisabled = isOwner || isParticipant || isPending || isClosed;
  const actionLabel = isOwner
    ? t("My offer")
    : isParticipant
      ? t("Participating")
      : isPending
        ? t("pending request")
        : isClosed
          ? t("closed")
          : t("Participate");
  const isActionLoading = actionState !== "idle";
  const isFavorite = Boolean(offer?.auth_user_is_favorite);
  const favoriteCount =
    offer?.favorited_by_count ?? offer?.favorited_by?.length ?? 0;
  const participantsText = maxParticipants
    ? `${participantCount}/${participantCount > maxParticipants ? participantCount : maxParticipants}`
    : String(participantCount);
  const participantsHref = isOwner
    ? `/app/auth/my-offers/${offer.id}/participants`
    : `/app/auth/offers/${offer.id}/participants`;
  const dynamicAnswers = offer?.resolved_dynamic_answers || {};
  const dynamicEntries = Object.entries(dynamicAnswers);
  const participantsList = offer?.participants || [];
  const ownerParticipant = participantsList.find(
    (user) => user.id === offer?.owner?.id
  );
  const otherParticipants = participantsList.filter(
    (user) => user.id !== offer?.owner?.id
  );

  const getAge = (user) => {
    if (typeof user?.age === "number") return user.age;
    if (!user?.date_of_birth) return null;
    const date = new Date(user.date_of_birth);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };
  const cardBase = "rounded-3xl border border-[#EADAF1] bg-white p-5";
  const sectionTitle =
    "text-sm font-semibold uppercase tracking-[0.2em] text-primary-700";
  const userStatusLabel = isOwner
    ? t("Organizer")
    : isParticipant
      ? t("Participating")
      : isPending
        ? t("Pending")
        : isClosed
          ? t("closed")
          : t("In Progress");
  const stats = [
    { label: t("Favorites"), value: favoriteCount || 0 },
    { label: "Status", value: statusLabel }
  ];
  const showRequestButton =
    !isParticipant && !isPending && !isClosed && !isOwner;

  const refreshOffer = async () => {
    const payload = await apiRequest(`offers/${params.id}`);
    setOffer(payload?.data || null);
  };

  const handleOpenRequestModal = () => {
    if (isActionDisabled || isActionLoading) return;
    setActionError("");
    setRequestModalOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (isActionDisabled || isActionLoading) return;
    setActionError("");
    setActionState("request");
    try {
      const message = requestMessage.trim();
      await apiRequest(`requests/${params.id}`, {
        method: "POST",
        body: { message: message || null }
      });
      setRequestModalOpen(false);
      setRequestMessage("");
      await refreshOffer();
    } catch (error) {
      setActionError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const handleCancelRequest = async () => {
    if (isActionLoading) return;
    setActionError("");
    setActionState("cancel");
    try {
      await apiRequest(`requests/${params.id}`, { method: "DELETE" });
      await refreshOffer();
      setCancelModalOpen(false);
    } catch (error) {
      setActionError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const handleRemoveParticipation = async () => {
    if (isActionLoading || isClosed) return;
    setActionError("");
    setActionState("remove");
    try {
      await apiRequest(`participating/${params.id}`, { method: "DELETE" });
      await refreshOffer();
      setRemoveModalOpen(false);
    } catch (error) {
      setActionError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const handleToggleFavorite = async () => {
    if (isActionLoading) return;
    setFavoriteError("");
    setActionState("favorite");
    try {
      await apiRequest(`offers/${params.id}/favorite`, {
        method: isFavorite ? "DELETE" : "POST"
      });
      await refreshOffer();
    } catch (error) {
      setFavoriteError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const handleReportOffer = async () => {
    const reason = reportReason.trim();
    if (!reason) {
      setReportError(t("general.invalid_submission"));
      return;
    }
    if (isActionLoading) return;
    setReportError("");
    setActionState("report");
    try {
      await apiRequest("signal-offer", {
        method: "POST",
        body: { offer_id: offer.id, reason }
      });
      setReportModalOpen(false);
      setReportReason("");
      await refreshOffer();
    } catch (error) {
      setReportError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-[#EADAF1] bg-white">
        {backgroundUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundUrl})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-[#F7F1FA]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent" />
        <div className="relative flex flex-col gap-4 px-5 pb-6 pt-20">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary-600">
              {offer?.category?.name || t("Groops")}
            </span>
            <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold text-primary-700">
              {statusLabel}
            </span>
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
                {offer.title}
              </h1>
              <p className="text-sm text-secondary-400">
                {offer.city?.name || "-"} {offer.start_date ? t("Start date") : ""}{" "}
                {offer.start_date || ""}
              </p>
              <div className="flex flex-wrap gap-2">
                {isPending ? (
                  <span className="rounded-full bg-[#D59500] px-3 py-1 text-xs font-semibold text-white">
                    {t("Pending")}
                  </span>
                ) : null}
                {isParticipant && !isClosed ? (
                  <span className="rounded-full bg-primary-600 px-3 py-1 text-xs font-semibold text-white">
                    {t("Participating")}
                  </span>
                ) : null}
                {isClosed ? (
                  <span className="rounded-full bg-secondary-400 px-3 py-1 text-xs font-semibold text-white">
                    {t("closed")}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleFavorite}
                disabled={actionState === "favorite"}
                aria-pressed={isFavorite}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isFavorite
                    ? "bg-primary-600 text-white"
                    : "bg-white/90 text-primary-700"
                }`}
              >
                <HeartIcon filled={isFavorite} />
                <span>{t("Favorites")}</span>
              </button>
              {favoriteCount ? (
                <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-primary-700">
                  {favoriteCount}
                </span>
              ) : null}
            </div>
          </div>
          {favoriteError ? (
            <p className="text-xs text-danger-600">{favoriteError}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className={cardBase}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>{t("Organizer")}</h2>
              {isOwner ? (
                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-xs font-semibold text-primary-900">
                  {t("Organizer")}
                </span>
              ) : null}
            </div>
            <Link
              href={`/app/auth/users/${offer.owner?.id}`}
              className="mt-4 flex items-center gap-3"
            >
              <UserAvatar user={offer.owner} size={60} withBorder />
              <div>
                <p className="text-sm font-semibold text-primary-900">
                  {ownerName || "-"}
                </p>
                <p className="text-xs text-secondary-400">
                  {offer.owner?.age
                    ? t("years_old", { count: offer.owner.age })
                    : ""}
                </p>
              </div>
            </Link>
          </div>

          {!isOwner ? (
            <div className={cardBase}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitle}>Your status</h2>
                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-xs font-semibold text-primary-900">
                  {userStatusLabel}
                </span>
              </div>
              {showRequestButton ? (
                <Button
                  label={actionLabel}
                  size="sm"
                  className="mt-4 w-full md:w-auto"
                  disabled={isActionDisabled || isActionLoading}
                  onClick={handleOpenRequestModal}
                  loading={actionState === "request"}
                />
              ) : null}
              {isParticipant ? (
                <Button
                  variant="outline"
                  label={
                    actionState === "remove"
                      ? t("Loading more...")
                      : t("Remove participation")
                  }
                  size="sm"
                  className="mt-3 w-full border-danger-600 text-danger-600 md:w-auto"
                  disabled={isClosed || isActionLoading}
                  onClick={() => {
                    setActionError("");
                    setRemoveModalOpen(true);
                  }}
                />
              ) : null}
              {isPending ? (
                <Button
                  variant="outline"
                  label={
                    actionState === "cancel"
                      ? t("Canceling request")
                      : t("Cancel request")
                  }
                  size="sm"
                  className="mt-3 w-full border-danger-600 text-danger-600 md:w-auto"
                  disabled={isActionLoading}
                  onClick={() => {
                    setActionError("");
                    setCancelModalOpen(true);
                  }}
                />
              ) : null}
              {isClosed && isParticipant ? (
                <Button
                  variant="secondary"
                  label={t("Rate this experience")}
                  size="sm"
                  className="mt-3 w-full md:w-auto"
                  onClick={() =>
                    router.push(`/app/auth/profile/offer-rating/${offer.id}`)
                  }
                />
              ) : null}
              {actionError ? (
                <p className="mt-3 text-xs text-danger-600">{actionError}</p>
              ) : null}
            </div>
          ) : null}

          <div className={cardBase}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>{t("Details")}</h2>
              <span className="rounded-full bg-primary-600/10 px-3 py-1 text-xs font-semibold text-primary-900">
                {userStatusLabel}
              </span>
            </div>
            <div className="mt-4">
              <OfferMainDetails offer={offer} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#EADAF1] bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">
                  {t("Participants")}
                </p>
                <p className="mt-2 text-sm font-semibold text-primary-900">
                  {participantsText}
                </p>
                <div className="mt-3">
                  <UsersAvatarsList
                    users={offer.participants || []}
                    lastItemText={participantsText}
                  />
                </div>
                {participantCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setParticipantsOpen(true)}
                      className="mt-3 inline-flex items-center rounded-full bg-primary-600 px-3 py-2 text-[10px] font-semibold text-white"
                    >
                      {t("Participants information")}
                    </button>
                ) : (
                  <p className="mt-3 text-xs text-secondary-400">
                    {t("No participants yet")}
                  </p>
                )}
              </div>
              <div className="flex flex-col gap-3">
                {stats.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[#EADAF1] bg-white px-4 py-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-primary-900">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={cardBase}>
            <h2 className={sectionTitle}>{t("About")}</h2>
            <p className="mt-3 text-sm text-secondary-500">
              {offer.description || t("No description exists")}
            </p>
          </div>

          <div className={cardBase}>
            <h2 className={sectionTitle}>{t("Group Preferences")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {dynamicEntries.length ? (
                dynamicEntries.map(([key, value]) => (
                  <span
                    key={key}
                    className="rounded-full bg-primary-600/10 px-3 py-2 text-xs font-semibold text-primary-900"
                  >
                    {value}
                  </span>
                ))
              ) : (
                <p className="text-sm text-secondary-400">
                  {t("No Preferences for this group")}
                </p>
              )}
            </div>
          </div>

        </section>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className={cardBase}>
            <h3 className={sectionTitle}>Actions</h3>
            <Button
              variant="outline"
              label={
                offer.reported_by_auth_user
                  ? t("Already reported")
                  : t("Report offer")
              }
              size="sm"
              className="mt-4 w-full md:w-auto"
              disabled={offer.reported_by_auth_user || isActionLoading}
              onClick={() => {
                setReportError("");
                setReportModalOpen(true);
              }}
            />
          </div>
        </aside>
      </div>

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
            disabled={isActionLoading}
          />
          <Button
            label={t("Submit")}
            className="w-full"
            onClick={handleSubmitRequest}
            loading={actionState === "request"}
          />
        </div>
      </Modal>

      <Modal
        open={isReportModalOpen}
        title={t("Report offer")}
        onClose={() => setReportModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("Repporting subtitle")}
        </p>
        <textarea
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm text-secondary-500 outline-none focus:border-primary-500"
          placeholder={t("reppporting placeholder")}
        />
        {reportError ? (
          <p className="mt-3 text-xs text-danger-600">{reportError}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            label={t("Cancel")}
            className="w-full"
            onClick={() => setReportModalOpen(false)}
            disabled={isActionLoading}
          />
          <Button
            label={t("Submit")}
            className="w-full"
            onClick={handleReportOffer}
            loading={actionState === "report"}
            disabled={!reportReason.trim()}
          />
        </div>
      </Modal>

      <Modal
        open={isParticipantsOpen}
        title={t("Participants")}
        onClose={() => setParticipantsOpen(false)}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {ownerParticipant ? (
            <div className="rounded-2xl border border-[#EADAF1] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-600">
                {t("Organizer")}
              </p>
              <Link
                href={`/app/auth/users/${ownerParticipant.id}`}
                className="mt-3 flex items-center gap-3"
              >
                <UserAvatar user={ownerParticipant} size={52} withBorder />
                <div>
                  <p className="text-sm font-semibold text-primary-900">
                    {ownerParticipant.first_name}{" "}
                    {ownerParticipant.last_name}
                  </p>
                  <p className="text-xs text-secondary-400">
                    {getAge(ownerParticipant)
                      ? t("years_old", { count: getAge(ownerParticipant) })
                      : ""}
                  </p>
                </div>
              </Link>
            </div>
          ) : null}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary-900">
                {t("Participants")}
              </h3>
              <span className="text-xs text-secondary-400">
                {otherParticipants.length}
              </span>
            </div>

            {otherParticipants.length === 0 ? (
              <p className="text-sm text-secondary-400">
                {t("No participants yet")}
              </p>
            ) : (
              otherParticipants.map((user) => (
                <Link
                  key={user.id}
                  href={`/app/auth/users/${user.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#EADAF1] bg-white p-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={user} size={44} withBorder />
                    <div>
                      <p className="text-sm font-semibold text-primary-900">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-secondary-400">
                        {getAge(user)
                          ? t("years_old", { count: getAge(user) })
                          : ""}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-secondary-500">
                    {t("Profile")}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setParticipantsOpen(false)}
          />
          {participantCount > 0 ? (
            <Link href={participantsHref} className="w-full">
              <Button label={t("Participants information")} className="w-full" />
            </Link>
          ) : null}
        </div>
      </Modal>

      <ConfirmModal
        open={isCancelModalOpen}
        title={t("Cancel request")}
        description={t("Are you sure you want to cancel your request?")}
        confirmLabel={t("yes_cancel")}
        confirmVariant="destructive"
        loading={actionState === "cancel"}
        error={isCancelModalOpen ? actionError : ""}
        onConfirm={handleCancelRequest}
        onClose={() => setCancelModalOpen(false)}
      />

      <ConfirmModal
        open={isRemoveModalOpen}
        title={t("Remove participation")}
        description={t("Are you sure you want to remove your participation?")}
        confirmLabel={t("Yes, remove")}
        confirmVariant="destructive"
        loading={actionState === "remove"}
        error={isRemoveModalOpen ? actionError : ""}
        onConfirm={handleRemoveParticipation}
        onClose={() => setRemoveModalOpen(false)}
      />
    </div>
  );
}
