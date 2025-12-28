"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import UserAvatar from "../../../../../../components/user/user-avatar";
import Button from "../../../../../../components/ui/button";
import ConfirmModal from "../../../../../../components/ui/confirm-modal";
import { CheckIcon, XMarkIcon } from "../../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../../components/i18n-provider";
import { apiRequest } from "../../../../../lib/api-client";

const formatDate = (value, locale) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const getAge = (user) => {
  if (typeof user?.age === "number") return user.age;
  if (!user?.date_of_birth) return null;
  const date = new Date(user.date_of_birth);
  if (Number.isNaN(date.getTime())) return null;
  const diff = Date.now() - date.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export default function MyOfferParticipantsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [offer, setOffer] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [actionState, setActionState] = useState({ type: "", id: null });
  const [removeParticipantId, setRemoveParticipantId] = useState(null);
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";

  const loadOffer = async () => {
    const payload = await apiRequest(`my-offers/${params.id}`);
    const data = payload?.data || null;
    setOffer(data);
    setParticipants(data?.participants || []);
  };

  const loadRequests = async () => {
    const payload = await apiRequest(`offer-requests?offer_id=${params.id}`);
    setRequests(payload?.data || []);
  };

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      setStatus("loading");
      setError("");
      try {
        await Promise.all([loadOffer(), loadRequests()]);
        if (isMounted) setStatus("ready");
      } catch (err) {
        if (isMounted) {
          setError(err?.message || t("general.error_has_occurred"));
          setStatus("error");
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [params.id]);

  const ownerId = offer?.owner?.id;
  const ownerParticipant = useMemo(
    () => participants.find((user) => user.id === ownerId),
    [participants, ownerId]
  );
  const otherParticipants = useMemo(
    () => participants.filter((user) => user.id !== ownerId),
    [participants, ownerId]
  );

  const handleAccept = async (requestId) => {
    if (actionState.type) return;
    setActionState({ type: "accept", id: requestId });
    setError("");
    try {
      await apiRequest(`offer-requests/${requestId}/accept`, {
        method: "POST"
      });
      await Promise.all([loadOffer(), loadRequests()]);
    } catch (err) {
      setError(err?.message || t("general.error_has_occurred"));
    } finally {
      setActionState({ type: "", id: null });
    }
  };

  const handleReject = async (requestId) => {
    if (actionState.type) return;
    setActionState({ type: "reject", id: requestId });
    setError("");
    try {
      await apiRequest(`offer-requests/${requestId}`, { method: "DELETE" });
      await loadRequests();
    } catch (err) {
      setError(err?.message || t("general.error_has_occurred"));
    } finally {
      setActionState({ type: "", id: null });
    }
  };

  const handleRemoveParticipant = async () => {
    if (actionState.type || !removeParticipantId) return;
    setActionState({ type: "remove", id: removeParticipantId });
    setError("");
    try {
      await apiRequest(`offers/${params.id}/participants/${removeParticipantId}`, {
        method: "DELETE"
      });
      await loadOffer();
      setRemoveParticipantId(null);
    } catch (err) {
      setError(err?.message || t("general.error_has_occurred"));
    } finally {
      setActionState({ type: "", id: null });
    }
  };

  if (status === "loading") {
    return <div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />;
  }

  if (status === "error") {
    return <p className="text-sm text-danger-600">{error}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center">
        <Button
          variant="link"
          label={t("Close")}
          onClick={() =>
            router.push(`/app/auth/my-offers/${params.id}?tab=participants`)
          }
        />
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          {t("Participants")}
        </h1>
      </div>

      {error ? <p className="text-sm text-danger-600">{error}</p> : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-800">
            {t("Participation requests")}
          </h2>
          <span className="text-sm text-secondary-400">
            {requests.length}
          </span>
        </div>

        {requests.length === 0 ? (
          <p className="text-sm text-secondary-400">{t("No requests yet")}</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const user = request.user;
              const isBusy =
                actionState.id === request.id &&
                ["accept", "reject"].includes(actionState.type);
              const isAccepting =
                isBusy && actionState.type === "accept";
              const isRejecting =
                isBusy && actionState.type === "reject";
              return (
                <div
                  key={request.id}
                  className="rounded-2xl border border-[#EADAF1] bg-white p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Link
                      href={`/app/auth/users/${user.id}`}
                      className="flex min-w-0 items-center gap-3"
                    >
                      <UserAvatar user={user} size={52} withBorder />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-secondary-400">
                          {getAge(user)
                            ? t("years_old", { count: getAge(user) })
                            : ""}
                        </p>
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(request.id)}
                        disabled={isBusy}
                        aria-label={t("Accepted")}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-success-600 text-white shadow-sm transition hover:bg-success-700 disabled:opacity-60"
                      >
                        {isAccepting ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <CheckIcon
                            size={18}
                            className="text-white"
                          />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReject(request.id)}
                        disabled={isBusy}
                        aria-label={t("Decline participant")}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-600 text-white shadow-sm transition hover:bg-danger-700 disabled:opacity-60"
                      >
                        {isRejecting ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                          <XMarkIcon
                            size={18}
                            className="text-white"
                          />
                        )}
                      </button>
                    </div>
                  </div>
                  {request.message ? (
                    <p className="mt-3 text-xs text-secondary-500">
                      {request.message}
                    </p>
                  ) : null}
                  <p className="mt-2 text-[11px] text-secondary-400">
                    {formatDate(request.created_at, dateLocale)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary-800">
            {t("Participants")}
          </h2>
          <span className="text-sm text-secondary-400">
            {participants.length}
          </span>
        </div>

        {participants.length === 0 ? (
          <p className="text-sm text-secondary-400">
            {t("No participants yet")}
          </p>
        ) : (
          <div className="space-y-3">
            {ownerParticipant ? (
              <div className="rounded-2xl border border-[#EADAF1] bg-white p-4">
                <Link
                  href={`/app/auth/users/${ownerParticipant.id}`}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar user={ownerParticipant} size={52} withBorder />
                    <div>
                      <p className="text-sm font-semibold text-primary-900">
                        {ownerParticipant.first_name}{" "}
                        {ownerParticipant.last_name}
                      </p>
                      <p className="text-xs text-secondary-400">
                        {t("Organizer")}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary-600/10 px-3 py-1 text-[10px] font-semibold text-primary-900">
                    {t("Organizer")}
                  </span>
                </Link>
              </div>
            ) : null}

            {otherParticipants.map((user) => {
              const isRemoving =
                actionState.type === "remove" && actionState.id === user.id;
              return (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EADAF1] bg-white p-4"
                >
                  <Link
                    href={`/app/auth/users/${user.id}`}
                    className="flex items-center gap-3"
                  >
                    <UserAvatar user={user} size={52} withBorder />
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
                  </Link>
                  <Button
                    variant="outline"
                    label={
                      isRemoving ? t("Loading more...") : t("Remove participant")
                    }
                    size="sm"
                    className="border-danger-600 text-danger-600"
                    onClick={() => {
                      setError("");
                      setRemoveParticipantId(user.id);
                    }}
                    disabled={isRemoving}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmModal
        open={Boolean(removeParticipantId)}
        title={t("Remove participant")}
        description={t("Are you sure you want to remove this participant?")}
        confirmLabel={t("Remove participant")}
        confirmVariant="destructive"
        loading={actionState.type === "remove"}
        error={removeParticipantId ? error : ""}
        onConfirm={handleRemoveParticipant}
        onClose={() => setRemoveParticipantId(null)}
      />
    </div>
  );
}
