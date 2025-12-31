"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";

import OfferMainDetails from "../../../../../components/offers/offer-main-details";
import { getLocalizedText } from "../../../../../components/offers/offer-text";
import UserAvatar from "../../../../../components/user/user-avatar";
import UsersAvatarsList from "../../../../../components/user/users-avatars-list";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";
import { getUser } from "../../../../lib/session";

const QrCodeCanvas = dynamic(
  () => import("../../../../../components/ui/qr-code"),
  { ssr: false }
);

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

const RatingStarIcon = ({ filled }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill={filled ? "#B12587" : "none"}
    stroke="#B12587"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3.5 14.8 9l5.9.9-4.3 4.2 1 5.8L12 17.8 6.6 19.9l1-5.8-4.3-4.2L9.2 9 12 3.5Z" />
  </svg>
);

const drawRoundedRect = (ctx, x, y, width, height, radius) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing image source"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });

const CARD_BASE = "rounded-3xl border border-[#EADAF1] bg-white p-5";

const OfferDetailsSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="overflow-hidden rounded-3xl border border-[#EADAF1] bg-white">
      <div className="h-56 bg-neutral-100 sm:h-64" />
      <div className="space-y-4 px-5 pb-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 rounded-full bg-neutral-200" />
          <div className="h-5 w-20 rounded-full bg-neutral-200" />
        </div>
        <div className="space-y-3">
          <div className="h-7 w-3/4 rounded bg-neutral-200" />
          <div className="h-4 w-1/3 rounded bg-neutral-200" />
          <div className="h-4 w-1/4 rounded bg-neutral-200" />
        </div>
      </div>
    </div>

    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6">
        <div className={CARD_BASE}>
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-4 flex items-center gap-3">
            <div className="h-14 w-14 rounded-full bg-neutral-200" />
            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-neutral-200" />
              <div className="h-3 w-24 rounded bg-neutral-200" />
            </div>
          </div>
          <div className="mt-4 h-16 rounded-2xl bg-neutral-100" />
        </div>

        <div className={CARD_BASE}>
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-4 h-24 rounded-2xl bg-neutral-100" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="h-16 rounded-2xl bg-neutral-100" />
            <div className="h-16 rounded-2xl bg-neutral-100" />
          </div>
        </div>

        <div className={CARD_BASE}>
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-3 h-20 rounded-2xl bg-neutral-100" />
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <div className={CARD_BASE}>
          <div className="h-4 w-24 rounded bg-neutral-200" />
          <div className="mt-4 h-10 rounded-full bg-neutral-100" />
          <div className="mt-3 h-10 rounded-full bg-neutral-100" />
        </div>
      </aside>
    </div>
  </div>
);

