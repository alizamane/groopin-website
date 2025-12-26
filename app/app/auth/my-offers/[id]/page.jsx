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

export default function MyOfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [offer, setOffer] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);

  const loadOffer = async () => {
    setStatus("loading");
    try {
      const payload = await apiRequest(`my-offers/${params.id}`);
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
    (offer?.is_draft
      ? t("Draft")
      : offer?.is_closed
        ? t("closed")
        : t("Actives"));
  const participantsText = offer?.max_participants
    ? `${offer.participants_count}/${offer.max_participants}`
    : String(offer.participants_count || 0);
  const pendingCount = offer?.pending_participants_count || 0;
  const dynamicAnswers = offer?.resolved_dynamic_answers || {};
  const dynamicEntries = Object.entries(dynamicAnswers);
  const isDraft = Boolean(offer?.is_draft) || offer?.status === "draft";
  const canPublish = isDraft && actionState === "idle";
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

  const handlePublish = async () => {
    if (!canPublish) return;
    setActionError("");
    setActionState("publish");
    try {
      await apiRequest(`my-offers/${offer.id}/publish`, { method: "POST" });
      await loadOffer();
    } catch (error) {
      setActionError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const handleDelete = async () => {
    if (actionState !== "idle") return;
    setActionError("");
    setActionState("delete");
    try {
      await apiRequest(`my-offers/${offer.id}`, { method: "DELETE" });
      setDeleteModalOpen(false);
      router.push("/app/auth/drawer/tabs/my-offers");
    } catch (error) {
      setActionError(error?.message || t("general.error_has_occurred"));
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
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold text-primary-900 md:text-3xl">
              {offer.title}
            </h1>
            <p className="text-sm text-secondary-400">
              {offer.city?.name || "-"} {offer.start_date ? t("Start date") : ""}{" "}
              {offer.start_date || ""}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <OfferMainDetails offer={offer} />
          </div>

          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
                  {t("Participants")}
                </h2>
                <p className="mt-2 text-sm text-secondary-400">
                  {participantsText} {t("Participants")}
                </p>
              </div>
              <UsersAvatarsList
                users={offer.participants || []}
                lastItemText={participantsText}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setParticipantsOpen(true)}
                className="inline-flex items-center rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white"
              >
                {t("Participants information")}
              </button>
              {pendingCount ? (
                <span className="inline-flex items-center rounded-full bg-[#D59500] px-4 py-2 text-xs font-semibold text-white">
                  {t("Participation requests")}: {pendingCount}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-[#F7F1FA] px-4 py-2 text-xs font-semibold text-secondary-600">
                  {t("No requests")}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t("Group Preferences")}
            </h2>
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

          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t("About")}
            </h2>
            <p className="mt-3 text-sm text-secondary-500">
              {offer.description || t("No description exists")}
            </p>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              {t("Organizer")}
            </h3>
            <div className="mt-4 flex items-center gap-3">
              <UserAvatar user={offer.owner} size={60} withBorder />
              <div>
                <p className="text-sm font-semibold text-primary-900">
                  {offer.owner?.first_name} {offer.owner?.last_name}
                </p>
                <p className="text-xs text-secondary-400">
                  {offer.owner?.age
                    ? t("years_old", { count: offer.owner.age })
                    : ""}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
              Owner actions
            </h3>
            <div className="mt-4 space-y-3">
              <Link href={`/app/auth/my-offers/${offer.id}/edit`}>
                <Button
                  label={isDraft ? "Edit draft" : t("Edit")}
                  size="lg"
                  className="w-full"
                />
              </Link>
              <Button
                variant="outline"
                label={
                  actionState === "delete"
                    ? t("Loading more...")
                    : t("Delete offer")
                }
                size="lg"
                className="w-full border-danger-600 text-danger-600"
                onClick={() => {
                  setActionError("");
                  setDeleteModalOpen(true);
                }}
                disabled={actionState !== "idle"}
              />
              {actionError ? (
                <p className="text-xs text-danger-600">{actionError}</p>
              ) : null}
            </div>
          </div>
        </aside>
      </div>

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
          <Link href={`/app/auth/my-offers/${offer.id}/participants`} className="w-full">
            <Button label={t("Participants information")} className="w-full" />
          </Link>
        </div>
      </Modal>

      <ConfirmModal
        open={isDeleteModalOpen}
        title={t("Delete offer")}
        description={t("Are you sure you want to remove your offer")}
        confirmLabel={t("Yes, remove")}
        confirmVariant="destructive"
        loading={actionState === "delete"}
        error={isDeleteModalOpen ? actionError : ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
