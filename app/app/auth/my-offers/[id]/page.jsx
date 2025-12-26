"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import OfferMainDetails from "../../../../../components/offers/offer-main-details";
import UserAvatar from "../../../../../components/user/user-avatar";
import UsersAvatarsList from "../../../../../components/user/users-avatars-list";
import Button from "../../../../../components/ui/button";
import Modal from "../../../../../components/ui/modal";
import ConfirmModal from "../../../../../components/ui/confirm-modal";
import QrCodeCanvas, {
  drawQrToCanvas
} from "../../../../../components/ui/qr-code";
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
  const { t } = useI18n();
  const [offer, setOffer] = useState(null);
  const [status, setStatus] = useState("loading");
  const [actionState, setActionState] = useState("idle");
  const [actionError, setActionError] = useState("");
  const [isParticipantsOpen, setParticipantsOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isShareOpen, setShareOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [shareBusy, setShareBusy] = useState(false);
  const [scanToken, setScanToken] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState("");
  const [isScannerOpen, setScannerOpen] = useState(false);
  const scanVideoRef = useRef(null);
  const scanStreamRef = useRef(null);
  const scanFrameRef = useRef(null);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined" || !offer?.id) return "";
    return `${window.location.origin}/app/auth/offers/${offer.id}`;
  }, [offer?.id]);

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

  const handleScanTicket = async (tokenOverride) => {
    const value = (tokenOverride || scanToken).trim();
    if (!value || scanBusy) return;
    if (tokenOverride) {
      setScanToken(value);
    }
    setScanBusy(true);
    setScanError("");
    setScanResult(null);
    try {
      const payload = await apiRequest("tickets/scan", {
        method: "POST",
        body: { token: value }
      });
      setScanResult(payload || null);
    } catch (error) {
      setScanError(error?.message || t("ticket_scan_failed"));
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
            <div className="mt-6 rounded-2xl border border-[#EADAF1] bg-white p-4">
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
              <div className="mt-3 flex flex-col gap-2">
                <input
                  value={scanToken}
                  onChange={(event) => setScanToken(event.target.value)}
                  placeholder={t("ticket_scan_placeholder")}
                  className="w-full rounded-2xl border border-[#EADAF1] px-3 py-2 text-xs text-secondary-600 outline-none focus:border-primary-500"
                />
                <Button
                  label={t("ticket_scan_button")}
                  size="sm"
                  className="w-full"
                  onClick={handleScanTicket}
                  loading={scanBusy}
                  disabled={!scanToken.trim() || scanBusy}
                />
              </div>
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
