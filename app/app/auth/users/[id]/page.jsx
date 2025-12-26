"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import OfferCard from "../../../../../components/offers/offer-card";
import UserAvatar from "../../../../../components/user/user-avatar";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import ConfirmModal from "../../../../../components/ui/confirm-modal";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getUser } from "../../../../lib/session";

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportError, setReportError] = useState("");
  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [isActionsModalOpen, setActionsModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState("");
  const currentUser = getUser();
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";

  const loadUser = async () => {
    setStatus("loading");
    try {
      const payload = await apiRequest(`users/${params.id}`);
      setUser(payload?.data || null);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    loadUser();
  }, [params.id]);

  if (status === "loading") {
    return <div className="h-32 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  if (status === "error" || !user) {
    return (
      <p className="text-sm text-danger-600">
        {t("general.error_has_occurred")}
      </p>
    );
  }

  const isSelf = currentUser?.id === user?.id;
  const isActionLoading = actionState !== "idle";

  const refreshUser = async () => {
    const payload = await apiRequest(`users/${params.id}`);
    setUser(payload?.data || null);
  };

  const handleToggleBlock = async () => {
    if (isSelf || isActionLoading) return;
    setActionError("");
    const nextState = user.blocked ? "unblock" : "block";
    setActionState(nextState);
    try {
      if (user.blocked) {
        await apiRequest(`block-user/${user.id}`, { method: "DELETE" });
      } else {
        await apiRequest("block-user", {
          method: "POST",
          body: { user_id: user.id }
        });
      }
      await refreshUser();
      setConfirmAction("");
    } catch (error) {
      setActionError(error?.message || "Unable to update block status.");
    } finally {
      setActionState("idle");
    }
  };

  const handleReportUser = async () => {
    const reason = reportReason.trim();
    if (!reason) {
      setReportError(t("general.invalid_submission"));
      return;
    }
    if (isSelf || isActionLoading) return;
    setReportError("");
    setActionState("report");
    try {
      await apiRequest("signal-user", {
        method: "POST",
        body: { user_id: user.id, reason }
      });
      setReportModalOpen(false);
      setReportReason("");
      await refreshUser();
    } catch (error) {
      setReportError(error?.message || t("general.error_has_occurred"));
    } finally {
      setActionState("idle");
    }
  };

  const memberSinceDate = user?.created_at ? new Date(user.created_at) : null;
  const memberSinceLabel =
    memberSinceDate && !Number.isNaN(memberSinceDate.valueOf())
      ? memberSinceDate.toLocaleDateString(dateLocale, {
          month: "long",
          year: "numeric"
        })
      : "-";

  const createdOffers = user?.owning_offers || [];
  const participatedOffers = user?.participated_offers || [];
  const createdCount =
    typeof user?.owning_offers_count === "number"
      ? user.owning_offers_count
      : createdOffers.length;
  const participatedCount =
    typeof user?.participated_offers_count === "number"
      ? user.participated_offers_count
      : participatedOffers.length;

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
    { label: t("ratings"), value: user?.received_ratings_count ?? "-" }
  ];

  return (
    <div className="space-y-6 pb-6">
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isSelf ? (
          <div>
            <h1 className="text-2xl font-semibold text-primary-900">
              {t("profile.title")}
            </h1>
            <p className="text-secondary-400">
              {t("profile.complete_profile_question")}
            </p>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:static sm:ml-auto">
          {isSelf ? (
            <Link href="/app/auth/profile/edit">
              <Button
                label={t("profile.edit_profile")}
                size="sm"
                className="px-4"
              />
            </Link>
          ) : null}
        </div>
      </div>

      <div className="flex items-start justify-between gap-4">
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
        {!isSelf ? (
          <button
            type="button"
            onClick={() => setActionsModalOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#EADAF1] text-secondary-600 transition hover:bg-[#F7F1FA]"
            aria-label={t("Actions")}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
        ) : null}
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
                      {String(item.value)}
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
              <div className="grid auto-rows-fr items-stretch gap-5 md:grid-cols-2">
                {createdOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    currentUserId={currentUser?.id}
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
              <div className="grid auto-rows-fr items-stretch gap-5 md:grid-cols-2">
                {participatedOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    currentUserId={currentUser?.id}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <Modal
        open={isReportModalOpen}
        title={t("Report user")}
        onClose={() => setReportModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("Please explain why you are reporting this user")}
        </p>
        <textarea
          value={reportReason}
          onChange={(event) => setReportReason(event.target.value)}
          rows={4}
          className="mt-3 w-full rounded-2xl border border-[#EADAF1] px-4 py-3 text-sm text-secondary-500 outline-none focus:border-primary-500"
          placeholder={t("Reason")}
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
            onClick={handleReportUser}
            loading={actionState === "report"}
            disabled={!reportReason.trim()}
          />
        </div>
      </Modal>

      <Modal
        open={isActionsModalOpen}
        title={t("Actions")}
        onClose={() => setActionsModalOpen(false)}
      >
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            label={user.signaled ? t("Already reported") : t("Report user")}
            className="w-full"
            disabled={user.signaled || isActionLoading}
            onClick={() => {
              setActionsModalOpen(false);
              setReportError("");
              setReportModalOpen(true);
            }}
          />
          <Button
            variant={user.blocked ? "secondary" : "destructive"}
            label={user.blocked ? t("Unblock user") : t("Block user")}
            className="w-full"
            disabled={isActionLoading}
            onClick={() => {
              setActionsModalOpen(false);
              setActionError("");
              setConfirmAction(user.blocked ? "unblock" : "block");
            }}
          />
        </div>
      </Modal>

      <ConfirmModal
        open={Boolean(confirmAction)}
        title={
          confirmAction === "block" ? t("Blocking user") : t("Unblock user")
        }
        description={
          confirmAction === "block"
            ? `${t("confirm blocking user")} ${user?.first_name || ""} ${
                user?.last_name || ""
              }\n\n${t("Block effects")}`
            : t("Unblock users from the list")
        }
        confirmLabel={
          confirmAction === "block" ? t("Block user") : t("Unblock user")
        }
        confirmVariant={confirmAction === "block" ? "destructive" : "secondary"}
        loading={["block", "unblock"].includes(actionState)}
        error={confirmAction ? actionError : ""}
        onConfirm={handleToggleBlock}
        onClose={() => setConfirmAction("")}
      />
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