export default function OfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { t, locale } = useI18n();
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
  const [isShareOpen, setShareOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [ticketStatus, setTicketStatus] = useState("idle");
  const [ticketError, setTicketError] = useState("");
  const [ticketFeedback, setTicketFeedback] = useState("");
  const [scanToken, setScanToken] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [isScannerOpen, setScannerOpen] = useState(false);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const [offerQuestions, setOfferQuestions] = useState([]);
  const currentUser = getUser();
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !offer?.id) return "";
    return `${window.location.origin}/app/auth/offers/${offer.id}`;
  }, [offer?.id]);

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

  useEffect(() => {
    apiRequest("parameters", { cacheTime: 300000 })
      .then((payload) => {
        const dynamicGroups = payload?.dynamic_questions || {};
        setOfferQuestions(
          dynamicGroups.offer || dynamicGroups["App\\\\Models\\\\Offer"] || []
        );
      })
      .catch(() => {
        setOfferQuestions([]);
      });
  }, []);

  useEffect(() => {
    if (!isScannerOpen) {
      if (scanFrameRef.current) {
        cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
      }
      if (scanStreamRef.current) {
        scanStreamRef.current.getTracks().forEach((track) => track.stop());
        scanStreamRef.current = null;
      }
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = null;
      }
      return;
    }

    let canceled = false;
    const startScanner = async () => {
      setScanError("");
      setScanResult(null);
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error("Camera not supported");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }
        });
        if (canceled) return;
        scanStreamRef.current = stream;
        if (scanVideoRef.current) {
          scanVideoRef.current.srcObject = stream;
          await scanVideoRef.current.play();
        }

        const { default: jsQR } = await import("jsqr");
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        const scanFrame = () => {
          if (!scanVideoRef.current || !context) return;
          const video = scanVideoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(
              0,
              0,
              canvas.width,
              canvas.height
            );
            const code = jsQR(
              imageData.data,
              imageData.width,
              imageData.height
            );
            if (code?.data) {
              const tokenValue = code.data.trim();
              if (tokenValue) {
                setScanToken(tokenValue);
                handleScanTicket(tokenValue);
                setScannerOpen(false);
                return;
              }
            }
          }
          scanFrameRef.current = requestAnimationFrame(scanFrame);
        };

        scanFrameRef.current = requestAnimationFrame(scanFrame);
      } catch {
        setScanError(t("ticket_scan_no_camera"));
      }
    };

    startScanner();

    return () => {
      canceled = true;
      if (scanFrameRef.current) {
        cancelAnimationFrame(scanFrameRef.current);
        scanFrameRef.current = null;
      }
      if (scanStreamRef.current) {
        scanStreamRef.current.getTracks().forEach((track) => track.stop());
        scanStreamRef.current = null;
      }
      if (scanVideoRef.current) {
        scanVideoRef.current.srcObject = null;
      }
    };
  }, [isScannerOpen, t]);

  useEffect(() => {
    let active = true;
    const isOwnerView = offer?.owner?.id === currentUser?.id;
    const isParticipantView = Boolean(offer?.auth_user_is_participant);
    if (!offer?.id || !isParticipantView || isOwnerView || !isTicketingEnabled) {
      setTicket(null);
      setTicketStatus("idle");
      setTicketError("");
      setTicketFeedback("");
      return;
    }

    const fetchTicket = async () => {
      setTicketStatus("loading");
      setTicketError("");
      setTicketFeedback("");
      try {
        const payload = await apiRequest(`offers/${offer.id}/ticket`);
        if (!active) return;
        setTicket(payload?.data || null);
        if (payload?.data?.status === "revoked") {
          setTicketError(t("ticket_revoked"));
        }
        setTicketStatus("ready");
      } catch (error) {
        if (!active) return;
        setTicket(null);
        setTicketStatus("error");
        const errorMessage = String(error?.message || "");
        if (error?.data?.status === "revoked" || error?.status === 410) {
          setTicketError(t("ticket_revoked"));
        } else if (
          error?.data?.status === "not_found" ||
          error?.status === 404 ||
          errorMessage.includes("No query results for model")
        ) {
          setTicketError(t("ticket_not_found"));
        } else {
          setTicketError(error?.message || t("ticket_unavailable"));
        }
      }
    };

    fetchTicket();

    return () => {
      active = false;
    };
  }, [
    offer?.id,
    offer?.auth_user_is_participant,
    offer?.owner?.id,
    offer?.ticketing_enabled,
    currentUser?.id,
    t
  ]);

  const dynamicAnswers =
    offer?.resolved_dynamic_answers || offer?.dynamic_answers || {};
  const dynamicEntries = Object.entries(dynamicAnswers);
  const dynamicOptionLabels = useMemo(() => {
    const map = new Map();
    offerQuestions.forEach((question) => {
      const options = question?.formatted_settings?.options || [];
      map.set(
        question.name,
        new Map(options.map((option) => [String(option.value), option.label]))
      );
    });
    return map;
  }, [offerQuestions]);
  const preferenceChips = useMemo(() => {
    if (!dynamicEntries.length) return [];
    const chips = [];
    dynamicEntries.forEach(([key, rawValue]) => {
      let values = Array.isArray(rawValue) ? rawValue : [rawValue];
      if (typeof rawValue === "string") {
        const trimmed = rawValue.trim();
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
              values = parsed;
            }
          } catch {
            // keep raw string
          }
        }
      }
      values.forEach((value, index) => {
        if (value === null || value === undefined || value === "") return;
        const labelMap = dynamicOptionLabels.get(key);
        const label =
          labelMap?.get(String(value)) ||
          getLocalizedText(value, locale) ||
          String(value);
        chips.push({ key: `${key}-${index}-${String(value)}`, label });
      });
    });
    return chips;
  }, [dynamicEntries, dynamicOptionLabels, locale]);

  if (status === "loading") {
    return <OfferDetailsSkeleton />;
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
  const ownerAvatarUrl =
    offer?.owner?.avatar_image_url ||
    offer?.owner?.avatar_url ||
    offer?.owner?.avatar ||
    offer?.owner?.image ||
    offer?.owner?.image_url ||
    offer?.owner?.photo_url ||
    offer?.owner?.photo ||
    offer?.owner?.picture ||
    offer?.owner?.profile_image_url ||
    offer?.owner?.profile_image ||
    "";
  const displayAvatarUrl = ownerAvatarUrl
    ? `/api/proxy-image?url=${encodeURIComponent(ownerAvatarUrl)}`
    : "/assets/images/splash-icon.png";
  const participantCount = offer?.participants_count ?? 0;
  const maxParticipants = offer?.max_participants ?? null;
  const maxParticipantsLabel = maxParticipants ?? "-";
  const isOwner = currentUser && offer?.owner?.id === currentUser.id;
  const isParticipant = Boolean(offer?.auth_user_is_participant);
  const isTicketingEnabled = offer?.ticketing_enabled !== false;
  const isPending = Boolean(offer?.auth_user_is_pending_participant);
  const isClosed = Boolean(offer?.is_closed) || offer?.status === "closed";
  const isActiveOffer = Boolean(
    offer &&
      offer.status === "active" &&
      !offer.is_draft &&
      !offer.is_closed
  );
  const headerDateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
  const scanDateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
  const ownerRating = Number(offer?.owner?.average_rating ?? offer?.owner?.rating ?? null);
  const showOwnerRating = Number.isFinite(ownerRating) && ownerRating > 0;
  const ratingEntries = Array.isArray(offer?.ratings) ? offer.ratings : [];
  const visibleRatings = ratingEntries.filter((entry) => {
    const value = Number(entry?.rating ?? 0);
    return Number.isFinite(value) && value > 0;
  });
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
  const participantsList = offer?.participants || [];
  const ownerParticipant = participantsList.find(
    (user) => user.id === offer?.owner?.id
  );
  const otherParticipants = participantsList.filter(
    (user) => user.id !== offer?.owner?.id
  );
  const conversationId = offer?.conversation_id;
  const canOpenChat = Boolean(conversationId) && (isOwner || isParticipant);
  const canShowTicket = isParticipant && !isOwner && isTicketingEnabled;
  const isTicketRevoked = ticket?.status === "revoked";
  const ticketToken = isTicketRevoked ? "" : ticket?.token || "";
  const ticketStatusLabel = ticket?.checked_in_at
    ? t("ticket_checked_at", {
        time: formatCheckedAt(ticket.checked_in_at)
      })
    : ticket?.status || t("Participating");

  const getAge = (user) => {
    if (typeof user?.age === "number") return user.age;
    if (!user?.date_of_birth) return null;
    const date = new Date(user.date_of_birth);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };
  const cardBase = CARD_BASE;
  const sectionTitle =
    "text-sm font-semibold uppercase tracking-[0.2em] text-primary-700";
  const formatShortToken = (date, formatLocale, options) => {
    const value = new Intl.DateTimeFormat(formatLocale, options).format(date);
    const normalized = value.replace(/\./g, "").trim().slice(0, 3);
    if (!normalized) return value;
    const capitalized =
      normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
    return `${capitalized}.`;
  };
  const formatHeaderDate = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const weekday = formatShortToken(date, headerDateLocale, { weekday: "short" });
    const dayNumber = new Intl.DateTimeFormat(headerDateLocale, {
      day: "numeric"
    }).format(date);
    const month = formatShortToken(date, headerDateLocale, { month: "short" });
    const year = new Intl.DateTimeFormat(headerDateLocale, {
      year: "numeric"
    }).format(date);
    return `${weekday} ${dayNumber} ${month} ${year}`;
  };
  function formatCheckedAt(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(scanDateLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  }
  const userStatusLabel = isOwner
    ? t("Organizer")
    : isParticipant
      ? t("request_accepted")
      : isPending
        ? t("Pending")
        : isClosed
          ? t("closed")
          : "";
  const stats = [
    { label: t("Favorites"), value: favoriteCount || 0 },
    { label: t("offer_status_label"), value: statusLabel }
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

  const handleDownloadShareCard = async () => {
    if (!shareUrl) return;
    setShareBusy(true);
    setShareFeedback("");
    try {
      const { drawQrToCanvas } = await import(
        "../../../../../components/ui/qr-code"
      );
      const canvas = document.createElement("canvas");
      const width = 720;
      const height = 980;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#FDEAFB");
      gradient.addColorStop(1, "#B12587");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      const cardWidth = 560;
      const cardHeight = 760;
      const cardX = (width - cardWidth) / 2;
      const cardY = 120;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#FFFFFF";
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 36);
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, 36);
      ctx.clip();

      const avatarSize = 96;
      const avatarX = cardX + (cardWidth - avatarSize) / 2;
      const avatarY = cardY + 32;
      let avatarLoaded = false;
      const avatarSource = ownerAvatarUrl
        ? `/api/proxy-image?url=${encodeURIComponent(ownerAvatarUrl)}`
        : `${window.location.origin}/assets/images/splash-icon.png`;
      if (avatarSource) {
        try {
          const avatar = await loadImage(avatarSource);
          ctx.save();
          ctx.beginPath();
          ctx.arc(
            avatarX + avatarSize / 2,
            avatarY + avatarSize / 2,
            avatarSize / 2,
            0,
            Math.PI * 2
          );
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
          ctx.restore();
          avatarLoaded = true;
        } catch {
          // fallback to initials below
        }
      }

      if (!avatarLoaded) {
        ctx.fillStyle = "#F7F1FA";
        ctx.beginPath();
        ctx.arc(
          avatarX + avatarSize / 2,
          avatarY + avatarSize / 2,
          avatarSize / 2,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      ctx.fillStyle = "#1E1E1E";
      ctx.font = "600 26px Lato, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(
        ownerName || offer?.owner?.name || "-",
        cardX + cardWidth / 2,
        avatarY + avatarSize + 46
      );

      const qrSize = 360;
      const qrX = cardX + (cardWidth - qrSize) / 2;
      const qrY = cardY + 200;
      const clearRect = drawQrToCanvas(ctx, shareUrl, {
        x: qrX,
        y: qrY,
        size: qrSize,
        margin: 12,
        color: "#B12587",
        backgroundColor: "#ffffff",
        gradientColors: ["#662483", "#822485", "#B12587"],
        ecc: "H",
        clearCenterFraction: 0.28,
        clearCenterRadius: 12
      });

      if (clearRect) {
        try {
          const icon = await loadImage(
            `${window.location.origin}/assets/images/splash-icon.png`
          );
          const maxSize = Math.floor(clearRect.size * 0.7);
          const ratio = icon.width / icon.height || 1;
          const iconWidth = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
          const iconHeight = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize;
          const iconX = clearRect.x + (clearRect.size - iconWidth) / 2;
          const iconY = clearRect.y + (clearRect.size - iconHeight) / 2;
          ctx.drawImage(icon, iconX, iconY, iconWidth, iconHeight);
        } catch {
          // ignore icon load failures
        }
      }

      ctx.restore();

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `groopin-offer-${offer.id}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setShareFeedback(t("share_card_ready"));
    } catch {
      setShareFeedback(t("share_card_failed"));
    } finally {
      setShareBusy(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setShareFeedback(t("link_copied"));
  };

  const handleNativeShare = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: offer?.title || "Groopin",
          text: t("share_offer_text", { title: offer?.title || "" }),
          url: shareUrl
        });
        return;
      } catch {
        // fall back to copy
      }
    }
    handleCopyLink();
  };

  const handleCloseShare = () => {
    setShareOpen(false);
    setShareFeedback("");
  };

  const handleCopyTicketToken = async () => {
    if (!ticketToken) return;
    try {
      await navigator.clipboard.writeText(ticketToken);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = ticketToken;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setTicketFeedback(t("ticket_copied"));
  };

  const normalizeTicketToken = (value = "") =>
    String(value ?? "").replace(/\s+/g, "");

  const handleScanTicket = async (tokenOverride) => {
    const override =
      typeof tokenOverride === "string" ? tokenOverride : "";
    const value = normalizeTicketToken(override || scanToken).trim();
    if (!value || scanBusy) return;
    if (override) {
      setScanToken(value);
    }
    setScanBusy(true);
    setScanError("");
    setScanResult(null);
    try {
      const payload = await apiRequest("tickets/scan", {
        method: "POST",
        body: { token: value, offer_id: offer?.id ?? params.id }
      });
      setScanResult(payload || null);
    } catch (error) {
      const hasValidationErrors = Boolean(error?.data?.errors);
      setScanError(
        hasValidationErrors
          ? t("ticket_scan_failed")
          : error?.message || t("ticket_scan_failed")
      );
    } finally {
      setScanBusy(false);
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
              <div className="text-sm text-secondary-400">
                <p>{offer.city?.name || "-"}</p>
                <p>{formatHeaderDate(offer.start_date)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isPending ? (
                  <span className="rounded-full bg-[#D59500] px-3 py-1 text-xs font-semibold text-white">
                    {t("Pending")}
                  </span>
                ) : null}
                {isParticipant && !isClosed ? (
                  <span className="rounded-full bg-secondary-500 px-3 py-1 text-xs font-semibold text-white">
                    {t("request_accepted")}
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
                  ? "bg-secondary-500 text-white"
                  : "bg-white/90 text-secondary-500"
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
                {showOwnerRating ? (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <RatingStarIcon
                          key={`owner-rating-${index}`}
                          filled={index + 1 <= Math.round(ownerRating)}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-secondary-500">
                      {ownerRating.toFixed(1)}/5
                    </span>
                  </div>
                ) : null}
              </div>
            </Link>
          </div>

          {!isOwner ? (
            <div className={cardBase}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitle}>{t("request_status_title")}</h2>
                {userStatusLabel ? (
                  <span className="rounded-full border border-secondary-500/40 bg-white px-3 py-1 text-xs font-semibold text-secondary-500">
                    {userStatusLabel}
                  </span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                {showRequestButton ? (
                  <Button
                    label={actionLabel}
                    size="sm"
                    className="w-full sm:w-auto"
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
                    className="w-full border-danger-600 text-danger-600 sm:w-auto"
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
                    className="w-full border-danger-600 text-danger-600 sm:w-auto"
                    disabled={isActionLoading}
                    onClick={() => {
                      setActionError("");
                      setCancelModalOpen(true);
                    }}
                  />
                ) : null}
                {canOpenChat ? (
                  <Button
                    variant="default"
                    label={t("Group chat")}
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      router.push(`/app/auth/conversations/${conversationId}`)
                    }
                  />
                ) : null}
                {isClosed && isParticipant ? (
                  <Button
                    variant="secondary"
                    label={t("Rate this experience")}
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() =>
                      router.push(`/app/auth/profile/offer-rating/${offer.id}`)
                    }
                  />
                ) : null}
              </div>
              {actionError ? (
                <p className="mt-3 text-xs text-danger-600">{actionError}</p>
              ) : null}
            </div>
          ) : null}

          {canShowTicket ? (
            <div className={cardBase}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className={sectionTitle}>{t("ticket_title")}</h2>
                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-xs font-semibold text-primary-900">
                  {ticketStatusLabel}
                </span>
              </div>
              {ticketStatus === "loading" ? (
                <div className="mt-4 h-36 animate-pulse rounded-2xl bg-neutral-100" />
              ) : ticketToken ? (
                <>
                  <p className="mt-3 text-sm text-secondary-500">
                    {t("ticket_qr_hint")}
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-4">
                    <div className="relative rounded-3xl border border-[#EADAF1] bg-white p-3">
                      <QrCodeCanvas
                        value={ticketToken}
                        size={200}
                        margin={10}
                        color="#B12587"
                        backgroundColor="#ffffff"
                        gradientColors={["#662483", "#822485", "#B12587"]}
                        ecc="H"
                        className="h-48 w-48"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-md">
                          <img
                            src="/assets/images/splash-icon.png"
                            alt="Groopin"
                            className="h-8 w-8 object-contain"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-secondary-500">
                  {ticketError || t("ticket_unavailable")}
                </p>
              )}
            </div>
          ) : null}

          <div className={cardBase}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className={sectionTitle}>{t("Details")}</h2>
              {isOwner ? (
                <span className="rounded-full bg-primary-600/10 px-3 py-1 text-xs font-semibold text-primary-900">
                  {userStatusLabel}
                </span>
              ) : null}
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
                      className="mt-3 inline-flex items-center rounded-full bg-secondary-500 px-3 py-2 text-[10px] font-semibold text-white"
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
              {preferenceChips.length ? (
                preferenceChips.map((chip) => (
                  <span
                    key={chip.key}
                    className="rounded-full border border-secondary-500/40 bg-white px-3 py-2 text-xs font-semibold text-secondary-500"
                  >
                    {chip.label}
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
          {isOwner && visibleRatings.length ? (
            <div className={cardBase}>
              <h3 className={sectionTitle}>{t("ratings")}</h3>
              <div className="mt-4 space-y-3">
                {visibleRatings.map((rating, index) => {
                  const ratingValue = Number(rating?.rating ?? 0);
                  const rater = rating?.rater;
                  const raterName =
                    rater?.name ||
                    [rater?.first_name, rater?.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    t("Participants");
                  return (
                    <div
                      key={rating?.id ?? `rating-${index}`}
                      className="rounded-2xl bg-[#F7F1FA] px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar user={rater} size={36} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-primary-900">
                              {raterName}
                            </p>
                            {rating?.comment ? (
                              <p className="mt-1 text-xs text-secondary-500">
                                {rating.comment}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary-700">
                          <RatingStarIcon filled />
                          <span>{ratingValue.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div className={cardBase}>
            <h3 className={sectionTitle}>Actions</h3>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                label={t("share")}
                size="sm"
                className="w-full md:w-auto"
                onClick={() => setShareOpen(true)}
              />
              <Button
                variant="outline"
                label={
                  offer.reported_by_auth_user
                    ? t("Already reported")
                    : t("Report offer")
                }
                size="sm"
                className="w-full md:w-auto"
                disabled={offer.reported_by_auth_user || isActionLoading}
                onClick={() => {
                  setReportError("");
                  setReportModalOpen(true);
                }}
              />
            </div>
            {isOwner && isActiveOffer && isTicketingEnabled ? (
              <div className="mt-5 rounded-2xl border border-[#EADAF1] bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-700">
                    {t("ticket_scan_title")}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    label={t("ticket_scan_camera")}
                    className="px-3 py-1 text-xs"
                    onClick={() => setScannerOpen(true)}
                  />
                </div>
                <p className="mt-2 text-xs text-secondary-500">
                  {t("ticket_scan_hint")}
                </p>
                {scanError ? (
                  <p className="mt-2 text-xs text-danger-600">{scanError}</p>
                ) : null}
                {scanResult?.ticket && scanResult?.user ? (
                  <div className="mt-3 rounded-2xl border border-[#EADAF1] bg-[#F7F1FA] p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-500">
                      {t("ticket_scan_result")}
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <UserAvatar user={scanResult.user} size={44} withBorder />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-primary-900">
                          {scanResult.user.name || ""}
                        </p>
                        <p className="text-xs text-secondary-500">
                          {t("ticket_scan_status")}{" "}
                          <span className="font-semibold text-primary-700">
                            {scanResult.ticket.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary-500">
                      <span>
                        {t("ticket_scan_count")}:{" "}
                        <span className="font-semibold text-primary-700">
                          {scanResult.ticket.scan_count}
                        </span>
                      </span>
                      {scanResult.ticket.checked_in_at ? (
                        <span>
                          {t("ticket_scan_time")}:{" "}
                          <span className="font-semibold text-primary-700">
                            {new Date(
                              scanResult.ticket.checked_in_at
                            ).toLocaleString()}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <Modal
        open={isShareOpen}
        title={t("share_offer")}
        onClose={handleCloseShare}
      >
        <p className="text-sm text-secondary-500">
          {t("share_offer_hint")}
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Button
            label={t("share")}
            className="w-full"
            onClick={handleNativeShare}
            disabled={!shareUrl}
          />
          <Button
            variant="outline"
            label={t("copy_link")}
            className="w-full"
            onClick={handleCopyLink}
            disabled={!shareUrl}
          />
        </div>
        {shareFeedback ? (
          <p className="mt-3 text-xs text-secondary-500">
            {shareFeedback}
          </p>
        ) : null}

        <div className="mt-4 rounded-3xl border border-[#EADAF1] bg-white px-5 py-6">
          <div className="flex flex-col items-center gap-2">
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt={ownerName || offer.owner?.name || "Organizer avatar"}
                className="h-14 w-14 rounded-full object-cover ring-2 ring-secondary-500/30"
              />
            ) : (
              <div className="h-14 w-14 rounded-full border border-[#EADAF1] bg-[#F7F1FA]" />
            )}
            <p className="text-xs uppercase tracking-[0.2em] text-secondary-400">
              {t("Organizer")}
            </p>
            <p className="text-sm font-semibold text-primary-900">
              {ownerName || offer.owner?.name || "-"}
            </p>
          </div>
          <p className="mt-4 text-center text-sm text-secondary-500">
            {t("share_qr_hint")}
          </p>
          {shareUrl ? (
            <>
              <div className="mt-4 flex items-center justify-center">
                <div className="relative rounded-3xl border border-[#EADAF1] bg-white p-2">
                  <QrCodeCanvas
                    value={shareUrl}
                    size={208}
                    margin={12}
                    color="#B12587"
                    backgroundColor="#ffffff"
                    gradientColors={["#662483", "#822485", "#B12587"]}
                    ecc="H"
                    clearCenterFraction={0.28}
                    clearCenterRadius={8}
                    className="h-52 w-52"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md">
                      <img
                        src="/assets/images/splash-icon.png"
                        alt="Groopin"
                        className="h-10 w-10 object-contain"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                label={t("download_qr")}
                className="mt-5 w-full"
                onClick={handleDownloadShareCard}
                disabled={shareBusy}
              />
            </>
          ) : null}
        </div>
        <Button
          variant="outline"
          label={t("Close")}
          className="mt-4 w-full"
          onClick={handleCloseShare}
        />
      </Modal>

      <Modal
        open={isScannerOpen}
        title={t("ticket_scan_title")}
        onClose={() => setScannerOpen(false)}
      >
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border border-[#EADAF1] bg-black">
            <video
              ref={scanVideoRef}
              className="h-64 w-full object-cover"
              playsInline
              muted
            />
          </div>
          <p className="text-xs text-secondary-500">
            {t("ticket_scan_camera_hint")}
          </p>
          {scanError ? (
            <p className="text-xs text-danger-600">{scanError}</p>
          ) : null}
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setScannerOpen(false)}
          />
        </div>
      </Modal>

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

      <Modal
        open={isCancelModalOpen}
        title={t("Cancel request")}
        onClose={() => setCancelModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("Are you sure you want to cancel your request?")}
        </p>
        {isCancelModalOpen && actionError ? (
          <p className="mt-3 text-xs text-danger-600">{actionError}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button
            variant="destructive"
            label={t("yes_cancel")}
            className="w-full"
            onClick={handleCancelRequest}
            loading={actionState === "cancel"}
          />
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setCancelModalOpen(false)}
            disabled={actionState === "cancel"}
          />
        </div>
      </Modal>

      <Modal
        open={isRemoveModalOpen}
        title={t("Remove participation")}
        onClose={() => setRemoveModalOpen(false)}
      >
        <p className="text-sm text-secondary-500">
          {t("Are you sure you want to remove your participation?")}
        </p>
        {isRemoveModalOpen && actionError ? (
          <p className="mt-3 text-xs text-danger-600">{actionError}</p>
        ) : null}
        <div className="mt-5 flex flex-col gap-3">
          <Button
            variant="destructive"
            label={t("Yes, remove")}
            className="w-full"
            onClick={handleRemoveParticipation}
            loading={actionState === "remove"}
          />
          <Button
            variant="outline"
            label={t("Cancel")}
            className="w-full"
            onClick={() => setRemoveModalOpen(false)}
            disabled={actionState === "remove"}
          />
        </div>
      </Modal>
    </div>
  );
}
