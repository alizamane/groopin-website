"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { apiRequest } from "../../../../lib/api-client";
import { useI18n } from "../../../../../components/i18n-provider";
import {
  ArrowUturnLeftIcon,
  CheckCircleIcon,
  ClockIcon as HeroClockIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon as HeroInformationCircleIcon,
  SparklesIcon,
  StarIcon as HeroStarIcon,
  TrashIcon as HeroTrashIcon,
  UserMinusIcon as HeroUserMinusIcon,
  UserPlusIcon as HeroUserPlusIcon,
  XCircleIcon
} from "../../../../../components/ui/heroicons";

const formatDate = (value, locale) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const parsePayload = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof value === "object") return value;
  return null;
};

const getPayload = (notification) => {
  const candidates = [
    notification?.data?.data?.data,
    notification?.data?.data,
    notification?.data
  ];

  for (const candidate of candidates) {
    const parsed = parsePayload(candidate);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed;
    }
  }

  return parsePayload(notification?.data) || {};
};

const getFallbackTitle = (type = "") => {
  const map = {
    offer_approved: "Offer approved",
    offer_refused: "Offer refused",
    offer_created: "Offer created",
    offer_draft: "Offer draft saved",
    offer_signaled: "Offer reported",
    participation_request_received: "Participation request received",
    participation_request_accepted: "Participation accepted",
    participation_request_rejected: "Participation rejected",
    participation_request_removed: "Participation removed",
    participation_request_canceled: "Participation canceled",
    participation_request_exits: "Participation request exit",
    participation_offerremoved: "Offer removed",
    participation_leavereview: "Leave a review",
    account_deleted: "Account deleted",
    "App\\Notifications\\Offer\\OfferApprovedNotification": "Offer approved",
    "App\\Notifications\\Offer\\OfferRefusedNotification": "Offer refused",
    "App\\Notifications\\Offer\\OfferCreatedNotification": "Offer created",
    "App\\Notifications\\Offer\\OfferDraftNotification": "Offer draft saved",
    "App\\Notifications\\Offer\\OfferRemovedNotification": "Offer removed",
    "App\\Notifications\\Offer\\OfferSignaledNotification": "Offer reported",
    "App\\Notifications\\Offer\\ParticipationLeaveReviewTripNotification":
      "Leave a review",
    "App\\Notifications\\User\\AccountDeletedNotification": "Account deleted",
    "App\\Notifications\\User\\ParticipationRequestRemovedNotification":
      "Participation removed",
    "App\\Notifications\\User\\ParticipationRequestCanceledNotification":
      "Participation canceled",
    "App\\Notifications\\User\\ParticipationRequestExitsNotification":
      "Participation request exit"
  };

  return map[type] || "Notification";
};

const resolveNotificationContent = (notification) => {
  const payload = getPayload(notification);
  const nested = payload?.data || {};
  const title =
    payload?.title ||
    nested?.title ||
    notification?.data?.title ||
    notification?.title ||
    getFallbackTitle(notification?.type);
  const body =
    payload?.body ||
    nested?.body ||
    notification?.data?.body ||
    notification?.message ||
    payload?.message ||
    nested?.message ||
    "";

  return { title, body };
};

const resolveNotificationRoute = (notification) => {
  const payload = getPayload(notification);
  const action = payload?.action;
  const offerId = payload?.offer_id;

  if (action) {
    switch (action) {
      case "offer.approved":
        return offerId ? `/app/auth/my-offers/${offerId}` : "";
      case "offer.refused":
        return "/app/auth/drawer/tabs/my-offers";
      case "offer.created":
      case "offer.draft":
      case "offer.draft.reminder":
        return offerId ? `/app/auth/my-offers/${offerId}/edit` : "";
      case "participation.request.received":
      case "participation.request.canceled":
      case "participation.request.removed":
      case "participation.request.exits":
        return offerId
          ? `/app/auth/my-offers/${offerId}/participants`
          : "";
      case "participation.request.accepted":
      case "participation.request.rejected":
        return offerId ? `/app/auth/offers/${offerId}` : "";
      case "participation.offerremoved":
        return "/app/auth/participating";
      case "participation.leavereview":
        return offerId ? `/app/auth/profile/offer-rating/${offerId}` : "";
    }
  }

  if (notification.type === "offer_approved" && offerId) {
    return `/app/auth/my-offers/${offerId}`;
  }

  if (notification.type === "participation_request_received" && offerId) {
    return `/app/auth/my-offers/${offerId}/participants`;
  }

  if (
    [
      "participation_request_accepted",
      "participation_request_rejected",
      "App\\Notifications\\Offer\\ParticipationLeaveReviewTripNotification"
    ].includes(notification.type)
  ) {
    return offerId ? `/app/auth/profile/offer-rating/${offerId}` : "";
  }

  if (
    [
      "participation_offerremoved",
      "App\\Notifications\\Offer\\OfferRemovedNotification"
    ].includes(notification.type)
  ) {
    return "/app/auth/participating";
  }

  if (offerId) {
    return `/app/auth/my-offers/${offerId}`;
  }

  return "";
};

