"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";

import OfferMainDetails from "../../../../../components/offers/offer-main-details";
import UserAvatar from "../../../../../components/user/user-avatar";
import UsersAvatarsList from "../../../../../components/user/users-avatars-list";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import ConfirmModal from "../../../../../components/ui/confirm-modal";
import QrCodeCanvas, {
  drawQrToCanvas
} from "../../../../../components/ui/qr-code";
import { CheckIcon, XMarkIcon } from "../../../../../components/ui/heroicons";
import { useI18n } from "../../../../../components/i18n-provider";
import { apiRequest } from "../../../../lib/api-client";

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

export default function MyOfferDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t, locale } = useI18n();
  const [offer, setOffer] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const [isRequestsOpen, setRequestsOpen] = useState(false);
  const [requests, setRequests] = useState([]);
  const [requestsStatus, setRequestsStatus] = useState("idle");
  const [requestsError, setRequestsError] = useState("");
  const [requestActionState, setRequestActionState] = useState({
    type: "",
    id: null
  });
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [scanToken, setScanToken] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [isScanResultOpen, setScanResultOpen] = useState(false);
  const [checkedInEntries, setCheckedInEntries] = useState([]);
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [checkedInError, setCheckedInError] = useState("");
  const [ownerTab, setOwnerTab] = useState("overview");
  const [isScannerOpen, setScannerOpen] = useState(false);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const scanBusyRef = useRef(false);
  const scanResultOpenRef = useRef(false);
  const lastScanRef = useRef({ token: "", time: 0 });
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !offer?.id) return "";
    return `${window.location.origin}/app/auth/offers/${offer.id}`;
  }, [offer?.id]);
  const dateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-US";
  const headerDateLocale =
    locale === "fr" ? "fr-FR" : locale === "ar" ? "ar-MA" : "en-GB";
  const isPublishedOffer = Boolean(
    offer &&
      !offer.is_draft &&
      offer.status !== "draft" &&
      offer.status !== "pending"
  );
  const isActiveOffer = Boolean(
    offer &&
      offer.status === "active" &&
      !offer.is_draft &&
      !offer.is_closed
  );
  const ownerTabs = useMemo(
    () => {
      if (!isPublishedOffer) {
        return [{ id: "overview", label: t("Overview") }];
      }
      const tabs = [
        { id: "overview", label: t("Overview") },
        { id: "participants", label: t("Participants") }
      ];
      if (isActiveOffer) {
        tabs.push({ id: "checkin", label: t("ticket_scan_title") });
      }
      return tabs;
    },
    [t, isActiveOffer, isPublishedOffer]
  );
  const tabParam = searchParams?.get("tab") || "";
  const lastTabParamRef = useRef(tabParam);

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

  const handleTabChange = (nextTab) => {
    setOwnerTab(nextTab);
    if (!pathname) return;
    const nextParams = new URLSearchParams(searchParams?.toString() || "");
    if (nextTab === "overview") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", nextTab);
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const checkedInUserIds = useMemo(() => {
    return new Set(
      checkedInEntries
        .map((entry) => entry?.user?.id)
        .filter((id) => Boolean(id))
    );
  }, [checkedInEntries]);

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

  const loadRequests = async () => {
    if (!params.id) return;
    setRequestsStatus("loading");
    setRequestsError("");
    try {
      const payload = await apiRequest(`offer-requests?offer_id=${params.id}`);
      setRequests(payload?.data || []);
      setRequestsStatus("ready");
    } catch (error) {
      setRequestsError(error?.message || t("general.error_has_occurred"));
      setRequestsStatus("error");
    }
  };

  const loadCheckins = async () => {
    if (!offer?.id) return;
    setCheckedInError("");
    try {
      const payload = await apiRequest(`offers/${offer.id}/checkins?limit=15`);
      const nextEntries = payload?.data || [];
      const nextCount = Number(payload?.meta?.count);
      setCheckedInEntries(nextEntries);
      setCheckedInCount(
        Number.isFinite(nextCount) ? nextCount : nextEntries.length
      );
    } catch (error) {
      setCheckedInError(error?.message || t("ticket_checkins_failed"));
    }
  };

  useEffect(() => {
    loadOffer();
  }, [params.id]);

  useEffect(() => {
    if (!isRequestsOpen) return;
    loadRequests();
  }, [isRequestsOpen, params.id, t]);

  useEffect(() => {
    if (!offer?.id) return;
    if (!isActiveOffer) return;
    loadCheckins();
  }, [offer?.id, t, isActiveOffer]);

  useEffect(() => {
    if (tabParam === lastTabParamRef.current) return;
    lastTabParamRef.current = tabParam;
    if (!tabParam && ownerTab !== "overview") {
      setOwnerTab("overview");
      return;
    }
    if (tabParam === "overview" && ownerTab !== "overview") {
      setOwnerTab("overview");
      return;
    }
    if (tabParam === "participants" && isPublishedOffer && ownerTab !== "participants") {
      setOwnerTab("participants");
      return;
    }
    if (tabParam === "checkin" && isActiveOffer && ownerTab !== "checkin") {
      setOwnerTab("checkin");
    }
  }, [tabParam, isPublishedOffer, isActiveOffer, ownerTab]);

  useEffect(() => {
    if (!isPublishedOffer && ownerTab !== "overview") {
      setOwnerTab("overview");
      return;
    }
    if (!isActiveOffer && ownerTab === "checkin") {
      setOwnerTab("overview");
    }
  }, [isActiveOffer, isPublishedOffer, ownerTab]);

  useEffect(() => {
    setScanResult(null);
    setScanError("");
    setScanResultOpen(false);
    setCheckedInEntries([]);
    setCheckedInCount(0);
    setCheckedInError("");
  }, [params.id]);

  useEffect(() => {
    scanBusyRef.current = scanBusy;
  }, [scanBusy]);

  useEffect(() => {
    scanResultOpenRef.current = isScanResultOpen;
  }, [isScanResultOpen]);


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
            if (scanBusyRef.current || scanResultOpenRef.current) {
              scanFrameRef.current = requestAnimationFrame(scanFrame);
              return;
            }
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
                const now = Date.now();
                const lastScan = lastScanRef.current;
                if (
                  lastScan.token !== tokenValue ||
                  now - lastScan.time > 2000
                ) {
                  lastScanRef.current = { token: tokenValue, time: now };
                  setScanToken(tokenValue);
                  handleScanTicket(tokenValue);
                }
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
  const pendingCount = offer?.pending_participants_count || 0;
  const dynamicAnswers = offer?.resolved_dynamic_answers || {};
  const dynamicEntries = Object.entries(dynamicAnswers);
  const isDraft = Boolean(offer?.is_draft) || offer?.status === "draft";
  const canPublish = isDraft && actionState === "idle";
  const participantsList = offer?.participants || [];
  const ownerParticipant = participantsList.find(
    (user) => user.id === offer?.owner?.id
  );
  const participantsCount =
    (offer?.participants_count ?? participantsList.length ?? 0) +
    (ownerParticipant ? 0 : 1);
  const maxParticipants = offer?.max_participants ?? null;
  const displayMax =
    maxParticipants && participantsCount > maxParticipants
      ? participantsCount
      : maxParticipants;
  const participantsText = displayMax
    ? `${participantsCount}/${displayMax}`
    : String(participantsCount);
  const otherParticipants = participantsList.filter(
    (user) => user.id !== offer?.owner?.id
  );
  const ownerId = offer?.owner?.id;
  const ownerPresentOffset =
    ownerId && !checkedInUserIds.has(ownerId) ? 1 : 0;
  const presentCount = checkedInCount + ownerPresentOffset;
  const ownerName = `${offer?.owner?.first_name || ""} ${
    offer?.owner?.last_name || ""
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
  const conversationId = offer?.conversation_id;
  const canOpenChat = Boolean(conversationId);

  const getAge = (user) => {
    if (typeof user?.age === "number") return user.age;
    if (!user?.date_of_birth) return null;
    const date = new Date(user.date_of_birth);
    if (Number.isNaN(date.getTime())) return null;
    const diff = Date.now() - date.getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const formatRequestDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(dateLocale, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  };
  const formatScanDateTime = (value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(dateLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const resolveScanValidity = (payload, errorMessage) => {
    if (errorMessage) return false;
    if (!payload) return null;
    const explicit =
      payload.valid ?? payload.is_valid ?? payload.ticket?.is_valid;
    if (explicit === true) return true;
    if (explicit === false) return false;
    const statusValue = String(
      payload.ticket?.status || payload.status || ""
    ).toLowerCase();
    const invalidTokens = [
      "invalid",
      "expired",
      "rejected",
      "refused",
      "canceled",
      "cancelled",
      "used",
      "already"
    ];
    const validTokens = ["valid", "checked", "accepted", "success", "ok"];
    if (invalidTokens.some((token) => statusValue.includes(token))) {
      return false;
    }
    if (validTokens.some((token) => statusValue.includes(token))) {
      return true;
    }
    return true;
  };

  const playScanTone = (isValid) => {
    if (typeof window === "undefined") return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = isValid ? 880 : 220;
      gainNode.gain.value = 0.12;
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.2);
      oscillator.onended = () => context.close();
    } catch {
      // Ignore audio errors (autoplay policies, etc.).
    }
  };

  const handleAcceptRequest = async (requestId) => {
    if (requestActionState.type) return;
    setRequestActionState({ type: "accept", id: requestId });
    setRequestsError("");
    try {
      await apiRequest(`offer-requests/${requestId}/accept`, {
        method: "POST"
      });
      await Promise.all([loadOffer(), loadRequests()]);
    } catch (error) {
      setRequestsError(error?.message || t("general.error_has_occurred"));
    } finally {
      setRequestActionState({ type: "", id: null });
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (requestActionState.type) return;
    setRequestActionState({ type: "reject", id: requestId });
    setRequestsError("");
    try {
      await apiRequest(`offer-requests/${requestId}`, { method: "DELETE" });
      await Promise.all([loadOffer(), loadRequests()]);
    } catch (error) {
      setRequestsError(error?.message || t("general.error_has_occurred"));
    } finally {
      setRequestActionState({ type: "", id: null });
    }
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

  const handleDownloadShareCard = async () => {
    if (!shareUrl) return;
    setShareBusy(true);
    setShareFeedback("");
    try {
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

  const normalizeTicketToken = (value = "") =>
    String(value ?? "").replace(/\s+/g, "");

  const handleScanTicket = async (tokenOverride) => {
    const override =
      typeof tokenOverride === "string" ? tokenOverride : "";
    const value = normalizeTicketToken(override || scanToken).trim();
    if (!value || scanBusy || isScanResultOpen) return;
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
      setScanResultOpen(true);
      playScanTone(resolveScanValidity(payload));
      if (payload?.ticket?.id && payload?.user) {
        loadCheckins();
      }
    } catch (error) {
      setScanError(error?.message || t("ticket_scan_failed"));
      setScanResultOpen(true);
      playScanTone(false);
    } finally {
      setScanBusy(false);
    }
  };

  const handleCloseScanResult = () => {
    setScanResultOpen(false);
    setScanResult(null);
    setScanError("");
  };

  const scanValidity = resolveScanValidity(scanResult, scanError);
  const scanToneClass =
    scanValidity === false
      ? "border-danger-500/30 bg-danger-100"
      : "border-success-500/30 bg-success-100";
  const scanTextClass =
    scanValidity === false ? "text-danger-700" : "text-success-700";

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
            <div className="text-sm text-secondary-400">
              <p>{offer.city?.name || "-"}</p>
              <p>{formatHeaderDate(offer.start_date)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6">
          {isPublishedOffer ? (
            <div className="rounded-3xl border border-[#EADAF1] bg-white p-2">
              <div className="hide-scrollbar flex flex-nowrap gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                {ownerTabs.map((tab) => {
                  const isActive = ownerTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => handleTabChange(tab.id)}
                      className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] transition sm:flex-1 sm:px-4 sm:text-xs sm:tracking-[0.2em] ${
                        isActive
                          ? "bg-secondary-500 text-white shadow-sm"
                          : "text-secondary-500 hover:text-secondary-600"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {ownerTab === "overview" ? (
            <>
              <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
                <OfferMainDetails offer={offer} />
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
                        className="rounded-full border border-secondary-500/40 bg-white px-3 py-2 text-xs font-semibold text-secondary-500"
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
            </>
          ) : null}

          {ownerTab === "participants" && isPublishedOffer ? (
            <>
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
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-secondary-500/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-500">
                      {t("Participants")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-secondary-700">
                      {participantsCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#D59500]/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B88400]">
                      {t("Pending")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#B88400]">
                      {pendingCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-success-500/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success-700">
                      {t("ticket_checked_in_count")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-success-700">
                      {presentCount}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setParticipantsOpen(true)}
                    className="inline-flex items-center rounded-full bg-secondary-500 px-4 py-2 text-xs font-semibold text-white"
                  >
                    {t("Participants information")}
                  </button>
                  {pendingCount ? (
                    <button
                      type="button"
                      onClick={() => setRequestsOpen(true)}
                      className="inline-flex items-center rounded-full bg-[#D59500] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#C88600]"
                    >
                      {t("Participation requests")}: {pendingCount}
                    </button>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-secondary-500/40 bg-white px-4 py-2 text-xs font-semibold text-secondary-500">
                      {t("No requests")}
                    </span>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary-900">
                    {t("Participants")}
                  </h3>
                  <span className="text-xs text-secondary-400">
                    {otherParticipants.length}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-primary-900">
                                {user.first_name} {user.last_name}
                              </p>
                              {checkedInUserIds.has(user.id) ? (
                                <span className="rounded-full bg-success-100 px-2 py-1 text-[10px] font-semibold text-success-700">
                                  {t("ticket_present_badge")}
                                </span>
                              ) : null}
                            </div>
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
            </>
          ) : null}

          {ownerTab === "checkin" && isPublishedOffer && isActiveOffer ? (
            <>
              <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-700">
                      {t("ticket_scan_title")}
                    </h2>
                    <p className="mt-2 text-sm text-secondary-500">
                      {t("ticket_scan_hint")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    label={t("ticket_scan_camera")}
                    className="px-4 py-2 text-xs"
                    onClick={() => setScannerOpen(true)}
                  />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-secondary-500/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-500">
                      {t("Participants")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-secondary-700">
                      {participantsCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-[#D59500]/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B88400]">
                      {t("Pending")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-[#B88400]">
                      {pendingCount}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-success-500/10 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-success-700">
                      {t("ticket_checked_in_count")}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-success-700">
                      {presentCount}
                    </p>
                  </div>
                </div>
                {scanError ? (
                  <p className="mt-3 text-xs text-danger-600">{scanError}</p>
                ) : null}
                {scanResult?.ticket && scanResult?.user ? (
                  <div className={`mt-4 rounded-2xl border p-3 ${scanToneClass}`}>
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
                          <span className={`font-semibold ${scanTextClass}`}>
                            {scanResult.ticket.status}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-secondary-500">
                      <span>
                        {t("ticket_scan_count")}:{" "}
                        <span className={`font-semibold ${scanTextClass}`}>
                          {scanResult.ticket.scan_count}
                        </span>
                      </span>
                      {scanResult.ticket.checked_in_at ? (
                        <span>
                          {t("ticket_scan_time")}:{" "}
                          <span className={`font-semibold ${scanTextClass}`}>
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

              <div className="rounded-3xl border border-[#EADAF1] bg-white p-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary-900">
                    {t("ticket_checkins_title")}
                  </h3>
                  <span className="text-xs text-secondary-400">
                    {presentCount}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {checkedInError ? (
                    <p className="text-sm text-danger-600">
                      {checkedInError}
                    </p>
                  ) : checkedInEntries.length === 0 ? (
                    <p className="text-sm text-secondary-400">
                      {t("ticket_checkins_empty")}
                    </p>
                  ) : (
                    checkedInEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#EADAF1] bg-white p-3"
                      >
                        <div className="flex items-center gap-3">
                          <UserAvatar user={entry.user} size={40} withBorder />
                          <div>
                            <p className="text-sm font-semibold text-primary-900">
                              {entry.user?.name || ""}
                            </p>
                            <p className="text-xs text-secondary-500">
                              {entry.checked_in_at
                                ? new Date(entry.checked_in_at).toLocaleString()
                                : ""}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-primary-700">
                          {t("ticket_checked_in_count")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : null}
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
            <div className="mt-5 space-y-4">
              <Button
                label={t("share")}
                size="lg"
                className="w-full"
                onClick={() => setShareOpen(true)}
              />
              {canOpenChat ? (
                <Button
                  variant="default"
                  label={t("Group chat")}
                  size="lg"
                  className="w-full"
                  onClick={() =>
                    router.push(`/app/auth/conversations/${conversationId}`)
                  }
                />
              ) : null}
              <Link href={`/app/auth/my-offers/${offer.id}/edit`} className="block">
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
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-primary-900">
                          {user.first_name} {user.last_name}
                        </p>
                        {checkedInUserIds.has(user.id) ? (
                          <span className="rounded-full bg-success-100 px-2 py-1 text-[10px] font-semibold text-success-700">
                            {t("ticket_present_badge")}
                          </span>
                        ) : null}
                      </div>
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

        <div className="mt-4 flex flex-col gap-3">
          <Link
            href={`/app/auth/my-offers/${offer.id}/participants`}
            className="w-full"
          >
            <Button label={t("Participants information")} className="w-full" />
          </Link>
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setParticipantsOpen(false)}
          />
        </div>
      </Modal>

      <Modal
        open={isRequestsOpen}
        title={t("Participation requests")}
        onClose={() => setRequestsOpen(false)}
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-2">
          {requestsStatus === "loading" ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div
                  key={`request-skeleton-${index}`}
                  className="h-20 animate-pulse rounded-2xl bg-neutral-100"
                />
              ))}
            </div>
          ) : null}

          {requestsError ? (
            <p className="text-sm text-danger-600">{requestsError}</p>
          ) : null}

          {requestsStatus !== "loading" ? (
            requests.length === 0 ? (
              <p className="text-sm text-secondary-400">
                {t("No requests yet")}
              </p>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const user = request.user;
                  const isBusy =
                    requestActionState.id === request.id &&
                    ["accept", "reject"].includes(requestActionState.type);
                  const isAccepting =
                    isBusy && requestActionState.type === "accept";
                  const isRejecting =
                    isBusy && requestActionState.type === "reject";
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
                            onClick={() => handleAcceptRequest(request.id)}
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
                            onClick={() => handleRejectRequest(request.id)}
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
                        {formatRequestDate(request.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Link
            href={`/app/auth/my-offers/${offer.id}/participants`}
            className="w-full"
          >
            <Button label={t("Details")} className="w-full" />
          </Link>
          <Button
            variant="outline"
            label={t("Close")}
            className="w-full"
            onClick={() => setRequestsOpen(false)}
          />
        </div>
      </Modal>

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
              {offer.owner?.first_name} {offer.owner?.last_name}
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
      </Modal>

      <Modal
        open={isScannerOpen}
        title={t("ticket_scan_title")}
        onClose={() => setScannerOpen(false)}
      >
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-[#EADAF1] bg-black">
            <video
              ref={scanVideoRef}
              className="h-64 w-full object-cover"
              playsInline
              muted
            />
            {isScanResultOpen ? (
              <div className="absolute inset-0 flex items-start justify-center bg-black/40 p-3">
                <div className={`w-full max-w-sm rounded-2xl border p-4 shadow-lg ${scanToneClass}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-secondary-500">
                    {t("ticket_scan_result")}
                  </p>
                  {scanResult?.ticket && scanResult?.user ? (
                    <>
                      <div className="mt-3 flex items-center gap-3">
                        <UserAvatar user={scanResult.user} size={48} withBorder />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-primary-900">
                            {scanResult.user.name ||
                              `${scanResult.user.first_name || ""} ${scanResult.user.last_name || ""}`.trim()}
                          </p>
                          <p className="text-xs text-secondary-500">
                            {t("ticket_scan_status")}{" "}
                            <span className={`font-semibold ${scanTextClass}`}>
                              {scanResult.ticket.status}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-secondary-500">
                        <p>
                          {t("ticket_scan_count")}:{" "}
                          <span className={`font-semibold ${scanTextClass}`}>
                            {scanResult.ticket.scan_count}
                          </span>
                        </p>
                        <p>
                          {t("ticket_scan_time")}:{" "}
                          <span className={`font-semibold ${scanTextClass}`}>
                            {formatScanDateTime(
                              scanResult.ticket.first_checked_in_at ||
                                scanResult.ticket.checked_in_at
                            )}
                          </span>
                        </p>
                      </div>
                    </>
                  ) : (
                    <p className={`mt-3 text-sm font-semibold ${scanTextClass}`}>
                      {scanError || t("ticket_scan_failed")}
                    </p>
                  )}
                  <Button
                    variant="outline"
                    label={t("Close")}
                    className="mt-4 w-full"
                    onClick={handleCloseScanResult}
                  />
                </div>
              </div>
            ) : null}
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