export default function NotificationsPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [notifications, setNotifications] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(null);
  const sentinelRef = useRef(null);
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";

  const broadcastUnreadCount = useCallback((count) => {
    window.dispatchEvent(
      new CustomEvent("notifications:updated", {
        detail: { unreadCount: count }
      })
    );
  }, []);

  const updateUnreadCount = useCallback(
    (items, metaCount = null) => {
      const computed = items.filter((item) => !item?.read_at).length;
      const count =
        typeof metaCount === "number" ? metaCount : computed;
      setUnreadTotal(count);
    },
    []
  );

  const updateUnreadDelta = useCallback(
    (items, delta) => {
      setUnreadTotal((prev) => {
        const computed = items.filter((item) => !item?.read_at).length;
        const next =
          typeof prev === "number" ? Math.max(prev + delta, 0) : computed;
        return next;
      });
    },
    []
  );

  const loadNotifications = useCallback(
    async (cursor = null) => {
      if (cursor) {
        setIsLoadingMore(true);
      } else {
        setStatus("loading");
      }
      try {
        const endpoint = cursor
          ? `notifications?cursor=${encodeURIComponent(cursor)}&lite=1`
          : "notifications?lite=1";
        const payload = await apiRequest(endpoint, { cache: false });
        const nextItems = payload?.data || [];
        const nextMetaCursor = payload?.meta?.next_cursor || null;
        setNotifications((prev) => {
          const merged = cursor ? [...prev, ...nextItems] : nextItems;
          updateUnreadCount(merged, payload?.meta?.unread_count);
          return merged;
        });
        setNextCursor(nextMetaCursor);
        setHasNextPage(Boolean(nextMetaCursor));
        setStatus("ready");
        setError("");
      } catch (err) {
        if (cursor) {
          setError(err?.message || t("general.error_has_occurred"));
          setStatus("ready");
        } else {
          setError(err?.message || t("general.error_has_occurred"));
          setStatus("error");
        }
      } finally {
        setIsLoadingMore(false);
      }
    },
    [t, updateUnreadCount]
  );

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (typeof unreadTotal === "number") {
      broadcastUnreadCount(unreadTotal);
    }
  }, [broadcastUnreadCount, unreadTotal]);

  const markAsRead = async (notificationId) => {
    try {
      await apiRequest(`notifications/${notificationId}/mark-as-read`, {
        method: "PUT"
      });
      setNotifications((prev) => {
        const next = prev.map((item) => {
          if (item.id !== notificationId) return item;
          return { ...item, read_at: new Date().toISOString() };
        });
        updateUnreadDelta(next, -1);
        return next;
      });
    } catch {
      // ignore
    }
  };

  const markAllAsRead = async () => {
    if (isMarkingAll) return;
    const unreadItems = notifications.filter((item) => !item?.read_at);
    if (unreadItems.length === 0) return;
    setIsMarkingAll(true);
    try {
      await Promise.all(
        unreadItems.map((item) =>
          apiRequest(`notifications/${item.id}/mark-as-read`, {
            method: "PUT"
          })
        )
      );
      setNotifications((prev) => {
        const next = prev.map((item) =>
          item.read_at ? item : { ...item, read_at: new Date().toISOString() }
        );
        updateUnreadDelta(next, -unreadItems.length);
        return next;
      });
    } catch {
      // ignore
    } finally {
      setIsMarkingAll(false);
    }
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    if (!hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasNextPage &&
          !isLoadingMore &&
          status === "ready"
        ) {
          loadNotifications(nextCursor);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isLoadingMore, loadNotifications, nextCursor, status]);

  const handleNotificationClick = async (notification) => {
    const isRead = Boolean(notification?.read_at);
    if (!isRead) {
      await markAsRead(notification.id);
    }
    const target = resolveNotificationRoute(notification);
    if (target) {
      router.push(target);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-primary-800">
          {t("Notifications")}
        </h1>
        <button
          type="button"
          onClick={markAllAsRead}
          className="text-xs font-semibold text-secondary-600"
          disabled={isMarkingAll}
        >
          {isMarkingAll ? t("Loading more...") : t("mark_all_as_read")}
        </button>
      </div>

      {status === "loading" ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={`skeleton-${index}`}
              className="h-20 animate-pulse rounded-2xl bg-neutral-100"
            />
          ))}
        </div>
      ) : null}

      {status === "error" ? (
        <p className="text-sm text-danger-600">{error}</p>
      ) : null}

      {status === "ready" && notifications.length === 0 ? (
        <p className="text-sm text-secondary-400">
          {t("No notifications yet")}
        </p>
      ) : null}

      {status === "ready" ? (
        <>
          <div className="overflow-hidden rounded-2xl border border-[#EADAF1] bg-white">
            {notifications.map((notification) => {
              const { title, body } = resolveNotificationContent(notification);
              const isRead = Boolean(notification?.read_at);

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex w-full items-start gap-3 border-b border-[#EADAF1] px-4 py-4 text-left transition ${
                    isRead ? "bg-white" : "bg-[#F7F1FA]"
                  }`}
                >
                  <NotificationIcon notification={notification} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-sm font-semibold text-primary-800">
                        {title}
                      </p>
                      {!isRead ? (
                        <span className="h-2 w-2 rounded-full bg-secondary-600" />
                      ) : null}
                    </div>
                    {body ? (
                      <p className="mt-1 text-xs text-secondary-500">{body}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-secondary-400">
                      {formatDate(notification.created_at, dateLocale)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {hasNextPage ? (
            <div
              ref={sentinelRef}
              className="flex items-center justify-center py-4 text-xs text-secondary-400"
            >
              {isLoadingMore ? t("Loading more...") : ""}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function NotificationIcon({ notification }) {
  const type = notification?.type;

  switch (type) {
    case "offer_approved":
      return <CheckIcon />;
    case "offer_refused":
      return <XIcon />;
    case "offer_created":
      return <SparkleIcon />;
    case "offer_draft":
      return <ClockIcon />;
    case "offer_signaled":
      return <AlertIcon />;
    case "participation_request_received":
      return <UserPlusIcon />;
    case "participation_request_accepted":
      return <CheckIcon />;
    case "participation_request_rejected":
      return <XIcon />;
    case "participation_request_removed":
      return <XIcon />;
    case "participation_request_canceled":
      return <UndoIcon />;
    case "participation_request_exits":
      return <UserMinusIcon />;
    case "participation_offerremoved":
      return <TrashIcon />;
    case "participation_leavereview":
      return <StarIcon />;
    case "account_deleted":
      return <UserMinusIcon />;
    case "App\\Notifications\\Offer\\OfferCreatedNotification":
      return <SparkleIcon />;
    case "App\\Notifications\\Offer\\OfferDraftNotification":
      return <ClockIcon />;
    case "App\\Notifications\\Offer\\OfferRefusedNotification":
      return <XIcon />;
    case "App\\Notifications\\Offer\\OfferRemovedNotification":
      return <TrashIcon />;
    case "App\\Notifications\\Offer\\OfferSignaledNotification":
      return <AlertIcon />;
    case "App\\Notifications\\Offer\\ParticipationLeaveReviewTripNotification":
      return <StarIcon />;
    case "App\\Notifications\\User\\AccountDeletedNotification":
      return <UserMinusIcon />;
    case "App\\Notifications\\User\\ParticipationRequestRemovedNotification":
      return <XIcon />;
    case "App\\Notifications\\User\\ParticipationRequestCanceledNotification":
      return <UndoIcon />;
    case "App\\Notifications\\User\\ParticipationRequestExitsNotification":
      return <UserMinusIcon />;
    default:
      return <InfoIcon />;
  }
}

function IconContainer({ children }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FDF1F9] text-primary-700">
      {children}
    </span>
  );
}

function CheckIcon() {
  return (
    <IconContainer>
      <CheckCircleIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function XIcon() {
  return (
    <IconContainer>
      <XCircleIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function SparkleIcon() {
  return (
    <IconContainer>
      <SparklesIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function ClockIcon() {
  return (
    <IconContainer>
      <HeroClockIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function AlertIcon() {
  return (
    <IconContainer>
      <ExclamationTriangleIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function UserPlusIcon() {
  return (
    <IconContainer>
      <HeroUserPlusIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function UserMinusIcon() {
  return (
    <IconContainer>
      <HeroUserMinusIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function UndoIcon() {
  return (
    <IconContainer>
      <ArrowUturnLeftIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function TrashIcon() {
  return (
    <IconContainer>
      <HeroTrashIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function StarIcon() {
  return (
    <IconContainer>
      <HeroStarIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}

function InfoIcon() {
  return (
    <IconContainer>
      <HeroInformationCircleIcon size={18} className="text-primary-700" />
    </IconContainer>
  );
}
